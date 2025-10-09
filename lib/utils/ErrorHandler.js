/**
 * Centralized Error Handling Utility
 * Provides standardized error handling and fallback response generation
 */

import logger from './logger.js';

export class ErrorHandler {
  /**
   * Create a standardized fallback response
   * @param {Object} agent - The agent object
   * @param {Object} context - Request context
   * @param {string} fallbackType - Type of fallback ('ai_service', 'template', 'validation')
   * @returns {Object} Standardized fallback response
   */
  static createFallbackResponse(agent, context, fallbackType = 'ai_service') {
    const agentInfo = agent?.agent || {};
    const agentRole = agent?.persona?.role || agentInfo.title || 'AI Agent';
    const projectName = this.extractProjectName(context);
    const userRequirements = this.extractUserRequirements(context);
    
    let fallbackContent;
    
    switch (fallbackType) {
      case 'ai_service':
        fallbackContent = this.generateAIServiceFallback(agent, projectName, userRequirements);
        break;
      case 'template':
        fallbackContent = this.generateTemplateFallback(agent, context);
        break;
      case 'validation':
        fallbackContent = this.generateValidationFallback(agent, context);
        break;
      default:
        fallbackContent = this.generateGenericFallback(agent, context);
    }
    
    return {
      content: fallbackContent,
      provider: 'fallback',
      usage: null,
      metadata: {
        fallbackType,
        agent: agent?.id,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Categorize error types for appropriate handling
   * @param {Error} error - The error to categorize
   * @returns {string} Error category
   */
  static categorizeError(error) {
    if (!error) return 'unknown';
    
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('rate limit') || message.includes('quota')) {
      return 'rate_limit';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('authentication') || message.includes('api key')) {
      return 'authentication';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('template') || message.includes('not found')) {
      return 'template';
    }
    
    return 'service_error';
  }
  
  /**
   * Get retry policy based on error category
   * @param {string} errorCategory - Error category from categorizeError
   * @returns {Object} Retry policy configuration
   */
  static getRetryPolicy(errorCategory) {
    const policies = {
      rate_limit: { maxRetries: 3, backoffMs: 2000, exponential: true },
      network: { maxRetries: 2, backoffMs: 1000, exponential: false },
      timeout: { maxRetries: 1, backoffMs: 500, exponential: false },
      authentication: { maxRetries: 0, backoffMs: 0, exponential: false },
      template: { maxRetries: 0, backoffMs: 0, exponential: false },
      service_error: { maxRetries: 1, backoffMs: 1000, exponential: false },
      unknown: { maxRetries: 1, backoffMs: 1000, exponential: false }
    };
    
    return policies[errorCategory] || policies.unknown;
  }
  
  /**
   * Handle error with appropriate logging and response
   * @param {Error} error - The error to handle
   * @param {Object} context - Error context
   * @returns {Object} Error handling result
   */
  static handleError(error, context = {}) {
    const category = this.categorizeError(error);
    const policy = this.getRetryPolicy(category);
    
    // Log error with appropriate level based on category
    const logLevel = this.getLogLevel(category);
    logger[logLevel](`❌ [ERROR HANDLER] ${category} error:`, {
      message: error.message,
      category,
      context: context.operation || 'unknown',
      stack: error.stack
    });
    
    return {
      category,
      policy,
      shouldRetry: policy.maxRetries > 0,
      fallbackResponse: context.agent ? 
        this.createFallbackResponse(context.agent, context, category) : null
    };
  }
  
  /**
   * Get appropriate log level for error category
   * @param {string} category - Error category
   * @returns {string} Log level
   */
  static getLogLevel(category) {
    const levels = {
      rate_limit: 'warn',
      network: 'warn', 
      timeout: 'warn',
      authentication: 'error',
      template: 'error',
      service_error: 'error',
      unknown: 'error'
    };
    
    return levels[category] || 'error';
  }
  
  // Private helper methods
  static extractProjectName(context) {
    if (!context) return 'Project';
    
    const projectMatch = context.userPrompt?.match(/Project Name: ([^\n]+)/) ||
                        context.prompt?.match(/Project Name: ([^\n]+)/);
    return projectMatch ? projectMatch[1] : 'Project';
  }
  
  static extractUserRequirements(context) {
    if (!context) return 'Project requirements';
    
    const requirementsMatch = context.userPrompt?.match(/User Requirements: ([^\n]+)/) ||
                             context.prompt?.match(/User Requirements: ([^\n]+)/);
    return requirementsMatch ? requirementsMatch[1] : (context.userPrompt || 'Project requirements');
  }
  
  static generateAIServiceFallback(agent, projectName, userRequirements) {
    const fallbackResponses = this.getFallbackResponsesByAgent(agent?.id);
    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    
    return randomResponse
      .replace('{projectName}', projectName)
      .replace('{userRequirements}', userRequirements)
      .replace('{agentRole}', agent?.persona?.role || agent?.agent?.title || 'AI Agent');
  }
  
  static generateTemplateFallback(agent, context) {
    const agentRole = agent?.persona?.role || agent?.agent?.title || 'AI Agent';
    return `# ${agentRole} Response\n\nI apologize, but I'm unable to access the required template at this time. However, I can still assist you with your request.\n\n## Your Request\n${context.userPrompt || 'No specific request provided'}\n\n## My Analysis\nAs a ${agentRole}, I recommend:\n\n1. **Review Requirements**: Ensure all requirements are clearly defined\n2. **Plan Approach**: Develop a structured approach to implementation\n3. **Execute**: Implement following best practices\n\n*Note: For more detailed analysis, please ensure templates are properly configured.*`;
  }
  
  static generateValidationFallback(agent, context) {
    return `# Validation Notice\n\nThere was an issue validating the response, but I can provide general guidance based on your request.\n\n## Request\n${context.userPrompt || 'No specific request provided'}\n\n## Guidance\nPlease review the requirements and try again. If the issue persists, check the system configuration.\n\n*Note: This is a fallback response due to validation issues.*`;
  }
  
  static generateGenericFallback(agent, context) {
    const agentRole = agent?.persona?.role || agent?.agent?.title || 'AI Agent';
    return `# ${agentRole} Response\n\nI understand you need assistance with: ${context.userPrompt || 'your request'}\n\nWhile I'm experiencing some technical difficulties, I'm still here to help. Please let me know how I can assist you, and I'll do my best to provide valuable guidance.\n\n*Note: This is a fallback response. For optimal results, please check system configuration.*`;
  }
  
  static getFallbackResponsesByAgent(agentId) {
    const fallbackResponses = {
      pm: [
        "I'm a Product Manager focused on {userRequirements} for {projectName}. Let me help define the product strategy and requirements.",
        "As your PM, I'll help prioritize features and create a roadmap for {projectName} based on {userRequirements}.",
        "Product management is my expertise. I can help structure {projectName} to meet {userRequirements} effectively."
      ],
      architect: [
        "As a System Architect, I'll help design the technical architecture for {projectName} considering {userRequirements}.",
        "Technical architecture is my specialty. Let me help structure {projectName} with {userRequirements} in mind.",
        "I focus on creating scalable, maintainable architectures. For {projectName}, we need to consider {userRequirements}."
      ],
      dev: [
        "As a Developer, I'm ready to implement {projectName} based on {userRequirements}. Let's start coding!",
        "Development is my strong suit. I can help build {projectName} to meet {userRequirements} with clean, efficient code.",
        "I'm here to turn {userRequirements} into working code for {projectName}. What shall we build first?"
      ],
      qa: [
        "Quality Assurance is critical for {projectName}. I'll help ensure {userRequirements} are properly validated.",
        "As your QA specialist, I'll create comprehensive test strategies for {projectName} covering {userRequirements}.",
        "Testing and quality are my focus. Let's ensure {projectName} meets {userRequirements} with robust testing."
      ],
      analyst: [
        "As a Business Analyst, I'll help analyze and refine {userRequirements} for {projectName}.",
        "Analysis and requirements gathering are my expertise. Let me help clarify {userRequirements} for {projectName}.",
        "I specialize in understanding business needs. For {projectName}, let's ensure {userRequirements} are comprehensive."
      ]
    };
    
    return fallbackResponses[agentId] || [
      "I'm here to help with {projectName} based on {userRequirements}. As a {agentRole}, I'll provide the best guidance I can.",
      "Let me assist you with {projectName}. Based on {userRequirements}, I can offer valuable insights as a {agentRole}.",
      "I'm ready to help with {projectName}. With {userRequirements} in mind, I'll provide {agentRole} expertise."
    ];
  }
}

export default ErrorHandler;