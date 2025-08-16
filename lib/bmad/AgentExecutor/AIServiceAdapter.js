/**
 * AI Service Adapter
 * Handles AI service calls and complexity calculations
 */

import logger from '../../utils/logger.js';
const { FallbackProvider } = require('../execution/FallbackProvider.js');

class AIServiceAdapter {
  constructor(aiService) {
    this.aiService = aiService;
  }

  updateAiService(aiService) {
    if (aiService && !this.aiService) {
      this.aiService = aiService;
    }
  }

  async callAIService(prompt, agent, attempt, context = null) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt provided to AI service');
    }

    logger.info(`🤖 [AI SERVICE] Calling AI service with prompt length: ${prompt.length}`);
    
    // Check if AIService is initialized
    if (!this.aiService.initialized) {
      const userId = context?.userId || context?.workflowContext?.initiatedBy;
      if (userId) {
        logger.info(`🔄 [AI SERVICE] AIService not initialized, attempting to initialize for user: ${userId}`);
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
}

module.exports = { AIServiceAdapter };