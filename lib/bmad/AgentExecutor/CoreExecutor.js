/**
 * Core Executor
 * Main execution logic and retry handling
 */

const { PromptBuilder } = require('../execution/PromptBuilder.js');
const { OutputValidator } = require('../execution/OutputValidator.js');
const { FallbackProvider } = require('../execution/FallbackProvider.js');
import logger from '../../utils/logger.js';

class CoreExecutor {
  constructor(aiServiceAdapter, templateDetector, templateProcessor, elicitationManager, fileManager, cacheManager) {
    this.aiServiceAdapter = aiServiceAdapter;
    this.templateDetector = templateDetector;
    this.templateProcessor = templateProcessor;
    this.elicitationManager = elicitationManager;
    this.fileManager = fileManager;
    this.cacheManager = cacheManager;
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
    }, null, 2)}`);

    const startTime = Date.now();
    
    // Extract configuration with defaults
    const config = {
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      enableElicitation: context.elicitationEnabled !== false,
      ...options
    };

    logger.info(`🚀 [AGENT EXECUTOR] Starting unified execution for agent: ${agent?.id}`);
    logger.info(`⚙️ [CONFIG] Max retries: ${config.maxRetries}, Timeout: ${config.timeout}ms, Elicitation: ${config.enableElicitation}`);

    try {
      // Step 1: Template determination (with elicitation handling)
      const template = await this.templateProcessor.determineTemplate(agent, context, this.templateDetector);
      
      // Step 2: Check for elicitation requirements
      if (config.enableElicitation && this.shouldTriggerElicitation(context, template)) {
        logger.info(`🔄 [ELICITATION] Triggering elicitation for agent ${agent?.id}`);
        return await this.elicitationManager.handleElicitationStep(agent, context);
      }

      // Step 3: Unified retry execution
      const result = await this.executeWithUnifiedRetries(agent, template, context, config);
      
      // Step 4: Handle file saving if needed
      let documentUrl = null;
      if (result && result.content && this.fileManager.shouldSaveAsFile(result, template, context)) {
        documentUrl = await this.fileManager.saveAgentFile(result, agent, template, context);
      }
      
      // Step 5: Return final result
      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        executionTime,
        documentUrl: documentUrl || result.documentUrl,
        hasDocument: !!documentUrl
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`❌ [AGENT EXECUTOR] Execution failed for agent ${agent?.id}: ${error.message}`);
      
      // Return fallback response
      const fallbackProvider = new FallbackProvider();
      const fallbackResult = fallbackProvider.generateResponse(agent, context);
      
      return {
        ...fallbackResult,
        executionTime,
        error: error.message
      };
    }
  }

  /**
   * Execute with unified retry strategy
   */
  async executeWithUnifiedRetries(agent, template, context, config) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      logger.info(`🔄 [RETRY ${attempt}/${config.maxRetries}] Attempting execution for agent: ${agent?.id}`);
      
      try {
        const result = await this.processSingleAttempt(agent, template, context, attempt);
        
        // Validate result
        const validator = new OutputValidator();
        const validation = validator.validateOutput(result, template, context);
        
        if (validation.isValid) {
          logger.info(`✅ [SUCCESS] Agent ${agent?.id} execution succeeded on attempt ${attempt}`);
          return result;
        } else {
          logger.warn(`⚠️ [VALIDATION FAILED] Attempt ${attempt} failed validation: ${validation.errors.join(', ')}`);
          lastError = new Error(`Validation failed: ${validation.errors.join(', ')}`);
          
          // Don't retry on final attempt
          if (attempt === config.maxRetries) {
            break;
          }
          
          // Add validation feedback to context for next attempt
          context.validationFeedback = validation.errors;
          continue;
        }
        
      } catch (error) {
        logger.error(`❌ [ATTEMPT ${attempt}] Execution failed: ${error.message}`);
        lastError = error;
        
        // Don't retry on final attempt
        if (attempt === config.maxRetries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.info(`⏳ [RETRY DELAY] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // All retries exhausted
    logger.error(`💥 [RETRY EXHAUSTED] All ${config.maxRetries} attempts failed for agent ${agent?.id}`);
    throw lastError || new Error('Unknown execution failure');
  }

  /**
   * Process a single execution attempt
   */
  async processSingleAttempt(agent, template, context, attempt) {
    const startTime = Date.now();
    
    try {
      // Build prompt using PromptBuilder
      const promptBuilder = new PromptBuilder();
      const prompt = await promptBuilder.buildPrompt(agent, template, context, {
        attempt,
        includeValidationFeedback: !!context.validationFeedback
      });
      
      logger.info(`📝 [PROMPT] Built prompt for agent ${agent?.id}, length: ${prompt.length}`);
      
      // Call AI service
      const response = await this.aiServiceAdapter.callAIService(prompt, agent, attempt, context);
      
      const executionTime = Date.now() - startTime;
      
      // Extract artifacts if any
      const artifacts = this.aiServiceAdapter.extractArtifacts(response);
      
      return {
        content: response.content,
        executionTime,
        tokensUsed: response.usage?.total_tokens || response.usage?.totalTokens || 0,
        model: response.provider || response.model || 'ai',
        artifacts,
        metadata: {
          attempt,
          template: template?.name,
          agent: agent?.id,
          prompt_length: prompt.length,
          ...response.metadata
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`❌ [SINGLE ATTEMPT] Failed on attempt ${attempt}: ${error.message}`);
      
      // Enhance error with context
      const enhancedError = new Error(`Attempt ${attempt} failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.attempt = attempt;
      enhancedError.executionTime = executionTime;
      
      throw enhancedError;
    }
  }

  /**
   * Determine if elicitation should be triggered
   */
  shouldTriggerElicitation(context, template) {
    // Skip elicitation if disabled
    if (context.elicitationEnabled === false) {
      return false;
    }
    
    // Skip elicitation in chat mode (conversational)
    if (context.chatMode) {
      return false;
    }
    
    // Trigger elicitation for interactive templates
    if (context.interactiveMode || context.templateName) {
      return true;
    }
    
    // Trigger elicitation if template has elicitation requirements
    if (template && template.elicitation && Array.isArray(template.elicitation) && template.elicitation.length > 0) {
      return true;
    }
    
    // Trigger elicitation if context lacks required information
    if (!context.userPrompt || context.userPrompt.length < 10) {
      return true;
    }
    
    return false;
  }
}

module.exports = { CoreExecutor };