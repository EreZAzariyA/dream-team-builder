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
      const elicitationQuestions = this.extractElicitationQuestions(context.stepNotes || '');
      
      if (elicitationQuestions.length === 0) {
        logger.info(`📝 [ELICITATION] No questions found, proceeding with available context`);
        return {
          content: `I'm ready to help with ${context.action || 'your request'}. What specific information would you like me to focus on?`,
          type: 'elicitation_response',
          elicitationComplete: true
        };
      }

      // Present questions to user
      const questionList = elicitationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      
      return {
        content: `To provide the best assistance, I need some additional information:\n\n${questionList}\n\nPlease provide answers to help me better understand your requirements.`,
        type: 'elicitation_questions',
        questions: elicitationQuestions,
        elicitationComplete: false
      };

    } catch (error) {
      logger.error(`❌ [ELICITATION ERROR] Elicitation failed: ${error.message}`);
      return {
        content: `I'm ready to help. Please provide any additional context or specific requirements for your request.`,
        type: 'elicitation_fallback',
        elicitationComplete: true
      };
    }
  }

  /**
   * Extract elicitation questions from content
   */
  extractElicitationQuestions(taskContent) {
    if (!taskContent) return [];

    const questions = [];
    
    // Extract questions marked with specific patterns
    const questionPatterns = [
      /(?:^|\n)\s*[-*]\s*(.+\?)\s*(?:\n|$)/gm,  // Bullet point questions
      /(?:^|\n)\s*\d+\.\s*(.+\?)\s*(?:\n|$)/gm, // Numbered questions
      /Question:\s*(.+\?)/gm,                    // Explicit question markers
      /Ask:\s*(.+\?)/gm,                         // Ask markers
      /Elicit:\s*(.+\?)/gm                       // Elicit markers
    ];

    for (const pattern of questionPatterns) {
      let match;
      while ((match = pattern.exec(taskContent)) !== null) {
        const question = match[1].trim();
        if (question && !questions.includes(question)) {
          questions.push(question);
        }
      }
    }

    // If no explicit questions found, look for imperative statements that could be questions
    if (questions.length === 0) {
      const imperativePatterns = [
        /(?:Define|Describe|Explain|Identify|Specify|List|Detail)\s+([^.!?]+)/gm
      ];

      for (const pattern of imperativePatterns) {
        let match;
        while ((match = pattern.exec(taskContent)) !== null) {
          const statement = match[0].trim();
          if (statement && !questions.includes(statement + '?')) {
            questions.push(statement + '?');
          }
        }
      }
    }

    logger.info(`📝 [ELICITATION] Extracted ${questions.length} questions from content`);
    return questions.slice(0, 5); // Limit to 5 questions to avoid overwhelming
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
      content: `[MOCK MODE] ${response}`,
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
        
        return {
          content: `I'll help you create a ${context.templateName.replace('-tmpl.yaml', '')}. Let me ask you a few questions:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nPlease start by answering the first question, and we'll work through this together.`,
          type: 'interactive_template',
          templateName: context.templateName,
          questions,
          currentQuestion: 0,
          elicitationComplete: false
        };
      }

      // Fallback if template loading fails
      return {
        content: `I'm ready to help you with your ${context.templateName.replace('-tmpl.yaml', '')}. What specific aspects would you like to focus on?`,
        type: 'interactive_fallback',
        elicitationComplete: true
      };

    } catch (error) {
      logger.error(`❌ [INTERACTIVE TEMPLATE ERROR] Failed to handle interactive template: ${error.message}`);
      return {
        content: `I'm ready to help. Please provide the details you'd like me to work with.`,
        type: 'interactive_error',
        elicitationComplete: true
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
   * Generate project brief specific response
   */
  generateProjectBriefResponse(userInput, agent) {
    const agentInfo = agent.agent || {};
    
    // Analyze user input for project brief components
    if (userInput.toLowerCase().includes('goal') || userInput.toLowerCase().includes('objective')) {
      return `Thank you for sharing the project goals. As ${agentInfo.name || 'an analyst'}, I can see this aligns with strategic objectives. What's the target audience or user base for this project?`;
    }
    
    if (userInput.toLowerCase().includes('audience') || userInput.toLowerCase().includes('user')) {
      return `Excellent. Understanding the target audience is crucial. What are the key features or functionalities you envision for this project?`;
    }
    
    if (userInput.toLowerCase().includes('feature') || userInput.toLowerCase().includes('functionality')) {
      return `Great features! What timeline are you considering for this project, and are there any specific constraints or requirements I should be aware of?`;
    }
    
    // Default response
    return `Thank you for that information. Based on what you've shared, I'm building a comprehensive understanding of your project. Is there anything else about the scope, timeline, or requirements you'd like to discuss?`;
  }

  /**
   * Generate generic interactive response
   */
  generateGenericInteractiveResponse(userInput, agent, templateName) {
    const agentInfo = agent.agent || {};
    const documentType = templateName.replace('-tmpl.yaml', '').replace('-', ' ');
    
    return `Thank you for providing that information. As ${agentInfo.name || agent.id}, I'm analyzing your input for the ${documentType}. Based on what you've shared, I can help develop this further. What other aspects would you like to explore or detail?`;
  }
}

module.exports = { ElicitationManager };