/**
 * Elicitation Manager
 * Handles elicitation, interactive templates, and user interaction flows
 */

const fs = require('fs').promises;
const path = require('path');
import logger from '../../utils/logger.js';

class ElicitationManager {
  constructor(configurationManager) {
    this.configurationManager = configurationManager;
  }

  /**
   * Handle elicitation step
   */
  async handleElicitationStep(agent, context) {
    logger.info(`🔄 [ELICITATION] Starting elicitation for agent ${agent?.id}`);
    
    try {
      // Check if we're in interactive template mode
      if (context.templateName === 'project-brief-tmpl' || context.interactiveMode) {
        return await this.handleInteractiveTemplate(agent, context);
      }

      // Regular elicitation flow
      const elicitationQuestions = await this.generateElicitationQuestions(agent, context);
      
      if (elicitationQuestions.length === 0) {
        logger.warn(`⚠️ [ELICITATION] No questions generated - generating fallback question`);
        
        let fallbackQuestion;
        try {
          fallbackQuestion = await this.generateFallbackQuestion(agent, context);
        } catch (fallbackError) {
          logger.warn(`⚠️ [ELICITATION] AI fallback failed, using static fallback: ${fallbackError.message}`);
          // Static fallback when AI service is unavailable
          const actionContext = context.action || 'your request';
          fallbackQuestion = `I'd like to understand more about ${actionContext}. Could you provide additional details about what you'd like to accomplish?`;
        }
        
        return {
          success: true,
          content: fallbackQuestion,
          type: 'elicitation_pause',
          elicitationComplete: false, // CRITICAL: Keep as false to pause workflow
          requiresUserInput: true, // CRITICAL: Signal that workflow should pause
          artifacts: []
        };
      }

      // Present questions to user
      const questionList = elicitationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      
      // Generate dynamic intro message with fallback
      let introMessage;
      try {
        introMessage = await this.generateIntroMessage(agent, context, elicitationQuestions);
      } catch (introError) {
        logger.warn(`⚠️ [ELICITATION] Intro generation failed, using static intro: ${introError.message}`);
        // Static intro when AI service is unavailable
        introMessage = `To help you better, I have a few questions:`;
      }
      
      return {
        success: true, // Mark as successful elicitation trigger
        content: `${introMessage}\n\n${questionList}`,
        type: 'elicitation_questions',
        questions: elicitationQuestions,
        elicitationComplete: false,
        artifacts: []
      };

    } catch (error) {
      logger.error(`❌ [ELICITATION ERROR] Elicitation failed: ${error.message}`);
      
      // Try to generate AI fallback, but if that fails too, use static fallback
      let errorFallback;
      try {
        errorFallback = await this.generateErrorFallback(agent, context);
      } catch (fallbackError) {
        logger.warn(`⚠️ [ELICITATION] AI fallback failed, using static fallback: ${fallbackError.message}`);
        // Static fallback when AI service is completely unavailable
        const agentName = agent?.name || agent?.id || 'assistant';
        errorFallback = `I need more information to help you with this ${context.action || 'task'}. Could you provide additional details about your requirements?`;
      }
      
      return {
        success: true, // Mark as successful even in fallback case
        content: errorFallback,
        type: 'elicitation_fallback',
        elicitationComplete: false, // CRITICAL: Keep as false to pause workflow
        requiresUserInput: true, // CRITICAL: Signal that workflow should pause
        artifacts: []
      };
    }
  }

  async generateElicitationQuestions(agent, context) {
    try {
      const { AIService } = await import('../../ai/AIService.js');
      const aiService = AIService.getInstance();

      // Try to initialize AI service if it's not ready
      if (!aiService || !aiService.initialized) {
        if (context.userId) {
          logger.info(`🔄 [ELICITATION] AI service not initialized, trying to initialize with userId: ${context.userId}`);
          try {
            const reinitSuccess = await aiService.reinitializeWithUserKeys(null, context.userId);
            if (!reinitSuccess) {
              logger.warn(`⚠️ [ELICITATION] Failed to initialize AI service for user ${context.userId}`);
              return [];
            }
          } catch (initError) {
            logger.warn(`⚠️ [ELICITATION] AI service initialization failed: ${initError.message}`);
            return [];
          }
        } else {
          logger.warn('❌ [ELICITATION] AI service not initialized and no userId provided in context.');
          return [];
        }
      }

      const prompt = `
        You are the ${agent.name} agent. Your current task is: "${context.action || 'not specified'}".
        The user has provided the following prompt: "${context.userPrompt || 'not specified'}".
        Based on your role and the task, generate a list of 2-3 clarifying questions to ask the user to better understand their requirements.
        Return the questions as a JSON array of strings. For example: ["What is the primary goal of this feature?", "Who is the target audience?"].
      `;

      const response = await aiService.call(prompt, agent, 'simple', context);

      if (response && response.content) {
        try {
          const questions = JSON.parse(response.content);
          if (Array.isArray(questions)) {
            return questions;
          }
        } catch (e) {
          logger.error('Failed to parse elicitation questions from AI response:', e);
        }
      }
      return [];
    } catch (error) {
      logger.error('Failed to generate elicitation questions:', error);
      return [];
    }
  }

