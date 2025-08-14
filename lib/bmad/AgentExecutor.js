/**
 * Agent Executor - Consolidated Version
 * Single source of truth for ALL agent execution retry logic
 * 
 * PRINCIPLES:
 * - Unified Retry Strategy: Handles both timeout and validation retries in one loop
 * - No Nested Retries: Clear single retry path eliminates complexity
 * - Configurable: Timeout and retry settings passed from workflow level
 * - Single Responsibility: Owns ALL execution concerns, StepExecutor focuses on orchestration
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { validateFilePath } = require('../utils/fileValidator');
const { PromptBuilder } = require('./execution/PromptBuilder.js');
const { OutputValidator } = require('./execution/OutputValidator.js');
const { FallbackProvider } = require('./execution/FallbackProvider.js');
const { ElicitationHandler } = require('./ElicitationHandler.js');
import logger from '../utils/logger.js';

const isServer = typeof window === 'undefined';

class AgentExecutor {
  constructor(agentLoader, aiService, configurationManager = null) {
    this.aiService = aiService;
    this.agentLoader = agentLoader;
    this.configurationManager = configurationManager;
    this.elicitationHandler = new ElicitationHandler(this.configurationManager);
    this.taskCache = new Map();
    this.templateCache = new Map();
    this.checklistCache = new Map();
    this.promptCache = new Map();
    this.stateManager = new Map();
    
    // Removed separate retryAttempts Map - now handled in unified retry method
  }

  // Method to update aiService after construction
  updateAiService(aiService) {
    if (aiService && !this.aiService) {
      this.aiService = aiService;
      // ElicitationHandler doesn't need aiService - it uses configurationManager
    }
  }

  getWorkflowState(workflowId) {
    return this.stateManager.get(workflowId) || {
      completedOutputs: [],
      currentStep: 1,
      dependenciesMet: true,
      sharedData: {},
      corrections: [],
      notes: []
    };
  }

  updateWorkflowState(workflowId, updates) {
    const currentState = this.getWorkflowState(workflowId);
    this.stateManager.set(workflowId, { ...currentState, ...updates });
  }

  addAgentOutput(workflowId, agentId, output) {
    const state = this.getWorkflowState(workflowId);
    state.completedOutputs.push({
      agentId,
      output,
      timestamp: new Date().toISOString(),
      validated: false
    });
    this.updateWorkflowState(workflowId, state);
  }

  /**
   * UNIFIED EXECUTION METHOD - Single source of truth for ALL retry logic
   * Handles timeout, validation retries, and elicitation in one clean loop
   */
  async executeAgent(agent, context, options = {}) {
    logger.info(`🔍 [AGENT EXECUTOR DEBUG] Full context received: ${JSON.stringify({
      action: context.action,
      command: context.command,
      creates: context.creates,
      stepNotes: context.stepNotes,
      agentId: agent?.id,
      workflowId: context.workflowId,
      contextKeys: Object.keys(context || {}),
      agentKeys: Object.keys(agent || {})
    })}`);

    if (!isServer) {
      return this.createMockExecution(agent, context);
    }

    const config = {
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 120000,
      validationEnabled: options.validation !== false,
      workflowId: context.workflowId
    };

    const startTime = Date.now();

    try {
      logger.info('🔍 [AGENT EXECUTOR DEBUG] About to call determineTemplate');
      logger.info(`🔍 [AGENT EXECUTOR DEBUG] Context details: ${JSON.stringify({ 
        action: context.action, 
        uses: context.command, 
        agentId: agent.id,
        stepNotes: context.stepNotes 
      })}`);
      const template = await this.determineTemplate(agent, context);
      console.log({ templateFound: template });
      
      logger.info(`🔍 [AGENT EXECUTOR DEBUG] determineTemplate completed: ${JSON.stringify({ 
        templateFound: !!template, 
        templateId: template?.template?.id,
        templateSections: template?.sections?.length 
      })}`);
      
      if (!template && context.action !== 'elicit') {
        // Only warn if it's not an elicitation step
        logger.warn('No suitable template found for agent');
      }

      // Handle elicitation steps without templates
      let result;
      if (context.action === 'elicit') {
        logger.info('Executing elicitation step - waiting for user input');
        result = await this.handleElicitationStep(agent, context);
      } else if (context.interactiveMode && context.templateName) {
        // CRITICAL FIX: Handle interactive template-based steps
        logger.info(`🔄 [INTERACTIVE EXECUTION] Handling interactive template: ${context.templateName}`);
        result = await this.handleInteractiveTemplate(agent, context);
      } else if (template) {
        // UNIFIED RETRY LOOP - handles both timeout and validation
        result = await this.executeWithUnifiedRetries(agent, template, context, config);
      } else {
        // 🤖 NEW: Use generic AI processing instead of failing
        logger.info(`🤖 No template found for ${context.action || agent.id}, using generic AI processing`);
        const genericTemplate = this.createGenericProcessingTemplate(context, agent);
        
        if (genericTemplate) {
          result = await this.executeWithUnifiedRetries(agent, genericTemplate, context, config);
        } else {
          // Final fallback - should rarely happen
          result = {
            success: false,
            error: 'No suitable template found for agent and not an elicitation step',
            artifacts: [],
            messages: [`Agent ${agent.id} could not find a suitable template`],
            type: 'template_error'
          };
        }
      }
      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        executionTime,
        success: result.success || false
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('❌ [AGENT EXECUTOR] Critical error in executeAgent:', {
        error: error.message,
        stack: error.stack,
        agentId: agent.id,
        context: {
          action: context?.action,
          command: context?.command,
          creates: context?.creates,
          stepNotes: context?.stepNotes
        }
      });
      
      return {
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        executionTime,
        success: false,
        error: error.message,
        timedOut: error.message.includes('timed out') || error.message.includes('timeout'),
        attempts: config?.maxRetries || 1
      };
    }
  }

  /**
   * UNIFIED RETRY METHOD - Single loop handling all retry scenarios
   * No more nested retries between StepExecutor and AgentExecutor!
   */
  async executeWithUnifiedRetries(agent, template, context, config) {
    let lastError = null;
    
    if (template) {
      for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
          // Create timeout promise for this attempt
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Agent ${agent.id} execution timed out after ${config.timeout}ms (attempt ${attempt})`));
            }, config.timeout);
          });
  
          // Race execution against timeout
          const result = await Promise.race([
            this.processSingleAttempt(agent, template, context, attempt),
            timeoutPromise
          ]);
          console.log({ result });
          
  
          // Handle elicitation immediately - no retry needed
          if (result && (result.type === 'elicitation_required' || result.elicitationRequired)) {
            return {
              success: false,
              elicitationRequired: true,
              elicitationData: result,
              attempts: attempt,
              type: 'elicitation_required'
            };
          }
  
          // Validate output if validation is enabled
          if (config.validationEnabled && template) {
            const validator = new OutputValidator(template);
            const validation = validator.validate(result);
            
            if (validation.isValid) {
              // Success! Add to workflow state and return
              this.addAgentOutput(config.workflowId, agent.id, result);
              return {
                success: true,
                output: result,
                artifacts: this.extractArtifacts(result),
                messages: [`Agent ${agent.id} completed successfully on attempt ${attempt}`],
                attempts: attempt
              };
            } else {
              // Validation failed - prepare feedback for next attempt
              if (attempt < config.maxRetries) {
                context.validationFeedback = validation;
                context.previousAttempt = attempt;
                continue; // Try again with validation feedback
              } else {
                return {
                  success: false,
                  error: `Validation failed after ${attempt} attempts: ${validation.errors.join(', ')}`,
                  output: result,
                  attempts: attempt
                };
              }
            }
          } else {
            // No validation required - return result
            this.addAgentOutput(config.workflowId, agent.id, result);
            return {
              success: true,
              output: result,
              artifacts: this.extractArtifacts(result),
              messages: [`Agent ${agent.id} completed without validation on attempt ${attempt}`],
              attempts: attempt
            };
          }
  
        } catch (error) {
          lastError = error;
          
          // If this was a timeout and we have more attempts, continue
          if (error.message.includes('timed out') && attempt < config.maxRetries) {
            context.timeoutFeedback = `Previous attempt timed out after ${config.timeout}ms`;
            continue;
          }
          
          // If this was the last attempt or a non-timeout error, break
          if (attempt === config.maxRetries || !error.message.includes('timed out')) {
            break;
          }
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError?.message || 'All retry attempts failed',
      timedOut: lastError?.message.includes('timed out'),
      attempts: config.maxRetries
    };
  }

  /**
   * Process a single execution attempt
   */
  async processSingleAttempt(agent, template, context, attempt) {
    // Ensure sections is always an array - handle both array and object formats
    let sections = template.sections || [];
    if (!Array.isArray(sections)) {
      // Convert object sections to array format for compatibility
      sections = Object.entries(sections).map(([key, value]) => ({
        id: key,
        title: value.title || key,
        content: value.content || value,
        ...value
      }));
      logger.info(`🔧 [TEMPLATE FIX] Converted object sections to array format (${sections.length} sections)`);
    }
    
    const parsedContext = new PromptBuilder(agent, template, context).parseUserPrompt(context.userPrompt || '');
    
    for (const section of sections) {
      // Check if elicitation is required and response is not available
      const hasUserResponse = parsedContext[section.id] || context.workflowContext?.[section.id] || context[section.id];
      if (section.elicitation?.required && !hasUserResponse) {
        // FIXED: Use template questions directly instead of elicitation method selection
        return {
          agentId: agent.id,
          agentName: agent.agent?.name || agent.id,
          success: false,
          elicitationRequired: true,
          type: 'template_elicitation',
          elicitationData: {
            sectionTitle: section.title || section.id,
            instruction: section.instruction || `Please provide information for ${section.title || section.id}`,
            sectionId: section.id,
            agentId: agent.id,
            agentName: agent.agent?.name || agent.id,
            // DYNAMIC MODE CONTEXT: Help ElicitationHandler decide mode
            command: context?.command,
            templateType: template?.type,
            requiresMethodSelection: false, // Templates like document-project.md use free text
            type: 'template_elicitation'
          },
          content: section.instruction || `Please provide information for ${section.title || section.id}`,
          output: `Template elicitation required: ${section.title || section.id}`,
          artifacts: [],
          messages: [`Template elicitation created for ${agent.id}: ${section.title || section.id}`],
          executionTime: 0,
          attempts: 1
        };
      }
    }

    const prompt = new PromptBuilder(agent, template, context).build();
    return await this.callAIService(prompt, agent, attempt, context);
  }

  async callAIService(prompt, agent, attempt, context = null) {
    console.log({prompt, agent, attempt, context});
    
    if (!this.aiService) {
      logger.error(`❌ [AI SERVICE] No AIService available in AgentExecutor - using fallback`);
      const fallbackProvider = new FallbackProvider();
      return fallbackProvider.generateResponse(agent, context);
    }
    
    // AGGRESSIVE DEBUGGING - Log AIService state
    logger.info(`🔍 [AI SERVICE DEBUG] AIService state:`, {
      initialized: this.aiService.initialized,
      hasGeminiClient: !!this.aiService.geminiClient,
      hasOpenaiClient: !!this.aiService.openaiClient,
      currentApiKeys: {
        hasGemini: !!this.aiService.currentApiKeys?.gemini,
        hasOpenai: !!this.aiService.currentApiKeys?.openai,
        geminiPrefix: this.aiService.currentApiKeys?.gemini?.substring(0, 10),
        openaiPrefix: this.aiService.currentApiKeys?.openai?.substring(0, 10)
      }
    });
    
    // Check if AIService is initialized
    if (!this.aiService.initialized) {
      const userId = context?.userId || context?.workflowContext?.initiatedBy;
      if (userId) {
        logger.info(`🔄 [AI SERVICE] AIService not initialized, attempting to initialize for user: ${userId}`);
        // Initialize with user's API keys from database - pass null for apiKeys param to load from DB
        const initResult = await this.aiService.initialize(null, userId);
        if (!initResult) {
          logger.error(`❌ [AI SERVICE] Failed to initialize AIService for user: ${userId} - user may need to configure API keys`);
          const fallbackProvider = new FallbackProvider();
          return fallbackProvider.generateResponse(agent, context);
        }
        logger.info(`✅ [AI SERVICE] Successfully initialized AIService for user: ${userId}`);
      } else {
        logger.error(`❌ [AI SERVICE] AIService not initialized and no userId provided`);
        const fallbackProvider = new FallbackProvider();
        return fallbackProvider.generateResponse(agent, context);
      }
    }

    try {
      const complexity = this.calculateComplexity(prompt);
      const userId = context?.userId || context?.workflowContext?.initiatedBy;
      
      const response = await this.aiService.call(prompt, agent, complexity, context, userId);
      console.log({ agentResponse: response });
      

      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response from AI service');
      }

      // Add attempt info to response for debugging
      if (response.metadata) {
        response.metadata.attempt = attempt;
      }

      return response;

    } catch (error) {
      // Add attempt context to error
      const enhancedError = new Error(`AI service call failed on attempt ${attempt}: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.attempt = attempt;
      throw enhancedError;
    }
  }

  calculateComplexity(prompt) {
    const length = prompt.length;
    if (length < 500) return 1;
    if (length < 2000) return 2;
    if (length < 5000) return 3;
    return 4;
  }

  extractArtifacts(output) {
    if (!output || typeof output !== 'object') return [];
    
    const artifacts = [];
    
    // Extract different types of artifacts
    if (output.files) artifacts.push(...output.files);
    if (output.code) artifacts.push({ type: 'code', content: output.code });
    if (output.documentation) artifacts.push({ type: 'documentation', content: output.documentation });
    
    return artifacts;
  }

  /**
   * 🔍 Enhanced template detection with intelligent pattern matching
   * Uses multiple strategies to find the best template for a given context
   */
  async enhancedTemplateDetection(context, agent) {
    console.log({enhancedTemplateDetection: {agent, context}});
    
    const detectionStrategies = [
      // Strategy 1: Direct template reference in context.uses
      () => this.detectDirectTemplateReference(context),
      
      // Strategy 2: Action-based template mapping
      () => this.detectActionBasedTemplate(context, agent),
      
      // Strategy 3: Content pattern analysis
      () => this.detectContentPatternTemplate(context, agent),
      
      // Strategy 4: Creates field mapping
      () => this.detectCreatesBasedTemplate(context),
      
      // Strategy 5: Step notes analysis
      () => this.detectNotesBasedTemplate(context)
    ];

    for (const strategy of detectionStrategies) {
      try {
        const templatePath = await strategy();
        if (templatePath && await this.validateTemplateExists(templatePath)) {
          logger.info(`🎯 [DETECTION SUCCESS] Template found: ${templatePath}`);
          
          // CRITICAL FIX: Check if this is an interactive template
          if (templatePath === 'project-brief-tmpl.yaml') {
            logger.info('🔄 [INTERACTIVE TEMPLATE] Detected project-brief template - checking for interactive mode');
            try {
              const template = await this.loadTemplateFile(templatePath);
              if (template?.workflow?.mode === 'interactive') {
                logger.info('🔄 [INTERACTIVE TEMPLATE] project-brief-tmpl is interactive - setting up conversational context');
                // Mark context as interactive template-based
                context.templateName = 'project-brief-tmpl';
                context.interactiveMode = true;
                return null; // This will trigger interactive flow in isInteractiveStep
              }
            } catch (templateError) {
              logger.warn('⚠️ [INTERACTIVE TEMPLATE] Could not load project-brief-tmpl for interactive check:', templateError.message);
            }
          }
          
          return templatePath;
        }
      } catch (error) {
        logger.warn(`⚠️ [DETECTION ERROR] Strategy failed: ${error.message}`);
        continue;
      }
    }

    return null;
  }

  /**
   * Strategy 1: Direct template reference detection
   */
  detectDirectTemplateReference(context) {
    if (context.uses && typeof context.uses === 'string') {
      if (context.uses.endsWith('.yaml') || context.uses.endsWith('.yml')) {
        return context.uses;
      }
      return context.uses.endsWith('-tmpl') ? `${context.uses}.yaml` : `${context.uses}-tmpl.yaml`;
    }
    return null;
  }

  /**
   * Strategy 2: Action-based template mapping
   */
  detectActionBasedTemplate(context, agent) {
    if (!context.action) return null;

    const actionMappings = {
      'check existing documentation': 'check-documentation.md',
      'classify enhancement scope': 'enhancement-classification-tmpl.yaml',
      'create prd': 'prd-tmpl.yaml',
      'create architecture': 'architecture-tmpl.yaml',
      'create brownfield prd': 'brownfield-prd-tmpl.yaml',
      'create front-end spec': 'front-end-spec-tmpl.yaml',
      'create project brief': 'project-brief-tmpl.yaml'
    };

    const normalizedAction = context.action.toLowerCase();
    return actionMappings[normalizedAction] || null;
  }

  /**
   * Strategy 3: Content pattern analysis
   */
  detectContentPatternTemplate(context, agent) {
    const stepNotes = context.stepNotes || context.notes || '';
    
    // Pattern matching for common workflow patterns
    const patterns = [
      { regex: /check.*documentation.*status/i, template: 'check-documentation.md' },
      { regex: /classify.*enhancement/i, template: 'enhancement-classification-tmpl.yaml' },
      { regex: /create.*prd/i, template: 'prd-tmpl.yaml' },
      { regex: /architecture.*document/i, template: 'architecture-tmpl.yaml' },
      { regex: /brownfield.*prd/i, template: 'brownfield-prd-tmpl.yaml' },
      { regex: /front.*end.*spec/i, template: 'front-end-spec-tmpl.yaml' },
      { regex: /project.*brief/i, template: 'project-brief-tmpl.yaml' },
      { regex: /competitor.*analysis/i, template: 'competitor-analysis-tmpl.yaml' },
      { regex: /market.*research/i, template: 'market-research-tmpl.yaml' }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(stepNotes) || pattern.regex.test(context.action || '')) {
        logger.info(`🎯 [PATTERN MATCH] Found pattern for template: ${pattern.template}`);
        return pattern.template;
      }
    }

    return null;
  }

  /**
   * Strategy 4: Creates field based template detection
   */
  detectCreatesBasedTemplate(context) {
    if (!context.creates) return null;

    const createsMappings = {
      'prd.md': 'prd-tmpl.yaml',
      'architecture.md': 'architecture-tmpl.yaml', 
      'brownfield-prd.md': 'brownfield-prd-tmpl.yaml',
      'front-end-spec.md': 'front-end-spec-tmpl.yaml',
      'project-brief.md': 'project-brief-tmpl.yaml',
      'competitor-analysis.md': 'competitor-analysis-tmpl.yaml',
      'market-research.md': 'market-research-tmpl.yaml',
      'fullstack-architecture.md': 'fullstack-architecture-tmpl.yaml'
    };

    return createsMappings[context.creates] || null;
  }

  /**
   * Strategy 5: Step notes template extraction
   */
  detectNotesBasedTemplate(context) {
    const stepNotes = context.stepNotes || context.notes || '';
    
    // Extract explicit template references
    const templateMatches = [
      stepNotes.match(/using\s+([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i),
      stepNotes.match(/with\s+([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i),
      stepNotes.match(/([a-zA-Z0-9\-_]+(?:-tmpl)(?:\.yaml)?)/),
    ];

    for (const match of templateMatches) {
      if (match && match[1]) {
        let templateName = match[1];
        if (!templateName.endsWith('.yaml') && !templateName.endsWith('.md')) {
          if (!templateName.endsWith('-tmpl')) {
            templateName += '-tmpl';
          }
          templateName += '.yaml';
        }
        return templateName;
      }
    }

    return null;
  }

  /**
   * Validate that a template file actually exists
   */
  async validateTemplateExists(templatePath) {
    try {
      let fullPath;
      if (!templatePath.includes('/') && !templatePath.includes('\\')) {
        // Template file (.yaml)
        if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
          fullPath = path.join(process.cwd(), '.bmad-core', 'templates', templatePath);
        }
        // Task file (.md) 
        else if (templatePath.endsWith('.md')) {
          fullPath = path.join(process.cwd(), '.bmad-core', 'tasks', templatePath);
        }
      } else {
        fullPath = path.resolve(templatePath);
      }
      
      await fs.access(fullPath, fs.constants.F_OK);
      return true;
    } catch (error) {
      logger.warn(`⚠️ [TEMPLATE VALIDATION] Template not found: ${templatePath}`);
      return false;
    }
  }

  // Updated to work like official BMAD - maps 'creates' field to agent commands
  async determineTemplate(agent, context) {
    
    try {
      logger.info(`[AGENT EXECUTOR] determineTemplate - Agent: ${agent?.id}, Context Action: ${context?.action}, Context Uses: ${context?.uses}`);
      
      // Check if this is an interactive step that doesn't need a template
      if (this.isInteractiveStep(context, agent)) {
        logger.info(`[AGENT EXECUTOR] determineTemplate - Interactive step detected: ${context.action} - no template needed`);
        return null;
      }

      let templatePath = null;
      let commandName = context.command;

      // 🔍 ENHANCED PATTERN MATCHING: Try multiple detection strategies
      templatePath = await this.enhancedTemplateDetection(context, agent);
      
      if (templatePath) {
        logger.info(`✅ [ENHANCED DETECTION] Found template via pattern matching: ${templatePath}`);
        return await this.loadTemplateFile(templatePath);
      }

      // NEW: If no explicit command, try to map from 'creates' field (like official BMAD)
      if (!commandName && context?.creates) {
        logger.info('🔍 [CREATES MAPPING] About to map creates to command:', { 
          creates: context.creates, 
          createsType: typeof context.creates 
        });
        
        try {
          commandName = this.mapCreatesToCommand(context.creates, agent);
          logger.info('🔍 [CREATES MAPPING] Successfully mapped creates to command:', {
            creates: context.creates,
            mappedCommand: commandName
          });
          
          // CRITICAL FIX: Check if this is an interactive template case
          if (context.creates === 'project-brief.md') {
            logger.info('🔄 [INTERACTIVE TEMPLATE] Detected project-brief creation - checking for interactive template');
            try {
              const template = await this.loadTemplateFile('project-brief-tmpl.yaml');
              logger.info('🔍 [INTERACTIVE TEMPLATE] Loaded template:', {
                hasTemplate: !!template,
                hasWorkflow: !!template?.workflow,
                mode: template?.workflow?.mode,
                isInteractive: template?.workflow?.mode === 'interactive'
              });
              
              if (template?.workflow?.mode === 'interactive') {
                logger.info('🔄 [INTERACTIVE TEMPLATE] project-brief-tmpl is interactive - setting up conversational context');
                // Mark context as interactive template-based
                context.templateName = 'project-brief-tmpl';
                context.interactiveMode = true;
                logger.info('✅ [INTERACTIVE TEMPLATE] Context marked as interactive:', {
                  templateName: context.templateName,
                  interactiveMode: context.interactiveMode
                });
                return null; // This will trigger interactive flow in isInteractiveStep
              } else {
                logger.warn('⚠️ [INTERACTIVE TEMPLATE] project-brief-tmpl is not interactive mode, proceeding normally');
              }
            } catch (templateError) {
              logger.warn('⚠️ [INTERACTIVE TEMPLATE] Could not load project-brief-tmpl for interactive check:', templateError.message);
              logger.warn('⚠️ [INTERACTIVE TEMPLATE] Template error stack:', templateError.stack);
            }
          }
        } catch (error) {
          logger.error('🔍 [CREATES MAPPING] Error in mapCreatesToCommand:', error);
          throw error;
        }
      }

      // Handle special AI classification command
      if (commandName === 'analyze_and_classify_enhancement') {
        logger.info(`🧠 [AI CLASSIFICATION] Using enhancement classification template for ${agent.id}`);
        templatePath = 'enhancement-classification-tmpl.yaml';
      }
      // Handle command-based steps
      else if (commandName) {
        // Find the command definition within the agent's commands
        if (agent.commands && Array.isArray(agent.commands)) {
          for (const cmd of agent.commands) {
            // Commands can be simple strings or objects
            if (typeof cmd === 'string' && cmd === commandName) {
              // For simple string commands, try to infer template from notes or creates
              templatePath = this.inferTemplateFromContext(context, agent);
              break; 
            } else if (typeof cmd === 'object' && Object.keys(cmd)[0] === commandName) {
              const commandDefinition = cmd[commandName];
              if (commandDefinition && commandDefinition.uses) {
                templatePath = commandDefinition.uses;
                break;
              }
              // NEW: Handle compound commands like "use task create-doc with project-brief-tmpl.yaml"
              else if (typeof commandDefinition === 'string') {
                templatePath = this.parseCompoundCommand(commandDefinition);
                if (templatePath) {
                  logger.info(`✅ [COMPOUND COMMAND] Extracted template from compound: '${templatePath}'`);
                  break;
                }
              }
            }
          }
        }

        // If still no template, try to extract from notes field (fallback)
        if (!templatePath && context.stepNotes) {
          templatePath = this.extractTemplateFromNotes(context.stepNotes);
        }

        if (!templatePath) {
          logger.warn(`Agent ${agent.id} command ${commandName} has no associated template defined.`);
          return null;
        }
      } else {
        // No command and no action specified
        logger.warn(`Step has no command, action, or creates field specified`);
        return null;
      }

      const cacheKey = `${agent.id}_${commandName}_template`;
      if (this.templateCache.has(cacheKey)) {
        return this.templateCache.get(cacheKey);
      }

      const template = await this.loadTemplateFile(templatePath);
      this.templateCache.set(cacheKey, template);
      return template;
    } catch (error) {
      logger.error(`Error determining template for agent ${agent.id}:`, error);
      return null;
    }
  }

  // Map 'creates' field to agent command (like official BMAD)
  mapCreatesToCommand(creates, agent) {
    const createsMappings = {
      'project-brief.md': 'create-project-brief',
      'prd.md': 'create', // Default create command
      'front-end-spec.md': 'create-front-end-spec', 
      'fullstack-architecture.md': 'create-full-stack-architecture',
      'architecture.md': 'create-backend-architecture'
    };

    const mappedCommand = createsMappings[creates];
    if (mappedCommand) {
      logger.info(`✅ [CREATES MAPPING] Mapped '${creates}' to command '${mappedCommand}'`);
      return mappedCommand;
    }

    // Fallback: try to extract from filename
    if (!creates || typeof creates !== 'string') {
      logger.warn(`⚠️ [CREATES MAPPING] No creates field provided for mapping`);
      return null;
    }
    const baseName = creates?.replace('.md', '')?.replace('-', '_');
    const possibleCommand = `create-${baseName}`;
    
    logger.info(`🔍 [CREATES MAPPING] No direct mapping found, trying fallback: '${possibleCommand}'`);
    return possibleCommand;
  }

  // Extract template name from notes field (fallback method)
  extractTemplateFromNotes(notes) {
    // Look for patterns like "using prd-tmpl" or "prd-tmpl.yaml"
    const templateMatch = notes.match(/using\s+([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i) || 
                         notes.match(/([a-zA-Z0-9\-_]+(?:-tmpl)(?:\.yaml)?)/);
    
    if (templateMatch) {
      let templateName = templateMatch[1];
      // Ensure it ends with .yaml
      if (!templateName.endsWith('.yaml')) {
        if (!templateName.endsWith('-tmpl')) {
          templateName += '-tmpl';
        }
        templateName += '.yaml';
      }
      
      logger.info(`✅ [NOTES EXTRACTION] Found template in notes: '${templateName}'`);
      return templateName;
    }
    
    logger.warn(`⚠️ [NOTES EXTRACTION] Could not extract template from notes: '${notes}'`);
    return null;
  }

  // Infer template from context when command is a simple string
  inferTemplateFromContext(context, agent) {
    // Try notes field first
    const fromNotes = this.extractTemplateFromNotes(context.stepNotes || '');
    if (fromNotes) return fromNotes;

    // Try creates field
    if (context.creates && typeof context.creates === 'string') {
      const baseName = context.creates?.replace('.md', '');
      const templateName = `${baseName}-tmpl.yaml`;
      logger.info(`🔍 [CONTEXT INFERENCE] Inferred template from creates: '${templateName}'`);
      return templateName;
    }

    return null;
  }

  // Parse compound commands like "use task create-doc with project-brief-tmpl.yaml"
  parseCompoundCommand(commandDefinition) {
    logger.info(`🔍 [COMPOUND COMMAND] Parsing: '${commandDefinition}'`);
    
    // Pattern: "use task TASKNAME with TEMPLATE.yaml"
    const taskWithTemplate = commandDefinition.match(/use task\s+[\w\-]+\s+with\s+([\w\-]+(?:\.yaml)?)/i);
    if (taskWithTemplate) {
      let templateName = taskWithTemplate[1];
      if (!templateName.endsWith('.yaml')) {
        templateName += '.yaml';
      }
      logger.info(`✅ [COMPOUND COMMAND] Found template: '${templateName}'`);
      return templateName;
    }

    // Pattern: "with TEMPLATE.yaml" (simpler version)
    const withTemplate = commandDefinition.match(/with\s+([\w\-]+(?:\.yaml)?)/i);
    if (withTemplate) {
      let templateName = withTemplate[1];
      if (!templateName.endsWith('.yaml')) {
        templateName += '.yaml';
      }
      logger.info(`✅ [COMPOUND COMMAND] Found template (simple): '${templateName}'`);
      return templateName;
    }

    logger.warn(`⚠️ [COMPOUND COMMAND] Could not extract template from: '${commandDefinition}'`);
    return null;
  }

  async loadTemplateFile(templatePath) {
    try {
      // If templatePath is just a filename, look in .bmad-core/templates/
      let fullPath;
      if (!templatePath.includes('/') && !templatePath.includes('\\')) {
        fullPath = path.join(process.cwd(), '.bmad-core', 'templates', templatePath);
        logger.info(`🔍 [TEMPLATE LOADING] Resolving template: '${templatePath}' -> '${fullPath}'`);
      } else {
        fullPath = path.resolve(templatePath);
      }
      
      validateFilePath(fullPath);
      
      const content = await fs.readFile(fullPath, 'utf8');
      logger.info(`✅ [TEMPLATE LOADING] Successfully loaded template: '${templatePath}'`);
      return yaml.load(content);
    } catch (error) {
      logger.error(`❌ [TEMPLATE LOADING] Failed to load template '${templatePath}':`, error.message);
      throw new Error(`Failed to load template file ${templatePath}: ${error.message}`);
    }
  }

  async handleElicitationStep(agent, context) {
    console.log({agent, context});
    
    
    try {
      // Use the existing agent template to generate elicitation text
      let agentGeneratedText = null;
      
      if (this.aiService && agent.agent) {
        logger.info('🤖 [AGENT TEMPLATE] Using existing agent template for elicitation');
        
        const userId = context.userId || context.workflowContext?.initiatedBy;
        try {
          // Create specific elicitation prompt that includes the workflow notes
          const workflowNotes = context.stepNotes || context.notes;
          
          
          // Check if this elicitation step references a specific task (like document-project)
          let elicitationPrompt;
          
          if (workflowNotes && workflowNotes.includes('document-project')) {
            // This step should use the document-project task's elicitation questions
            try {
              const taskContent = await this.loadTaskFile('document-project.md');
              const taskQuestions = this.extractElicitationQuestions(taskContent);
              
              elicitationPrompt = `You are ${agent.agent?.name || agent.id}, the ${agent.agent?.title || 'specialist'}. ${agent.agent?.icon || '🤖'}

The user described their project as: "${context.userPrompt || context.workflowContext?.userPrompt || 'User is working on a project'}"

Introduce yourself professionally, then ask the elicitation questions from the document-project task:

${taskQuestions}

Use proper formatting with bullet points and include your emoji icon.`;
            } catch (error) {
              logger.warn(`⚠️ [ELICITATION] Could not load document-project task, using fallback:`, error.message);
              // Fallback to structured questions if task loading fails
              elicitationPrompt = `You are ${agent.agent?.name || agent.id}, the ${agent.agent?.title || 'specialist'}. ${agent.agent?.icon || '🤖'}

Introduce yourself as "${agent.agent?.name || agent.id}, the ${agent.agent?.title}" with your emoji ${agent.agent?.icon || '🤖'}, then ask these structured questions:

To start the analysis of your existing service, I need you to provide some details. Please describe the service you want to enhance, including:

* What is its primary purpose?
* What are the main technologies it uses?
* What are the specific enhancements or changes you want to make?
* Are there any existing documents, diagrams, or source code locations I should review?`;
            }
          } else {
            // Default elicitation for other steps
            elicitationPrompt = `You are ${agent.agent?.name || agent.id}, the ${agent.agent?.title || 'specialist'}. ${agent.agent?.icon || '🤖'}

The user described their project as: "${context.userPrompt || context.workflowContext?.userPrompt || 'User is working on a project'}"

WORKFLOW STEP: ${context.step || 'elicitation'}

INSTRUCTIONS: ${workflowNotes || 'Gather information from the user to continue the workflow.'}

Introduce yourself professionally with your name, title and emoji, then ask for the information specified in the workflow instructions.`;
          }
          
          const agentResponse = await this.aiService.call(elicitationPrompt, agent, 1, context, userId);
          console.log({agentResponse: agentResponse.content});
          

          if (agentResponse && agentResponse.content && agentResponse.content.trim().length > 0) {
            agentGeneratedText = agentResponse.content.trim();
            logger.info(`🤖 [AGENT TEMPLATE] Agent generated response using template: ${{
              textLength: agentGeneratedText.length,
              textPreview: agentGeneratedText.substring(0, 300) + (agentGeneratedText.length > 300 ? '...' : '')
            }}`);
          }
        } catch (error) {
          logger.warn('⚠️ [AGENT TEMPLATE] Failed to use agent template:', error.message);
        }
      }

      // Create a section object for the ElicitationHandler to work with
      const section = {
        id: context.step || 'elicitation',
        title: context.stepNotes || context.notes || `Input needed from ${agent.agent?.name || agent.id}`,
        instruction: context.stepNotes || context.notes || `Please provide information to help ${agent.agent?.name || agent.id} continue with the workflow.`,
        elicitation: { required: true }
      };


      // Create parsed context for ElicitationHandler
      const parsedContext = {
        projectDescription: context.userPrompt || context.workflowContext?.userPrompt || 'Current workflow project',
        workflowStep: context.step,
        agentRole: agent.agent?.name || agent.id,
        userId: context.userId || context.workflowContext?.initiatedBy
      };

      logger.info(`🔍 [ELICITATION DEBUG] About to call ElicitationHandler with aiService: ${{ 'this.aiService': !!this.aiService, parsedContext }}`);
      logger.info(`🔍 [ELICITATION DEBUG] Context being passed to ElicitationHandler: ${{
        hasUserId: !!(context.userId || context.workflowContext?.initiatedBy),
        userId: context.userId || context.workflowContext?.initiatedBy,
        contextKeys: Object.keys(context),
        hasAgentText: !!agentGeneratedText
      }}`);

      // Use BMAD ElicitationHandler to prepare elicitation request with 1-9 options
      const elicitationDetails = {
        sectionTitle: section.title || section.id,
        instruction: agentGeneratedText || section.instruction || `Please provide information for ${section.title || section.id}`
      };
      const elicitationResult = await this.elicitationHandler.prepareElicitationRequest(elicitationDetails);
      
      logger.info('🤖 ElicitationHandler processed result:', {
        type: elicitationResult.type,
        sectionTitle: elicitationResult.sectionTitle,
        hasInstruction: !!elicitationResult.instruction,
        instructionLength: elicitationResult.instruction?.length,
        hadOriginalAgentText: !!elicitationResult.originalAgentText
      });

      // Convert ElicitationHandler result to AgentExecutor format
      return {
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        success: false,  // Don't treat as success - workflow should pause
        elicitationRequired: true,  // Match the condition check in DynamicWorkflowHandler
        type: 'elicitation_required',  // Alternative condition check
        elicitationData: {
          sectionTitle: elicitationResult.sectionTitle,
          instruction: elicitationResult.instruction,
          sectionId: elicitationResult.sectionId,
          agentId: agent.id,
          agentName: agent.agent?.name || agent.id,
          originalInstruction: elicitationResult.originalInstruction,
          originalAgentText: agentGeneratedText
        },
        elicitationDetails: {
          sectionTitle: elicitationResult.sectionTitle,
          instruction: elicitationResult.instruction,
          sectionId: elicitationResult.sectionId,
          agentId: agent.id,
          agentName: agent.agent?.name || agent.id
        },
        content: elicitationResult.instruction,
        output: `Workflow paused for user input: ${elicitationResult.sectionTitle}`,
        artifacts: [],
        messages: [`AI-processed elicitation question created for ${agent.id}`],
        executionTime: 0,
        attempts: 1
      };

    } catch (error) {
      logger.error('Error in handleElicitationStep:', error);
      
      // Fallback to simple elicitation if ElicitationHandler fails
      const fallbackDetails = {
        sectionTitle: context.notes || `Input needed from ${agent.agent?.name || agent.id}`,
        instruction: context.notes || 'Please provide the requested information to continue the workflow.',
        sectionId: context.step || 'elicitation',
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id
      };

      return {
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        success: false,
        elicitationRequired: true,
        type: 'elicitation_required',
        elicitationData: fallbackDetails,
        elicitationDetails: fallbackDetails,
        content: fallbackDetails.instruction,
        output: `Workflow paused for user input: ${fallbackDetails.sectionTitle}`,
        artifacts: [],
        messages: [`Fallback elicitation step initiated for ${agent.id} due to error: ${error.message}`],
        executionTime: 0,
        attempts: 1
      };
    }
  }

  async loadTaskFile(taskFileName) {
    try {
      const taskPath = path.join(process.cwd(), '.bmad-core', 'tasks', taskFileName);
      const content = await fs.readFile(taskPath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`❌ [TASK LOADING] Failed to load task '${taskFileName}':`, error.message);
      throw new Error(`Failed to load task file ${taskFileName}: ${error.message}`);
    }
  }

  extractElicitationQuestions(taskContent) {
    // Extract the specific elicitation questions from the document-project task
    // Look for the section with the structured questions
    const lines = taskContent.split('\n');
    let inElicitationSection = false;
    const questions = [];
    
    for (const line of lines) {
      // Look for the section that starts with asking questions
      if (line.includes('Ask the user these elicitation questions') || 
          line.includes('elicitation questions to better understand')) {
        inElicitationSection = true;
        continue;
      }
      
      // Stop when we hit the next major section
      if (inElicitationSection && line.startsWith('###')) {
        break;
      }
      
      // Extract questions (lines that start with - or *)
      if (inElicitationSection && line.trim().startsWith('-')) {
        const question = line.trim().replace(/^-\s*/, '* ');
        questions.push(question);
      }
    }
    
    // If we found questions, format them nicely
    if (questions.length > 0) {
      return `To start the analysis of your existing service, as per our workflow, I need you to provide some details. Please describe the service you want to enhance, including:

${questions.join('\n')}`;
    }
    
    // Fallback if parsing fails
    return `To start the analysis of your existing service, I need you to provide some details. Please describe the service you want to enhance, including:

* What is its primary purpose?
* What are the main technologies it uses?
* What are the specific enhancements or changes you want to make?
* Are there any existing documents, diagrams, or source code locations I should review?`;
  }

  /**
   * Create a conversational template for live workflows
   * This produces natural responses instead of structured JSON
   */
  createConversationalTemplate(context, agent, stepNotes, stepAction) {
    logger.info(`💬 [CONVERSATIONAL] Creating natural conversation template for ${agent.id}`);
    
    // Extract the actual question or instruction from step notes
    const userQuestion = this.extractUserQuestion(stepNotes);
    const agentPersona = agent.agent || {};
    
    const template = {
      type: 'conversation',
      name: `Live Conversation - ${stepAction}`,
      description: 'Natural conversational interaction for live workflows',
      skipValidation: true,
      conversationalMode: true,
      sections: [
        {
          id: 'conversational_response',
          title: 'Natural Response',
          content: `You are ${agentPersona.name || agent.id}, ${agentPersona.description || 'an AI assistant'} ${agentPersona.icon || '🤖'}

CONTEXT: You're in a live workflow conversation with a user. They need help with: ${stepAction}

INSTRUCTIONS: ${stepNotes}

IMPORTANT: 
- Respond naturally and conversationally, as if you're chatting with the user
- Ask questions in a friendly, helpful way 
- Don't use structured JSON or formal templates
- Be concise but thorough
- Use your persona and expertise to guide the conversation
- If you need to classify or analyze something, explain your thinking naturally

User's project: {{userPrompt}}

${userQuestion ? `Question to ask: ${userQuestion}` : 'Engage with the user about their project requirements.'}`,
          requiresUserInput: stepNotes.includes('Ask user:') || stepNotes.includes('?'),
          responseFormat: 'natural_conversation'
        }
      ]
    };

    logger.info(`💬 [CONVERSATIONAL] Template created with natural conversation format`);
    return template;
  }

  /**
   * Extract user question from step notes
   */
  extractUserQuestion(stepNotes) {
    // Look for "Ask user:" pattern
    const askMatch = stepNotes.match(/Ask user:\s*"([^"]+)"/);
    if (askMatch) {
      return askMatch[1];
    }
    
    // Look for direct questions
    const questionMatch = stepNotes.match(/([^.!?]*\?)/);
    if (questionMatch) {
      return questionMatch[1].trim() + '?';
    }
    
    return null;
  }

  createMockExecution(agent, context) {
    return {
      agentId: agent.id,
      agentName: agent.agent?.name || agent.id,
      success: true,
      output: `Mock execution for ${agent.id}`,
      artifacts: [],
      messages: [`Mock execution completed for ${agent.id}`],
      executionTime: 100,
      attempts: 1
    };
  }

  /**
   * Handle interactive template-based execution
   * This method processes templates marked as interactive mode
   */
  async handleInteractiveTemplate(agent, context) {
    try {
      logger.info(`🔄 [INTERACTIVE TEMPLATE] Processing ${context.templateName} for agent ${agent.id}`);
      
      // Load the template 
      const template = await this.loadTemplateFile(`${context.templateName}.yaml`);
      logger.info(`🔍 [INTERACTIVE TEMPLATE DEBUG] Template loaded:`, {
        templateFound: !!template,
        templateType: template?.type,
        hasSections: !!template?.sections,
        sectionsCount: template?.sections?.length || 0,
        templateName: context.templateName,
        workflowMode: template?.workflow?.mode
      });
      
      if (!template) {
        throw new Error(`Interactive template ${context.templateName} not found`);
      }
      
      // Let the agent execute the template naturally using their AI capabilities
      // The agent will read the template instructions and handle interactions appropriately
      logger.info(`🤖 [INTERACTIVE TEMPLATE] Letting agent handle template execution naturally`);
      const config = { maxRetries: 3, timeout: 30000, validationEnabled: false, workflowId: context.workflowId };
      return await this.executeWithUnifiedRetries(agent, template, context, config);
      
    } catch (error) {
      logger.error(`❌ [INTERACTIVE TEMPLATE] Error handling interactive template:`, error);
      return {
        success: false,
        error: `Failed to process interactive template: ${error.message}`,
        type: 'interactive_template_error',
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        executionTime: 0,
        artifacts: [],
        messages: [`Error processing interactive template: ${error.message}`]
      };
    }
  }

  // Removed hardcoded interactive template processing - agents handle interactions naturally

  /**
   * Determine if a step is interactive and doesn't need a template
   * Uses configuration-driven approach instead of hardcoded action names
   */
  isInteractiveStep(context, agent) {
    // CRITICAL FIX: Rule 0: Check if this is a template-based interactive step
    if (context.templateName && context.interactiveMode) {
      logger.info(`🔄 [INTERACTIVE DETECTION] Template-based interactive step: ${context.templateName}`);
      return true;
    }
    
    // Rule 1: If step has explicit command/uses/creates, it needs a template
    if (context.command || context.uses || context.creates) {
      return false; // Not interactive - has explicit template requirements
    }
    
    // Rule 2: Check if action is in the known interactive actions list
    if (context.action) {
      const knownInteractiveActions = [
        'classify enhancement scope',
        'check existing documentation', 
        'elicit',
        'determine if architecture document needed',
        'create project brief' // Add project brief creation as interactive
      ];
      
      if (knownInteractiveActions.includes(context.action)) {
        logger.info(`🔄 [INTERACTIVE DETECTION] Known interactive action: '${context.action}'`);
        return true;
      }
    }
    
    // Rule 3: If step has action but no template guidance, it's likely interactive
    if (context.action && !context.command && !context.uses && !context.creates) {
      logger.info(`🔄 [INTERACTIVE DETECTION] Action '${context.action}' with no template guidance - treating as interactive`);
      return true;
    }
    
    // Rule 4: Check agent's interactive capabilities (if defined)
    if (agent?.agent?.capabilities?.includes('interactive_elicitation') && context.action) {
      logger.info(`🔄 [INTERACTIVE DETECTION] Agent has interactive_elicitation capability`);
      return true;
    }
    
    // Rule 5: If step notes contain elicitation keywords, it's likely interactive
    const stepNotes = context.stepNotes || '';
    const elicitationKeywords = ['ask user', 'elicit', 'user input', 'question', 'respond', 'describe the', 'can you'];
    if (elicitationKeywords.some(keyword => stepNotes.toLowerCase().includes(keyword))) {
      logger.info(`🔄 [INTERACTIVE DETECTION] Step notes contain elicitation keywords - treating as interactive`);
      return true;
    }
    
    return false; // Default to requiring template
  }

  /**
   * 🤖 Create a generic template for AI processing when no specific template found
   * This ensures all agent instructions go through AI instead of showing raw content
   */
  createGenericProcessingTemplate(context, agent) {
    const stepNotes = context.stepNotes || context.notes || '';
    const stepAction = context.action || 'process instructions';
    
    if (!stepNotes && !stepAction) {
      logger.warn('No content available for generic AI processing');
      return null;
    }

    // CRITICAL FIX: Detect if we're in live workflow mode
    const isLiveWorkflow = context.workflowId && context.chatMode !== false;
    const isConversationalStep = stepNotes.includes('Ask user:') || stepAction.includes('classify');
    
    if (isLiveWorkflow && isConversationalStep) {
      logger.info(`💬 [LIVE WORKFLOW] Creating conversational template for: ${stepAction}`);
      return this.createConversationalTemplate(context, agent, stepNotes, stepAction);
    }

    logger.info(`🤖 [GENERIC AI] Creating template for: ${stepAction}`);
    
    // Determine if this step needs user interaction
    const needsUserInput = stepNotes.includes('Ask user:') || 
                          stepNotes.includes('?') || 
                          stepAction.includes('classify') ||
                          stepAction.includes('check') ||
                          stepAction.includes('elicit');

    const template = {
      type: 'task',
      name: `Generic AI Processing - ${stepAction}`,
      description: 'AI processes workflow instructions to generate appropriate user interaction',
      skipValidation: true, // Skip validation for generic AI templates
      sections: [
        {
          id: 'Context',
          title: 'Context',
          content: `You are ${agent.agent?.name || agent.id}, a ${agent.agent?.title || 'AI assistant'}. ${agent.agent?.icon || '🤖'}
          
Your role: ${agent.agent?.description || 'Help users with workflow tasks'}

Current workflow context:
- User's project: ${context.userPrompt || context.workflowContext?.userPrompt || 'User project'}
- Current step: ${stepAction}
- Workflow progress: Step ${context.step || '?'} of ${context.totalSteps || '?'}`
        },
        {
          id: 'Instructions',
          title: 'Instructions',
          content: `WORKFLOW STEP INSTRUCTIONS:
${stepNotes}

Your task: Process these instructions intelligently and generate appropriate user interaction.`
        },
        {
          id: 'Task',
          title: 'Task',
          content: needsUserInput 
            ? `Process the above instructions and create a clear, user-friendly interaction:

1. If instructions contain "Ask user:" - extract the question and present it clearly
2. If instructions contain technical routing/classification logic - understand it but ask the user in simple terms
3. If instructions mention checking something - ask the user about it directly
4. Always generate user-friendly content, never show technical workflow instructions
5. Be conversational and helpful, matching your agent persona

Generate a clear question or request for the user based on the workflow instructions.`
            : `Process the above instructions and generate helpful information or content for the user:

1. Understand the workflow requirements
2. Generate useful content or analysis based on the instructions  
3. If the instructions are technical, translate them into user-friendly language
4. Provide helpful context or next steps
5. Be conversational and helpful, matching your agent persona

Process the instructions and generate appropriate content.`
        }
      ],
      output: {
        format: 'json',
        schema: {
          type: 'object',
          properties: {
            userMessage: {
              type: 'string',
              description: 'Clean, user-friendly message or question to present to the user'
            },
            context: {
              type: 'string', 
              description: 'Helpful context or explanation for the user (optional)'
            },
            elicitationRequired: {
              type: 'boolean',
              description: 'True if user input is needed to continue'
            },
            classification: {
              type: 'string',
              description: 'If this is a classification step, the determined classification (optional)'
            }
          },
          required: ['userMessage', 'elicitationRequired']
        }
      }
    };

    logger.info(`✅ [GENERIC AI] Template created for ${stepAction} (elicitation: ${needsUserInput})`);
    return template;
  }

}

module.exports = { AgentExecutor };