/**
 * AI Service Adapter
 * Handles AI service calls and complexity calculations
 */

import logger from '../../utils/logger.js';
// FallbackProvider removed - AI service required for all responses

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

    // Check if AIServiceV2 is initialized (explicit check)
    if (!this.aiService.initialized) {
      const userId = context?.userId || context?.workflowContext?.initiatedBy;
      if (userId) {
        logger.info(`🔄 [AI SERVICE V2] AIService not initialized, attempting to initialize for user: ${userId}`);
        const initResult = await this.aiService.initialize({ userId });
        if (!initResult.success) {
          logger.error(`❌ [AI SERVICE V2] Failed to initialize AIService for user: ${userId}`, {
            errorCode: initResult.error?.code,
            errorMessage: initResult.error?.message
          });
          throw new Error(`AI Service initialization failed for user ${userId}. Error: ${initResult.error?.message}. Please configure your API keys in the user settings.`);
        }
        logger.info(`✅ [AI SERVICE V2] Successfully initialized AIService for user: ${userId}`);
      } else {
        logger.error(`❌ [AI SERVICE V2] AIService not initialized and no userId provided`);
        throw new Error('AI Service not initialized and no user ID provided. Cannot proceed without AI service.');
      }
    }

    try {
      const complexity = this.calculateComplexity(prompt);
      const userId = context?.userId || context?.workflowContext?.initiatedBy;

      // Use AIServiceV2 options-based API
      const response = await this.aiService.call(prompt, {
        agent,
        complexity,
        context,
        userId
      });

      // FIXED: Use proper logging instead of console.log which may cause serialization issues
      logger.info(`🤖 [AI RESPONSE] Received response from ${response?.provider || 'unknown'} - Content length: ${response?.content?.length || 'unknown'}`);

      // Debug log with safe serialization
      if (response && typeof response === 'object') {
        logger.info(`🔍 [AI RESPONSE DEBUG] Response structure: {
          provider: ${response.provider},
          contentType: ${typeof response.content},
          contentLength: ${response.content?.length || 0},
          hasUsage: ${!!response.usage},
          attempt: ${attempt}
        }`);
      } else {
        logger.warn(`⚠️ [AI RESPONSE DEBUG] Unexpected response type: ${typeof response}`);
      }

      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response from AI service');
      }

      // Add attempt info to response for debugging
      response.attempt = attempt;

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