  /**
   * Create mock execution for testing
   */
  createMockExecution(agent, context) {
    const agentInfo = agent.agent || {};
    const userMessage = context.userPrompt || context.message || '';
    
    const mockResponses = {
      'analyst': `As ${agentInfo.name || 'an analyst'}, I would analyze the requirements and provide strategic insights for: "${userMessage}"`,
      'pm': `As ${agentInfo.name || 'a product manager'}, I would create specifications and manage the project for: "${userMessage}"`,
      'architect': `As ${agentInfo.name || 'a system architect'}, I would design the technical architecture for: "${userMessage}"`,
      'dev': `As ${agentInfo.name || 'a developer'}, I would implement the solution for: "${userMessage}"`,
      'qa': `As ${agentInfo.name || 'a QA engineer'}, I would create testing strategies for: "${userMessage}"`
    };

    const response = mockResponses[agent.id] || `As ${agentInfo.name || agent.id}, I would help with: "${userMessage}"`;
    
    return {
      content: response,
      executionTime: Math.floor(1000 + Math.random() * 2000),
      tokensUsed: 0,
      model: 'mock'
    };
  }

  /**
   * Handle interactive template flow
   */
  async handleInteractiveTemplate(agent, context) {
    logger.info(`🔄 [INTERACTIVE TEMPLATE] Handling interactive template for ${context.templateName}`);
    
    try {
      // Check if this is a follow-up interaction
      if (context.userPrompt && context.templateName) {
        logger.info(`💬 [INTERACTIVE] Processing user response for ${context.templateName}`);
        
        // Generate appropriate response based on the template and user input
        const response = await this.generateInteractiveResponse(agent, context);
        return response;
      }

      // Initial interactive template presentation
      const template = await this.loadInteractiveTemplate(context.templateName);
      if (template && template.elicitation) {
        const questions = template.elicitation.map(item => item.question).slice(0, 3); // Limit questions
        const questionList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        const templateIntro = await this.generateTemplateIntroMessage(agent, context, questions);
        
        return {
          success: true, // Mark interactive template as successful
          content: `${templateIntro}\n\n${questionList}`,
          type: 'interactive_template',
          templateName: context.templateName,
          questions,
          currentQuestion: 0,
          elicitationComplete: false,
          artifacts: []
        };
      }

      // Fallback if template loading fails - generate dynamic message
      const templateType = context.templateName ? context.templateName.replace('-tmpl.yaml', '').replace('-', ' ') : 'template';
      const dynamicFallback = await this.generateErrorFallback(agent, { ...context, action: `create ${templateType}` });
      return {
        success: true, // Mark interactive fallback as successful
        content: dynamicFallback,
        type: 'interactive_fallback',
        elicitationComplete: true,
        artifacts: []
      };

    } catch (error) {
      logger.error(`❌ [INTERACTIVE TEMPLATE ERROR] Failed to handle interactive template: ${error.message}`);
      const errorMessage = await this.generateErrorFallback(agent, context);
      return {
        success: true, // Mark interactive error as successful (graceful degradation)
        content: errorMessage,
        type: 'interactive_error',
        elicitationComplete: true,
        artifacts: []
      };
    }
  }

