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
const { ElicitationHandler } = require('./execution/ElicitationHandler.js');
import logger from '../utils/logger.js';

const isServer = typeof window === 'undefined';

class AgentExecutor {
  constructor(agentLoader, aiService) {
    this.aiService = aiService;
    this.agentLoader = agentLoader;
    this.elicitationHandler = new ElicitationHandler(this.aiService);
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
      this.elicitationHandler = new ElicitationHandler(this.aiService);
      console.log('AgentExecutor aiService updated:', !!this.aiService);
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
    logger.debug('AgentExecutor - Context in executeAgent:', context);

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
      const template = await this.determineTemplate(agent, context);
      
      if (!template && context.action !== 'elicit') {
        // Only warn if it's not an elicitation step
        logger.warn('No suitable template found for agent');
      }

      // Handle elicitation steps without templates
      let result;
      if (context.action === 'elicit') {
        logger.info('Executing elicitation step - waiting for user input');
        result = await this.handleElicitationStep(agent, context);
      } else if (template) {
        // UNIFIED RETRY LOOP - handles both timeout and validation
        result = await this.executeWithUnifiedRetries(agent, template, context, config);
      } else {
        // No template found and not an elicitation step
        result = {
          success: false,
          error: 'No suitable template found for agent and not an elicitation step',
          artifacts: [],
          messages: [`Agent ${agent.id} could not find a suitable template`],
          type: 'template_error'
        };
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
      
      return {
        agentId: agent.id,
        agentName: agent.agent?.name || agent.id,
        executionTime,
        success: false,
        error: error.message,
        timedOut: error.message.includes('timed out') || error.message.includes('timeout'),
        attempts: config.maxRetries
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
    const sections = template.sections || [];
    const parsedContext = new PromptBuilder(agent, template, context).parseUserPrompt(context.userPrompt || '');
    
    for (const section of sections) {
      if (section.elicitation?.required && !parsedContext[section.id]) {
        return await this.elicitationHandler.handle(section, parsedContext, agent);
      }
    }

    const prompt = new PromptBuilder(agent, template, context).build();
    return await this.callAIService(prompt, agent, attempt, context);
  }

  async callAIService(prompt, agent, attempt, context = null) {
    if (!this.aiService) {
      const fallbackProvider = new FallbackProvider();
      return fallbackProvider.generateResponse(agent, context);
    }

    try {
      const complexity = this.calculateComplexity(prompt);
      const userId = context?.userId || context?.workflowContext?.initiatedBy;
      
      const response = await this.aiService.call(prompt, agent, complexity, context, userId);
      
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

  // Rest of the methods remain the same as original AgentExecutor
  async determineTemplate(agent, context) {
    logger.debug('AgentExecutor - Context in determineTemplate:', context);
    
    try {
      // Handle different workflow step types
      const commandName = context.command;
      const action = context.action;
      let templatePath = null;

      // For elicitation steps, we don't need a template - they're interactive
      if (action === 'elicit') {
        logger.info(`Step with action 'elicit' - no template needed for interactive step`);
        return null; // This is expected for elicitation steps
      }

      // Handle command-based steps
      if (commandName) {
        // Find the command definition within the agent's commands
        if (agent.commands && Array.isArray(agent.commands)) {
          for (const cmd of agent.commands) {
            // Commands can be simple strings or objects
            if (typeof cmd === 'string' && cmd === commandName) {
              // If it's a simple string command, it might not have a template directly
              // This case might need further refinement based on how simple commands are handled
              break; 
            } else if (typeof cmd === 'object' && Object.keys(cmd)[0] === commandName) {
              const commandDefinition = cmd[commandName];
              if (commandDefinition && commandDefinition.uses) {
                templatePath = commandDefinition.uses;
                break;
              }
            }
          }
        }

        if (!templatePath) {
          logger.warn(`Agent ${agent.id} command ${commandName} has no associated template defined.`);
          return null;
        }
      } else if (!action) {
        // No command and no action specified
        logger.warn(`Step has no command or action specified`);
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
      console.error(`Error determining template for agent ${agent.id} command ${context.command}:`, error?.message || 'ERROR');
      return null;
    }
  }

  async loadTemplateFile(templatePath) {
    try {
      const normalizedPath = path.resolve(templatePath);
      validateFilePath(normalizedPath);
      
      const content = await fs.readFile(normalizedPath, 'utf8');
      return yaml.load(content);
    } catch (error) {
      throw new Error(`Failed to load template file ${templatePath}: ${error.message}`);
    }
  }

  async handleElicitationStep(agent, context) {
    logger.info('🔍 [ELICITATION DEBUG] Handling elicitation step for agent:', agent.id);
    logger.info('🔍 [ELICITATION DEBUG] Context data:', {
      step: context.step,
      action: context.action,
      notes: context.notes?.substring(0, 200) + (context.notes?.length > 200 ? '...' : ''),
      stepNotes: context.stepNotes?.substring(0, 100) + (context.stepNotes?.length > 100 ? '...' : ''),
      userPrompt: context.userPrompt?.substring(0, 100) + (context.userPrompt?.length > 100 ? '...' : ''),
      hasAiService: !!this.aiService
    });
    
    try {
      // Use the existing agent template to generate elicitation text
      let agentGeneratedText = null;
      
      if (this.aiService && agent.agent) {
        logger.info('🤖 [AGENT TEMPLATE] Using existing agent template for elicitation');
        
        const userId = context.userId || context.workflowContext?.initiatedBy;
        try {
          // Create specific elicitation prompt that includes the workflow notes
          const workflowNotes = context.stepNotes || context.notes;
          
          logger.info('🔍 [AGENT DEBUG] Workflow notes content:');
          logger.info('  - stepNotes length:', context.stepNotes?.length);
          logger.info('  - notes length:', context.notes?.length);
          logger.info('  - stepNotes content:', context.stepNotes);
          logger.info('  - notes content:', context.notes);
          logger.info('  - workflowNotes (final):', workflowNotes);
          
          const elicitationPrompt = `You are ${agent.agent?.name || agent.id}, a ${agent.agent?.title || 'project specialist'}.

The user described their project as: "${context.userPrompt || context.workflowContext?.userPrompt || 'User is working on a project'}"

WORKFLOW STEP: ${context.step || 'elicitation'}

SPECIFIC INSTRUCTIONS FOR THIS STEP:
${workflowNotes || 'Gather information from the user to continue the workflow.'}

Follow these instructions exactly. Ask the specific question mentioned in the workflow instructions. Introduce yourself first, then ask the exact question specified.`;
          
          const agentResponse = await this.aiService.call(elicitationPrompt, agent, 1, context, userId);
          
          if (agentResponse && agentResponse.content && agentResponse.content.trim().length > 0) {
            agentGeneratedText = agentResponse.content.trim();
            logger.info('🤖 [AGENT TEMPLATE] Agent generated response using template:', {
              textLength: agentGeneratedText.length,
              textPreview: agentGeneratedText.substring(0, 300) + (agentGeneratedText.length > 300 ? '...' : '')
            });
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

      logger.info('🔍 [ELICITATION DEBUG] Created section:', {
        id: section.id,
        title: section.title?.substring(0, 100) + (section.title?.length > 100 ? '...' : ''),
        instructionLength: section.instruction?.length,
        hasInstruction: !!section.instruction,
        hasAgentGeneratedText: !!agentGeneratedText
      });

      // Create parsed context for ElicitationHandler
      const parsedContext = {
        projectDescription: context.userPrompt || context.workflowContext?.userPrompt || 'Current workflow project',
        workflowStep: context.step,
        agentRole: agent.agent?.name || agent.id,
        userId: context.userId || context.workflowContext?.initiatedBy
      };

      logger.info('🔍 [ELICITATION DEBUG] About to call ElicitationHandler with aiService:', !!this.aiService);
      logger.info('🔍 [ELICITATION DEBUG] Context being passed to ElicitationHandler:', {
        hasUserId: !!(context.userId || context.workflowContext?.initiatedBy),
        userId: context.userId || context.workflowContext?.initiatedBy,
        contextKeys: Object.keys(context),
        hasAgentText: !!agentGeneratedText
      });

      // Use ElicitationHandler to process agent text (if available) or generate new question
      const elicitationResult = await this.elicitationHandler.handle(agent, section, { 
        parsedContext, 
        userId: context.userId || context.workflowContext?.initiatedBy,
        workflowContext: context.workflowContext 
      }, agentGeneratedText);
      
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
}

module.exports = { AgentExecutor };