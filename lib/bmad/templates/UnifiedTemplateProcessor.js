/**
 * Unified Template Processor
 * Consolidates functionality from both BMAD document template processing and agent execution templates
 * 
 * Features:
 * - Document template processing (YAML-based with elicitation)
 * - Agent execution template loading and processing
 * - Conversational template generation
 * - Variable substitution and conditional logic
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { validateFilePath } = require('../../utils/fileValidator');
import logger from '../../utils/logger.js';

class UnifiedTemplateProcessor {
  constructor(configurationManager, agentActivationEngine) {
    this.configManager = configurationManager;
    this.agentEngine = agentActivationEngine;
  }

  /**
   * Load template file
   * Supports both YAML and Markdown templates
   */
  async loadTemplate(templateIdentifier) {
    logger.info(`📋 [TEMPLATE LOAD] Loading template: ${templateIdentifier}`);
    
    try {
      const templatePath = this.resolveTemplatePath(templateIdentifier);
      validateFilePath(templatePath);
      
      const content = await fs.readFile(templatePath, 'utf8');
      let template;
      
      if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
        template = yaml.load(content);
        this.validateTemplate(template, templateIdentifier);
      } else if (templatePath.endsWith('.md')) {
        template = { content, type: 'markdown' };
      } else {
        throw new Error(`Unsupported template format: ${templatePath}`);
      }
      
      logger.info(`✅ [TEMPLATE LOADED] Template loaded: ${templateIdentifier}`);
      return template;
      
    } catch (error) {
      logger.error(`❌ [TEMPLATE ERROR] Failed to load template ${templateIdentifier}: ${error.message}`);
      throw new Error(`Failed to load template ${templateIdentifier}: ${error.message}`);
    }
  }

  /**
   * Resolve template path with proper precedence
   */
  resolveTemplatePath(templateIdentifier) {
    // If absolute path, use as-is
    if (path.isAbsolute(templateIdentifier)) {
      return templateIdentifier;
    }

    // If contains path separators, resolve relative to cwd
    if (templateIdentifier.includes('/') || templateIdentifier.includes('\\')) {
      return path.resolve(templateIdentifier);
    }

    // For simple names, determine path based on extension or content type
    let fullPath;
    if (templateIdentifier.endsWith('.yaml') || templateIdentifier.endsWith('.yml')) {
      const templatesPath = this.configManager?.getBmadCorePaths()?.templates || 
                           path.join(process.cwd(), '.bmad-core', 'templates');
      fullPath = path.join(templatesPath, templateIdentifier);
    } else if (templateIdentifier.endsWith('.md')) {
      fullPath = path.join(process.cwd(), '.bmad-core', 'tasks', templateIdentifier);
    } else {
      // Default to YAML template
      const templatesPath = this.configManager?.getBmadCorePaths()?.templates || 
                           path.join(process.cwd(), '.bmad-core', 'templates');
      fullPath = path.join(templatesPath, `${templateIdentifier}.yaml`);
    }

    return fullPath;
  }

  /**
   * Load task file
   */
  async loadTaskFile(taskFileName) {
    try {
      const taskPath = path.join(process.cwd(), '.bmad-core', 'tasks', taskFileName);
      const content = await fs.readFile(taskPath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`❌ [TASK LOAD ERROR] Failed to load task file ${taskFileName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate template structure
   */
  validateTemplate(template, templateName) {
    if (!template || typeof template !== 'object') {
      throw new Error(`Template ${templateName} is not a valid object.`);
    }
    
    // Validate document template structure (BMAD format)
    if (template.template) {
      if (!template.template.id || !template.template.name) {
        throw new Error(`Template ${templateName} is missing required metadata (id, name).`);
      }
      // Check for sections - they can be at root level OR under template
      const sections = template.sections || template.template.sections;
      if (!sections || !Array.isArray(sections)) {
        throw new Error(`Template ${templateName} is missing a valid 'sections' array.`);
      }
    }
    
    // Agent execution templates have different structure - no validation needed
  }

  /**
   * Process document template (original BMAD functionality)
   */
  async processDocumentTemplate(templateName, context, activeAgentId) {
    const template = await this.loadTemplate(templateName);
    
    // Check for interactive mode at workflow level
    if (template.workflow?.mode === 'interactive') {
      logger.info(`🔄 [TEMPLATE] Interactive template detected: ${templateName}`);
      
      const sections = template.sections || template.template.sections || [];
      const introSection = sections.find(s => s.id === 'introduction');
      if (introSection) {
        const naturalInstruction = introSection.instruction || 
          `Let's work together to create a comprehensive project brief. I'll guide you through the process.`;

        return {
          status: 'elicitation_required',
          elicitation: {
            sectionId: 'introduction',
            sectionTitle: 'Project Brief Setup', 
            instruction: naturalInstruction,
            agentId: activeAgentId,
            agentName: 'Project Analyst',
            templateName: templateName,
            interactiveMode: true,
            customElicitation: template.workflow.custom_elicitation || null
          },
          partialDocument: `# ${this.replaceVariables(template.template.title || template.template.name, context)}\n`
        };
      }
    }

    const output = [];
    let elicitationRequired = null;

    // Process the main title
    const title = this.replaceVariables(template.template.title || template.template.name, context);
    output.push(`# ${title}\n`);

    // Process all top-level sections (handle nested structure)
    const sections = template.sections || template.template.sections || [];
    for (const section of sections) {
      const sectionResult = await this.processSection(section, context, activeAgentId, 1);
      
      if (sectionResult.elicitation) {
        elicitationRequired = sectionResult.elicitation;
        break;
      }
      
      output.push(sectionResult.content);
    }

    if (elicitationRequired) {
      return {
        status: 'elicitation_required',
        elicitation: elicitationRequired,
        partialDocument: output.join('\n'),
      };
    }

    return {
      status: 'completed',
      document: output.join('\n'),
    };
  }

  /**
   * Process a single section (recursive)
   */
  async processSection(section, context, activeAgentId, level) {
    // Permission checks
    if (this.agentEngine && !this.agentEngine.canAgentEditSection(activeAgentId, section.id)) {
      return { content: `<!-- Agent ${activeAgentId} does not have permission to edit this section. -->\n` };
    }

    // Conditional logic
    if (section.condition && !this.evaluateCondition(section.condition, context)) {
      return { content: '' };
    }
    
    let content = '';
    const title = this.replaceVariables(section.title, context);
    content += `${'#'.repeat(level + 1)} ${title}\n\n`;

    const instruction = this.replaceVariables(section.instruction, context);

    // Check for elicitation - support both formats
    const needsElicitation = section.elicit || 
                             (section.elicitation && section.elicitation.required);
    
    if (needsElicitation) {
      const elicitationMethods = await this.getElicitationMethods();
      return {
        elicitation: {
          sectionId: section.id,
          sectionTitle: title,
          instruction: instruction,
          choices: elicitationMethods,
        }
      };
    }
    
    // Process different section types
    switch (section.type) {
      case 'bullet-list':
        content += this.processList(section, context, '*');
        break;
      case 'numbered-list':
        content += this.processList(section, context, '1.');
        break;
      case 'table':
        content += this.processTable(section, context);
        break;
      case 'code-block':
        content += this.processCodeBlock(section, context);
        break;
      default:
        content += `${instruction || 'Content to be generated by LLM.'}\n\n`;
        break;
    }

    // Process nested sections
    if (section.sections && Array.isArray(section.sections)) {
      for (const subSection of section.sections) {
        const subSectionResult = await this.processSection(subSection, context, activeAgentId, level + 1);
        if (subSectionResult.elicitation) {
          return subSectionResult;
        }
        content += subSectionResult.content;
      }
    }

    return { content };
  }

  /**
   * Parse compound command definitions
   */
  parseCompoundCommand(commandDefinition) {
    if (!commandDefinition || typeof commandDefinition !== 'string') {
      return null;
    }

    // Parse commands like "use task create-doc with project-brief-tmpl.yaml"
    const taskPattern = /use\s+task\s+([a-zA-Z0-9\-_]+)\s+with\s+([a-zA-Z0-9\-_]+(?:\.yaml)?)/i;
    const match = commandDefinition.match(taskPattern);
    
    if (match) {
      const [, taskName, templateName] = match;
      return {
        type: 'task',
        taskName,
        templateName: templateName.endsWith('.yaml') ? templateName : `${templateName}.yaml`,
        originalCommand: commandDefinition
      };
    }

    // Parse simple template references
    const templatePattern = /([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i;
    const templateMatch = commandDefinition.match(templatePattern);
    
    if (templateMatch) {
      let templateName = templateMatch[1];
      if (!templateName.endsWith('.yaml')) {
        if (!templateName.endsWith('-tmpl')) {
          templateName += '-tmpl';
        }
        templateName += '.yaml';
      }
      
      return {
        type: 'template',
        templateName,
        originalCommand: commandDefinition
      };
    }

    return null;
  }

  /**
   * Create conversational template for interactive mode
   */
  createConversationalTemplate(context, agent, stepNotes, stepAction) {
    const userMessage = context.userPrompt || context.message || '';
    const userQuestion = this.extractUserQuestion(stepNotes);
    
    return {
      name: `conversational-${agent.id}`,
      description: `Conversational interaction for ${agent.agent?.name || agent.id}`,
      workflow: {
        mode: 'conversational',
        context: {
          stepNotes,
          stepAction,
          userMessage,
          userQuestion,
          agentRole: agent.agent?.title || agent.id,
          agentExpertise: agent.persona?.focus || agent.persona?.expertise
        }
      },
      elicitation: userQuestion ? [
        {
          question: userQuestion,
          field: 'user_response',
          type: 'text',
          required: false
        }
      ] : [],
      prompt: this.buildConversationalPrompt(agent, stepNotes, userMessage, userQuestion)
    };
  }

  /**
   * Create generic processing template
   */
  createGenericProcessingTemplate(context, agent) {
    const { PromptBuilder } = require('../execution/PromptBuilder.js');
    
    const promptContext = {
      workflowMode: true,
      userPrompt: context.userPrompt || context.message || '',
      stepNotes: context.stepNotes,
      notes: context.stepNotes,
      action: context.action || 'process request'
    };
    
    const promptBuilder = new PromptBuilder(agent, null, promptContext);
    const prompt = promptBuilder.buildWorkflowPrompt();
    
    const agentInfo = agent.agent || {};
    
    return {
      name: `generic-${agent.id}`,
      description: `Generic processing template for ${agentInfo.name || agent.id}`,
      workflow: {
        mode: 'processing',
        agent: agent.id
      },
      prompt: prompt.trim()
    };
  }

  /**
   * Determine template based on context and agent
   */
  async determineTemplate(agent, context, templateDetector) {
    try {
      logger.info(`[UNIFIED TEMPLATE] determineTemplate - Agent: ${agent?.id}, Context Action: ${context?.action}`);
      
      // Check if this is an interactive step that doesn't need a template
      // BUT NOT for classification steps which always need templates
      if (this.isInteractiveStep(context, agent) && context.action !== 'classify enhancement scope') {
        logger.info(`🔄 [INTERACTIVE] Agent ${agent?.id} is in interactive mode - no template needed`);
        return null;
      }
      
      // Special handling for classification - always use template
      if (context.action === 'classify enhancement scope') {
        logger.info(`🎯 [CLASSIFICATION] Forcing template detection for classification step`);
        // Continue with template detection strategies
      }

      // Strategy 1: Enhanced template detection
      logger.info(`🔍 [TEMPLATE DETECTION] Starting template detection for action: ${context.action}`);
      const detectedTemplate = await templateDetector.enhancedTemplateDetection(context, agent);
      if (detectedTemplate) {
        logger.info(`📋 [TEMPLATE DETECTED] Using detected template: ${detectedTemplate}`);
        const loadedTemplate = await this.loadTemplate(detectedTemplate);
        if (loadedTemplate) {
          logger.info(`✅ [TEMPLATE LOADED] Successfully loaded template: ${detectedTemplate}`);
          return loadedTemplate;
        } else {
          logger.error(`❌ [TEMPLATE LOAD FAILED] Failed to load template: ${detectedTemplate}`);
        }
      } else {
        logger.warn(`⚠️ [TEMPLATE DETECTION] No template detected for action: ${context.action}`);
      }

      // Strategy 2: Command-based template mapping  
      if (context.creates && agent.commands) {
        const command = templateDetector.mapCreatesToCommand(context.creates, agent);
        if (command) {
          const commandDef = agent.commands.find(cmd => 
            (typeof cmd === 'string' && cmd.includes(command)) ||
            (typeof cmd === 'object' && Object.keys(cmd)[0] === command)
          );
          
          if (commandDef) {
            const commandText = typeof commandDef === 'string' ? commandDef : commandDef[command];
            const parsed = this.parseCompoundCommand(commandText);
            if (parsed && parsed.templateName) {
              logger.info(`📋 [COMMAND TEMPLATE] Using template from command: ${parsed.templateName}`);
              return await this.loadTemplate(parsed.templateName);
            }
          }
        }
      }

      // Strategy 3: Extract template from notes
      const notesTemplate = templateDetector.extractTemplateFromNotes(context.stepNotes);
      if (notesTemplate) {
        logger.info(`📋 [NOTES TEMPLATE] Using template from notes: ${notesTemplate}`);
        return await this.loadTemplate(notesTemplate);
      }

      // Strategy 4: Infer from context
      const inferredTemplate = templateDetector.inferTemplateFromContext(context, agent);
      if (inferredTemplate) {
        logger.info(`📋 [INFERRED TEMPLATE] Using inferred template: ${inferredTemplate}`);
        return await this.loadTemplate(inferredTemplate);
      }

      // Strategy 5: Create appropriate template based on context
      if (context.chatMode || this.shouldUseConversationalMode(context, agent)) {
        logger.info(`💬 [CONVERSATIONAL] Creating conversational template for agent ${agent?.id}`);
        return this.createConversationalTemplate(context, agent, context.stepNotes, context.action);
      }

      // Fallback: Generic processing template
      logger.info(`🔧 [GENERIC] Creating generic processing template for agent ${agent?.id}`);
      return this.createGenericProcessingTemplate(context, agent);

    } catch (error) {
      logger.error(`❌ [TEMPLATE ERROR] Template determination failed: ${error.message}`);
      return this.createGenericProcessingTemplate(context, agent);
    }
  }

  // Helper methods from original implementations
  replaceVariables(text = '', context = {}) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      return context[variableName] || match;
    });
  }

  async getElicitationMethods() {
    return [
      { id: 'proceed', title: 'Proceed as instructed' },
      { id: 'clarify', title: 'Ask clarifying questions' },
      { id: 'brainstorm', title: 'Brainstorm alternative approaches' },
      { id: 'analogy', title: 'Explain with an analogy' },
    ];
  }
  
  evaluateCondition(condition, context) {
    // Simple condition evaluation - can be expanded
    return true;
  }

  extractUserQuestion(stepNotes) {
    if (!stepNotes) return null;
    
    const questionMarkers = [
      /user\s+(?:asks?|questions?)[:\s]+(.*?)(?:\n|$)/i,
      /question[:\s]+(.*?)(?:\n|$)/i,
      /\?\s*(.*?)(?:\n|$)/i
    ];
    
    for (const marker of questionMarkers) {
      const match = stepNotes.match(marker);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  buildConversationalPrompt(agent, stepNotes, userMessage, userQuestion) {
    const { PromptBuilder } = require('../execution/PromptBuilder.js');
    
    const context = {
      chatMode: true,
      userPrompt: userMessage,
      stepNotes: stepNotes,
      notes: stepNotes
    };
    
    const promptBuilder = new PromptBuilder(agent, null, context);
    return promptBuilder.buildChatPrompt();
  }

  isInteractiveStep(context, agent) {
    // Only specific interactive templates should be treated as interactive
    return context.interactiveMode || 
           context.templateName === 'project-brief-tmpl' ||
           (context.chatMode && context.userPrompt);
    // REMOVED: Generic elicitation check that was preventing template processing
  }

  shouldUseConversationalMode(context, agent) {
    return context.chatMode || 
           (context.userPrompt && context.userPrompt.includes('?')) ||
           (context.stepNotes && (context.stepNotes.includes('user asks') || context.stepNotes.includes('question:')));
  }

  // Placeholder methods for list/table/code processing
  processList(section, context, marker) {
    return `${marker} List item placeholder\n\n`;
  }

  processTable(section, context) {
    return `| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |\n\n`;
  }

  processCodeBlock(section, context) {
    return `\
\
\
// Code placeholder
\
\
\
`;
  }
}

module.exports = { UnifiedTemplateProcessor };