  /**
   * Load interactive template
   */
  async loadInteractiveTemplate(templateName) {
    try {
      const templatePath = path.join(process.cwd(), '.bmad-core', 'templates', templateName);
      const content = await fs.readFile(templatePath, 'utf8');
      const yaml = require('js-yaml');
      return yaml.load(content);
    } catch (error) {
      logger.error(`❌ [TEMPLATE LOAD] Failed to load interactive template ${templateName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate interactive response
   */
  async generateInteractiveResponse(agent, context) {
    const userInput = context.userPrompt || context.message || '';
    const templateName = context.templateName;
    
    // Create contextual response based on the template type
    let response = '';
    
    if (templateName === 'project-brief-tmpl.yaml') {
      response = this.generateProjectBriefResponse(userInput, agent);
    } else {
      response = this.generateGenericInteractiveResponse(userInput, agent, templateName);
    }

    return {
      content: response,
      type: 'interactive_response',
      templateName,
      elicitationComplete: false // Continue conversation
    };
  }

  /**
   * Generate project brief specific response using AI SDK
   */
  async generateProjectBriefResponse(userInput, agent, context = null) {
    try {
      // Get AI service
      const { AIService } = await import('../../ai/AIService.js');
      const aiService = AIService.getInstance();
      
      if (!aiService || !aiService.initialized) {
        return await this.generateBasicProjectBriefResponse(userInput, agent);
      }

      const prompt = `You are an analyst agent helping create a project brief. The user provided: "${userInput}"

Generate a natural follow-up response that:
1. Acknowledges their input positively
2. Asks a relevant follow-up question about project goals, audience, features, timeline, or constraints
3. Stay professional but conversational (1-2 sentences)

Response:`;
      
      const response = await aiService.call(prompt, agent, 'simple', context);
      
      if (response && response.content) {
        return response.content;
      } else {
        return await this.generateBasicProjectBriefResponse(userInput, agent);
      }
      
    } catch (error) {
      logger.error(`❌ [PROJECT BRIEF RESPONSE] AI generation failed: ${error.message}`);
      return await this.generateBasicProjectBriefResponse(userInput, agent);
    }
  }

  async generateBasicProjectBriefResponse(userInput, agent) {
    const { AIService } = await import('../../ai/AIService.js');
    const aiService = AIService.getInstance();
    
    if (!aiService || !aiService.initialized) {
      throw new Error('AI service required');
    }
    
    const response = await aiService.call('', agent, 1, { userPrompt: userInput }, null);
    
    if (!response || !response.content) {
      throw new Error('AI generation failed');
    }
    
    return response.content.trim();
  }

  /**
   * Generate generic interactive response using AI SDK
   */
  async generateGenericInteractiveResponse(userInput, agent, templateName, context = null) {
    try {
      // Get AI service
      const { AIService } = await import('../../ai/AIService.js');
      const aiService = AIService.getInstance();
      
      if (!aiService || !aiService.initialized) {
        return await this.generateBasicGenericResponse(userInput, agent, templateName);
      }

      const documentType = templateName ? templateName.replace('-tmpl.yaml', '').replace('-', ' ') : 'document';
      const agentInfo = agent.agent || agent;
      
      const prompt = `You are a ${agentInfo.title || agentInfo.role || 'professional'} agent helping create a ${documentType}. The user provided: "${userInput}"

Generate a natural follow-up response that:
1. Acknowledges their input
2. Shows you're processing it for the ${documentType}
3. Asks a relevant follow-up question
4. Keep it conversational (1-2 sentences)

Response:`;
      
      const response = await aiService.call(prompt, agent, 'simple', context);
      
      if (response && response.content) {
        return response.content;
      } else {
        return await this.generateBasicGenericResponse(userInput, agent, templateName);
      }
      
    } catch (error) {
      logger.error(`❌ [GENERIC RESPONSE] AI generation failed: ${error.message}`);
      return await this.generateBasicGenericResponse(userInput, agent, templateName);
    }
  }

  async generateBasicGenericResponse(userInput, agent, templateName) {
    const { AIService } = await import('../../ai/AIService.js');
    const aiService = AIService.getInstance();
    
    if (!aiService || !aiService.initialized) {
      throw new Error('AI service required');
    }
    
    const response = await aiService.call('', agent, 1, { userPrompt: userInput, templateName }, null);
    
    if (!response || !response.content) {
      throw new Error('AI generation failed');
    }
    
    return response.content.trim();
  }

  async generateFallbackQuestion(agent, context) {
    const { AIService } = await import('../../ai/AIService.js');
    const aiService = AIService.getInstance();
    
    if (context.userId && (!aiService || !aiService.initialized)) {
      await aiService.reinitializeWithUserKeys(null, context.userId);
    }
    
    if (!aiService || !aiService.initialized) {
      throw new Error('AI service required');
    }
    
    const response = await aiService.call('', agent, 1, context, context.userId);
    if (!response || !response.content) {
      throw new Error('AI generation failed');
    }
    
    return response.content.trim();
  }

  async generateIntroMessage(agent, context, questions) {
    const { AIService } = await import('../../ai/AIService.js');
    const aiService = AIService.getInstance();
    
    if (context.userId && (!aiService || !aiService.initialized)) {
      await aiService.reinitializeWithUserKeys(null, context.userId);
    }
    
    if (!aiService || !aiService.initialized) {
      throw new Error('AI service required');
    }
    
    const response = await aiService.call('', agent, 1, context, context.userId);
    if (!response || !response.content) {
      throw new Error('AI generation failed');
    }
    
    return response.content.trim();
  }

  async generateErrorFallback(agent, context) {
    const { AIService } = await import('../../ai/AIService.js');
    const aiService = AIService.getInstance();
    
    if (context.userId && (!aiService || !aiService.initialized)) {
      await aiService.reinitializeWithUserKeys(null, context.userId);
    }
    
    if (!aiService || !aiService.initialized) {
      throw new Error('AI service required');
    }
    
    const response = await aiService.call('', agent, 1, context, context.userId);
    if (!response || !response.content) {
      throw new Error('AI generation failed');
    }
    
    return response.content.trim();
  }

  async generateTemplateIntroMessage(agent, context, questions) {
    const { AIService } = await import('../../ai/AIService.js');
    const aiService = AIService.getInstance();
    
    if (context.userId && (!aiService || !aiService.initialized)) {
      await aiService.reinitializeWithUserKeys(null, context.userId);
    }
    
    if (!aiService || !aiService.initialized) {
      throw new Error('AI service required');
    }
    
    const response = await aiService.call('', agent, 1, context, context.userId);
    if (!response || !response.content) {
      throw new Error('AI generation failed');
    }
    
    return response.content.trim();
  }
}

module.exports = { ElicitationManager };