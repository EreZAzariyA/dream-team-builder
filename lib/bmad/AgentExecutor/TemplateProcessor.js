/**
 * Template Processor
 * Handles template loading, processing, and command parsing
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
import logger from '../../utils/logger.js';

class TemplateProcessor {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Load template file with caching
   */
  async loadTemplateFile(templatePath) {
    const cacheKey = `template_${templatePath}`;
    const cached = this.cacheManager.getTemplate(cacheKey);
    if (cached) {
      logger.info(`📋 [TEMPLATE CACHE] Using cached template: ${templatePath}`);
      return cached;
    }

    logger.info(`📋 [TEMPLATE LOAD] Loading template: ${templatePath}`);
    
    try {
      let fullPath;
      if (!templatePath.includes('/') && !templatePath.includes('\\')) {
        // Relative path - check templates directory first
        if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
          fullPath = path.join(process.cwd(), '.bmad-core', 'templates', templatePath);
        } else if (templatePath.endsWith('.md')) {
          // Task files are in tasks directory
          fullPath = path.join(process.cwd(), '.bmad-core', 'tasks', templatePath);
        } else {
          // Default to templates with .yaml extension
          fullPath = path.join(process.cwd(), '.bmad-core', 'templates', `${templatePath}.yaml`);
        }
      } else {
        fullPath = path.resolve(templatePath);
      }

      const content = await fs.readFile(fullPath, 'utf8');
      let template;
      
      if (fullPath.endsWith('.yaml') || fullPath.endsWith('.yml')) {
        template = yaml.load(content);
      } else {
        // For .md files, return as string
        template = { content, type: 'markdown' };
      }
      
      this.cacheManager.setTemplate(cacheKey, template);
      logger.info(`✅ [TEMPLATE LOADED] Template cached: ${templatePath}`);
      return template;
      
    } catch (error) {
      logger.error(`❌ [TEMPLATE ERROR] Failed to load template ${templatePath}: ${error.message}`);
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  /**
   * Load task file with caching
   */
  async loadTaskFile(taskFileName) {
    const cacheKey = `task_${taskFileName}`;
    const cached = this.cacheManager.getTask(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const taskPath = path.join(process.cwd(), '.bmad-core', 'tasks', taskFileName);
      const content = await fs.readFile(taskPath, 'utf8');
      
      this.cacheManager.setTask(cacheKey, content);
      return content;
    } catch (error) {
      logger.error(`❌ [TASK LOAD ERROR] Failed to load task file ${taskFileName}: ${error.message}`);
      throw error;
    }
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
    
    // Extract user question if present
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
   * Extract user question from step notes
   */
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

  /**
   * Build conversational prompt
   */
  buildConversationalPrompt(agent, stepNotes, userMessage, userQuestion) {
    const agentInfo = agent.agent || {};
    const persona = agent.persona || {};
    
    let prompt = `You are ${agentInfo.name || agent.id}, ${agentInfo.title || 'an AI assistant'}.`;
    
    if (persona.focus) {
      prompt += ` Your expertise is in ${persona.focus}.`;
    }
    
    if (stepNotes) {
      prompt += `\n\nContext: ${stepNotes}`;
    }
    
    if (userQuestion) {
      prompt += `\n\nThe user asked: "${userQuestion}"`;
    }
    
    if (userMessage && userMessage !== userQuestion) {
      prompt += `\n\nUser message: "${userMessage}"`;
    }
    
    prompt += `\n\nProvide a helpful, informative response based on your expertise. Keep your response conversational and engaging.`;
    
    return prompt;
  }

  /**
   * Create generic processing template
   */
  createGenericProcessingTemplate(context, agent) {
    const agentInfo = agent.agent || {};
    const persona = agent.persona || {};
    const userMessage = context.userPrompt || context.message || '';
    
    // Build a comprehensive prompt based on agent capabilities
    let prompt = '';
    
    // Agent introduction
    if (agentInfo.name && agentInfo.title) {
      prompt += `You are ${agentInfo.name}, ${agentInfo.title}.\n\n`;
    }
    
    // Agent expertise and persona
    if (persona.focus) {
      prompt += `Your expertise: ${persona.focus}\n`;
    }
    if (persona.personality) {
      prompt += `Your personality: ${persona.personality}\n`;
    }
    if (persona.capabilities && Array.isArray(persona.capabilities)) {
      prompt += `Your capabilities:\n${persona.capabilities.map(cap => `- ${cap}`).join('\n')}\n`;
    }
    
    // Context information
    if (context.stepNotes) {
      prompt += `\nContext: ${context.stepNotes}\n`;
    }
    if (context.action) {
      prompt += `Action requested: ${context.action}\n`;
    }
    
    // User message
    prompt += `\nUser request: ${userMessage}\n\n`;
    
    // Instructions
    prompt += `Please provide a helpful response based on your expertise and the context provided. `;
    
    // Add specific instructions based on agent type
    if (agent.id === 'analyst') {
      prompt += `Focus on analysis, research, and strategic insights.`;
    } else if (agent.id === 'pm') {
      prompt += `Focus on product management, requirements, and project planning.`;
    } else if (agent.id === 'architect') {
      prompt += `Focus on system architecture, technical design, and implementation planning.`;
    } else if (agent.id === 'dev') {
      prompt += `Focus on development, coding solutions, and technical implementation.`;
    } else if (agent.id === 'qa') {
      prompt += `Focus on quality assurance, testing strategies, and quality metrics.`;
    } else {
      prompt += `Use your expertise to provide the most helpful response possible.`;
    }
    
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
      logger.info(`[TEMPLATE PROCESSOR] determineTemplate - Agent: ${agent?.id}, Context Action: ${context?.action}, Context Uses: ${context?.uses}`);
      
      // Check if this is an interactive step that doesn't need a template
      if (this.isInteractiveStep(context, agent)) {
        logger.info(`🔄 [INTERACTIVE] Agent ${agent?.id} is in interactive mode - no template needed`);
        return null;
      }

      // Strategy 1: Enhanced template detection
      const detectedTemplate = await templateDetector.enhancedTemplateDetection(context, agent);
      if (detectedTemplate) {
        logger.info(`📋 [TEMPLATE DETECTED] Using detected template: ${detectedTemplate}`);
        return await this.loadTemplateFile(detectedTemplate);
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
              return await this.loadTemplateFile(parsed.templateName);
            }
          }
        }
      }

      // Strategy 3: Extract template from notes
      const notesTemplate = templateDetector.extractTemplateFromNotes(context.stepNotes);
      if (notesTemplate) {
        logger.info(`📋 [NOTES TEMPLATE] Using template from notes: ${notesTemplate}`);
        return await this.loadTemplateFile(notesTemplate);
      }

      // Strategy 4: Infer from context
      const inferredTemplate = templateDetector.inferTemplateFromContext(context, agent);
      if (inferredTemplate) {
        logger.info(`📋 [INFERRED TEMPLATE] Using inferred template: ${inferredTemplate}`);
        return await this.loadTemplateFile(inferredTemplate);
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
      // Return fallback template
      return this.createGenericProcessingTemplate(context, agent);
    }
  }

  /**
   * Check if this is an interactive step
   */
  isInteractiveStep(context, agent) {
    // Check for interactive markers
    if (context.interactiveMode || context.templateName === 'project-brief-tmpl') {
      return true;
    }

    // Check for conversational context
    if (context.chatMode && context.userPrompt) {
      return true;
    }

    // Check for elicitation context
    if (context.elicitationEnabled !== false && context.userPrompt) {
      return true;
    }

    return false;
  }

  /**
   * Check if should use conversational mode
   */
  shouldUseConversationalMode(context, agent) {
    // If in chat mode
    if (context.chatMode) {
      return true;
    }

    // If user prompt is a question
    if (context.userPrompt && context.userPrompt.includes('?')) {
      return true;
    }

    // If step notes indicate conversation
    const stepNotes = context.stepNotes || '';
    if (stepNotes.includes('user asks') || stepNotes.includes('question:')) {
      return true;
    }

    return false;
  }
}

module.exports = { TemplateProcessor };