/**
 * SIMPLIFIED AGENT EXECUTOR
 * 
 * Replaces the over-engineered AgentExecutor system:
 * - Eliminates 7 global singletons 
 * - Removes pure delegation layers
 * - Direct execution without indirection
 * - Proper dependency injection instead of global state
 * 
 * PRINCIPLES:
 * - Direct Execution: No delegation to CoreExecutor
 * - Clean Dependencies: No global singletons
 * - Simple Interface: Clear, direct method calls
 * - Focused Responsibility: Agent execution only
 */

const { PromptBuilder } = require('./execution/PromptBuilder.js');
const { OutputValidator } = require('./execution/OutputValidator.js');
// FallbackProvider removed - AI service required for all responses
const { TemplateDetector } = require('./AgentExecutor/TemplateDetector.js');
const { UnifiedTemplateProcessor } = require('./templates/UnifiedTemplateProcessor.js');
const { ElicitationManager } = require('./AgentExecutor/ElicitationManager.js');
const { AIServiceAdapter } = require('./AgentExecutor/AIServiceAdapter.js');
import GitHubArtifactManager from './GitHubArtifactManager.js';
import logger from '../utils/logger.js';

class SimplifiedAgentExecutor {
  constructor(options = {}) {
    // Use dependency injection instead of global singletons
    this.agentLoader = options.agentLoader;
    this.aiService = options.aiService;
    this.configurationManager = options.configurationManager;
    
    // Initialize components with proper lifecycle management
    this.promptBuilder = new PromptBuilder();
    this.outputValidator = new OutputValidator();
    // FallbackProvider removed - AI service required for all responses
    this.templateDetector = new TemplateDetector(null);
    this.templateProcessor = new UnifiedTemplateProcessor(
      this.configurationManager, 
      null, 
      null
    );
    this.elicitationManager = new ElicitationManager(this.configurationManager);
    this.artifactManager = options.artifactManager || null; // GitHubArtifactManager injected
    this.aiServiceAdapter = new AIServiceAdapter(this.aiService);
  }

  // Update AI service after construction if needed
  updateAiService(aiService) {
    this.aiService = aiService;
    this.aiServiceAdapter = new AIServiceAdapter(aiService);
  }

  /**
   * MAIN EXECUTION METHOD - Direct execution without delegation chains
   * Consolidates logic from CoreExecutor, eliminating unnecessary indirection
   */
  async executeAgent(agent, context, options = {}) {
    const startTime = Date.now();
    
    logger.info(`🚀 [AgentExecutor] Starting execution for agent: ${agent?.id}`);

    // Extract configuration with defaults
    const config = {
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      enableElicitation: context.elicitationEnabled !== false,
      ...options
    };

    logger.info(`⚙️ [AgentExecutor] Config - Retries: ${config.maxRetries}, Timeout: ${config.timeout}ms`);

    try {
      // Step 1: Determine template (direct call - no delegation)
      const template = await this.determineTemplate(agent, context);
      
      // Step 2: Check for elicitation requirements
      if (config.enableElicitation && this.shouldTriggerElicitation(context, template)) {
        logger.info(`🔄 [AgentExecutor] Triggering elicitation for agent ${agent?.id}`);
        return await this.elicitationManager.handleElicitationStep(agent, context);
      }

      // Step 3: Execute with retries (consolidated logic)
      const result = await this.executeWithRetries(agent, template, context, config);
      
      // Step 4: Handle artifact generation (only for finished documents, not conversational responses)
      let artifactId = null;
      if (result && this.shouldSaveAsArtifact(result, template, context)) {
        // Only save if this is a finished document artifact, not a conversational response
        const documentContent = this.extractDocumentContent(result, template, context);
        if (documentContent && this.artifactManager) {
          const filename = this.getArtifactFilename(context, template);
          artifactId = await this.artifactManager.generateArtifact(
            agent.id, 
            filename, 
            documentContent,
            { template: template?.id, context: context.creates }
          );
          logger.info(`📄 [ARTIFACT] Generated artifact: ${filename} by ${agent.id}`);
        }
      }
      
      // Step 5: Return consolidated result
      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        executionTime,
        artifactId: artifactId || result.artifactId,
        hasArtifact: !!artifactId
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`❌ [AgentExecutor] Execution failed for agent ${agent?.id}:`, error);
      
      // No fallback responses allowed - throw error to force proper AI service usage
      throw new Error(`Agent execution failed for ${agent?.id}: ${error.message}. AI service is required - no fallback responses allowed.`);
    }
  }

  /**
   * Determine template for agent - direct implementation
   */
  async determineTemplate(agent, context) {
    try {
      // Check if template is explicitly provided
      if (context.template) {
        return context.template;
      }

      // Use template detector to find appropriate template
      const detectedTemplate = await this.templateDetector.detectTemplate(agent, context);
      
      if (detectedTemplate) {
        logger.info(`📋 [AgentExecutor] Using detected template: ${detectedTemplate.name}`);
        return detectedTemplate;
      }

      // Process through template processor if needed
      if (context.templateName) {
        return await this.templateProcessor.determineTemplate(agent, context, this.templateDetector);
      }

      // Default fallback
      return {
        name: 'default',
        sections: [],
        interactive: false
      };

    } catch (error) {
      logger.warn(`⚠️ [AgentExecutor] Template determination failed, using default:`, error.message);
      return {
        name: 'default',
        sections: [],
        interactive: false
      };
    }
  }

  /**
   * Execute with retries - consolidated retry logic
   */
  async executeWithRetries(agent, template, context, config) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        logger.info(`🔄 [AgentExecutor] Attempt ${attempt}/${config.maxRetries} for agent ${agent?.id}`);
        
        // Single execution attempt with timeout
        const result = await this.executeSingleAttempt(agent, template, context, attempt, config.timeout);
        
        // Validate result
        if (this.isValidResult(result)) {
          logger.info(`✅ [AgentExecutor] Successful execution on attempt ${attempt}`);
          return result;
        } else {
          throw new Error('Invalid execution result');
        }

      } catch (error) {
        lastError = error;
        logger.warn(`⚠️ [AgentExecutor] Attempt ${attempt} failed:`, error.message);
        
        // Wait before retry (exponential backoff)
        if (attempt < config.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.info(`⏳ [AgentExecutor] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries exhausted
    logger.error(`💥 [AgentExecutor] All ${config.maxRetries} attempts failed for agent ${agent?.id}`);
    throw lastError || new Error('Unknown execution failure');
  }

  /**
   * Execute single attempt with timeout
   */
  async executeSingleAttempt(agent, template, context, attempt, timeout) {
    return new Promise(async (resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        // CRITICAL FIX: Check if this is a task-based execution that requires step-by-step conversation flow
        const taskBasedResult = await this.handleTaskBasedExecution(agent, template, context, attempt);
        if (taskBasedResult) {
          clearTimeout(timeoutId);
          resolve(taskBasedResult);
          return;
        }
        

        // Build prompt
        const prompt = await this.promptBuilder.buildPrompt(agent, template, context, {
          attempt,
          includeValidationFeedback: !!context.validationFeedback
        });
        
        logger.info(`📝 [AgentExecutor] Built prompt for agent ${agent?.id}, length: ${prompt.length}`);
        
        // Call AI service directly
        const response = await this.aiServiceAdapter.callAIService(prompt, agent, attempt, context);
        
        // Process response
        const result = this.processAIResponse(response, agent, template, context, attempt);
        
        clearTimeout(timeoutId);
        resolve(result);

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Handle task-based execution that requires step-by-step conversation flow
   * Returns null if this is not a task-based execution
   */
  async handleTaskBasedExecution(agent, template, context, attempt) {
    const step = context.step || context;
    let taskReference = step.uses || step.command;

    // If no explicit task reference, try to extract from action
    if (!taskReference && typeof step.action === 'string') {
      const conversationalTasks = [
        'document-project',
        'create-doc',
        'advanced-elicitation',
        'brownfield-create-story',
        'brownfield-create-epic'
      ];
      
      for (const task of conversationalTasks) {
        if (step.action.includes(task)) {
          taskReference = task;
          break;
        }
      }
    }

    if (!taskReference) {
      return null;
    }
    
    logger.info(`🔄 [TASK EXECUTION] Agent ${agent?.id} executing conversational task: ${taskReference}`);
    return this.executeTaskWithAI(agent, context, taskReference);
  }

  async executeTaskWithAI(agent, context, taskReference) {
    try {
      const taskContent = await this.loadTaskDefinition(taskReference);
      if (!taskContent) {
        logger.warn(`Task definition not found for: ${taskReference}`);
        return null;
      }

      const prompt = `
        You are the ${agent.name} agent.
        Your current task is to follow the instructions in the task definition provided below.
        The user's original request was: "${context.userPrompt || 'not specified'}".
        The current step in the workflow is: "${context.action || 'not specified'}".

        Here is the task definition:
        ---
        ${taskContent}
        ---

        Based on these instructions, generate the appropriate response or ask a clarifying question if necessary.
      `;

      const response = await this.aiServiceAdapter.callAIService(prompt, agent, 1, context);
      return this.processAIResponse(response, agent, null, context, 1);

    } catch (error) {
      logger.error(`Failed to execute task with AI: ${taskReference}`, error);
      return null;
    }
  }

  async loadTaskDefinition(taskReference) {
    try {
      // Assuming tasks are in '.bmad-core/tasks' and have a '.md' extension
      const taskPath = require('path').join(process.cwd(), '.bmad-core', 'tasks', `${taskReference}.md`);
      return await require('fs').promises.readFile(taskPath, 'utf8');
    } catch (error) {
      logger.warn(`Could not load task definition for ${taskReference}:`, error.message);
      return null;
    }
  }

  /**
   * Process AI response - consolidated logic
   */
  processAIResponse(response, agent, template, context, attempt) {
    // Handle different response formats
    let responseContent, responseMetadata;
    
    if (typeof response === 'string') {
      logger.warn(`⚠️ [AgentExecutor] Received string response, converting to object format`);
      responseContent = response;
      responseMetadata = { fallback: true, reason: 'string_response_detected' };
    } else if (response && typeof response === 'object') {
      responseContent = response.content;
      responseMetadata = response.metadata || {};
    } else {
      throw new Error(`Invalid response type: ${typeof response}`);
    }

    // Extract artifacts if any
    const artifacts = this.extractArtifacts(response);
    
    // Extract structured outputs for workflow routing decisions
    const structuredOutput = this.extractStructuredOutputs(responseContent, template, context);
    
    // CRITICAL FIX: Handle classification step processing
    const result = {
      success: true,
      content: responseContent,
      tokensUsed: response?.usage?.total_tokens || response?.usage?.totalTokens || 0,
      model: response?.provider || response?.model || 'ai',
      artifacts,
      metadata: {
        attempt,
        template: template?.name,
        agent: agent?.id,
        ...responseMetadata
      },
      structuredOutputs: structuredOutput
    };

    // Handle classification step logic (moved from DynamicWorkflowHandler)
    const isClassificationStep = (
      (context.step && context.step.action === 'classify enhancement scope') ||
      (context.action === 'classify enhancement scope') ||
      (context.step && context.step.step === 'enhancement_classification')
    );
    
    if (isClassificationStep) {
      
      try {
        // Check if AI is asking for user input
        const needsUserInput = this.checkIfNeedsUserInput(responseContent);
        
        
        if (needsUserInput) {
          logger.info(`🔄 [CLASSIFICATION] AI requesting user input - triggering elicitation`);
          
          // Mark this as requiring elicitation
          result.requiresElicitation = true;
          result.elicitationRequest = {
            question: this.extractElicitationQuestion(responseContent),
            context: 'classification_step',
            stepAction: 'classify enhancement scope'
          };
          
          logger.info(`✅ [CLASSIFICATION] Elicitation request created: ${result.elicitationRequest.question}`);
        } else {
          logger.info(`✅ [CLASSIFICATION] AI provided classification without needing user input`);
          
          // Try to extract classification from response
          const classification = this.extractClassification(responseContent);
          if (classification) {
            result.classification = classification;
            logger.info(`📋 [CLASSIFICATION] Extracted: ${classification}`);
          }
        }
      } catch (error) {
        logger.error(`❌ [CLASSIFICATION] Error processing classification:`, error);
      }
    } else {
      logger.info(`ℹ️ [CLASSIFICATION DEBUG] Not a classification step`);
    }
    
    return result;
  }

  /**
   * Extract artifacts from response
   */
  extractArtifacts(output) {
    if (!output || typeof output !== 'object') return [];
    
    const artifacts = [];
    
    if (output.files) artifacts.push(...output.files);
    if (output.code) artifacts.push({ type: 'code', content: output.code });
    if (output.documentation) artifacts.push({ type: 'documentation', content: output.documentation });
    
    return artifacts;
  }

  /**
   * Extract structured outputs for workflow decisions
   */
  extractStructuredOutputs(content, template, context) {
    try {
      // Look for structured data in response
      if (typeof content === 'object' && content.structured) {
        return content.structured;
      }
      
      // Parse structured output patterns
      const structuredPatterns = {
        classification: /\[CLASSIFICATION:\s*([^\]]+)\]/i,
        decision: /\[DECISION:\s*([^\]]+)\]/i,
        routing: /\[ROUTING:\s*([^\]]+)\]/i,
        next_agent: /\[NEXT_AGENT:\s*([^\]]+)\]/i
      };
      
      const structured = {};
      
      for (const [key, pattern] of Object.entries(structuredPatterns)) {
        const match = String(content).match(pattern);
        if (match) {
          structured[key] = match[1].trim();
        }
      }
      
      return Object.keys(structured).length > 0 ? structured : null;
      
    } catch (error) {
      logger.warn(`⚠️ [AgentExecutor] Failed to extract structured outputs:`, error.message);
      return null;
    }
  }

  /**
   * Check if should trigger elicitation
   */
  shouldTriggerElicitation(context, template) {
    // Skip elicitation if disabled
    if (context.elicitationEnabled === false) {
      return false;
    }
    
    // Skip elicitation in chat mode
    if (context.chatMode) {
      return false;
    }
    
    // Check if template is interactive
    if (template && template.interactive) {
      return true;
    }
    
    // CRITICAL FIX: Check if agent is using interactive tasks that require elicitation
    const step = context.step || context;
    
    // 1. Tasks that ALWAYS require elicitation (like create-doc.md)
    const interactiveTasks = [
      'create-doc.md',
      'create-doc',
      'advanced-elicitation.md',
      'advanced-elicitation'
    ];
    
    if (step.uses && interactiveTasks.some(task => step.uses.includes(task))) {
      logger.info(`🔄 [ELICITATION TRIGGER] Agent using interactive task: ${step.uses}`);
      return true;
    }
    
    // 2. Check for template usage that indicates document creation
    if (step.uses && step.uses.includes('-tmpl')) {
      logger.info(`🔄 [ELICITATION TRIGGER] Agent using template that requires interaction: ${step.uses}`);
      return true;
    }
    
    // 3. Check agent commands that use create-doc
    if (step.action && (
      step.action.includes('create-prd') ||
      step.action.includes('create-brownfield-prd') ||
      step.action.includes('create-doc') ||
      step.action.includes('create') && step.action.includes('doc')
    )) {
      logger.info(`🔄 [ELICITATION TRIGGER] Agent action requires document creation: ${step.action}`);
      return true;
    }
    
    // 4. Check for explicit user interaction requests in notes
    const stepNotes = context.stepNotes || context.action || step.notes || '';
    if (stepNotes.includes('Ask user:') || stepNotes.includes('ask user')) {
      logger.info(`🔄 [ELICITATION TRIGGER] Step notes request user interaction: ${stepNotes.substring(0, 100)}`);
      return true;
    }
    
    // 5. Original elicitation patterns
    const elicitationPatterns = [
      /\[USER_INPUT_REQUIRED\]/i,
      /\[ELICIT:/i,
      /\[ASK_USER:/i,
      /ask user:/i,
      /user input/i
    ];
    
    return elicitationPatterns.some(pattern => pattern.test(stepNotes));
  }

  /**
   * Check if AI response indicates it needs user input
   */
  checkIfNeedsUserInput(content) {
    if (!content) {
      logger.info(`🔍 [USER INPUT CHECK] No content provided`);
      return false;
    }
    
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    logger.info(`🔍 [USER INPUT CHECK] Checking content: ${contentStr.substring(0, 200)}...`);
    
    // Patterns that indicate AI is asking for user input
    const userInputPatterns = [
      /ask user/i,
      /need more information/i,
      /could you (provide|describe|tell|explain)/i,
      /can you (describe|tell|explain|provide)/i,
      /what type of/i,
      /please specify/i,
      /more details about/i,
      /clarification/i,
      /\?[^?]*$/m // Ends with question mark (fixed pattern)
    ];
    
    const matches = userInputPatterns.filter(pattern => pattern.test(contentStr));
    logger.info(`🔍 [USER INPUT CHECK] Found ${matches.length} patterns indicating user input needed`);
    
    return matches.length > 0;
  }

  /**
   * Extract elicitation question from AI response
   */
  extractElicitationQuestion(content) {
    if (!content) return 'Please provide more information about the enhancement scope.';
    
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Try to find the question the AI is asking
    const questionMatch = contentStr.match(/([^.!?]*\?)/g);
    if (questionMatch && questionMatch.length > 0) {
      return questionMatch[questionMatch.length - 1].trim();
    }
    
    // Fallback to first sentence if no question found
    const firstSentence = contentStr.split(/[.!?]/)[0];
    return firstSentence ? firstSentence.trim() + '?' : 'Please provide more information about the enhancement scope.';
  }

  /**
   * Extract classification from AI response
   */
  extractClassification(content) {
    if (!content) return null;
    
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Look for classification patterns
    const classificationPatterns = {
      'simple-enhancement': /simple[\s-]?enhancement|minor[\s-]?enhancement|small[\s-]?change/i,
      'major-enhancement': /major[\s-]?enhancement|significant[\s-]?enhancement|large[\s-]?change/i,
      'new-feature': /new[\s-]?feature|feature[\s-]?addition|brand[\s-]?new/i,
      'architectural-change': /architectural[\s-]?change|system[\s-]?redesign|major[\s-]?refactor/i,
      'bug-fix': /bug[\s-]?fix|defect[\s-]?fix|issue[\s-]?resolution/i
    };
    
    for (const [classification, pattern] of Object.entries(classificationPatterns)) {
      if (pattern.test(contentStr)) {
        return classification;
      }
    }
    
    return null;
  }

  /**
   * Validate execution result
   */
  isValidResult(result) {
    return result && 
           typeof result === 'object' && 
           (result.content || result.success === false) &&
           result.success !== undefined;
  }

  /**
   * Determine if the agent result should be saved as an artifact
   */
  shouldSaveAsArtifact(result, template, context) {
    // Only save actual document artifacts (finished documents)
    const documentArtifacts = [
      'project_brief', 'prd', 'product_requirements_document', 
      'architecture', 'system_architecture', 'technical_spec',
      'api_documentation', 'user_stories', 'epic_breakdown',
      'project_plan', 'design_spec', 'wireframes', 
      'database_schema', 'deployment_guide', 'testing_strategy',
      'brownfield-analysis', 'brownfield-prd', 'brownfield-architecture'
    ];
    
    // Check if this creates a document artifact
    if (context && context.creates) {
      const artifactName = context.creates.toLowerCase();
      const isDocumentArtifact = documentArtifacts.some(doc => 
        artifactName.includes(doc) || artifactName.endsWith('.md')
      );
      
      if (isDocumentArtifact && result.content && result.content.length > 200) {
        logger.info(`✅ [ARTIFACT CHECK] Will save document artifact: ${context.creates}`);
        return true;
      }
    }
    
    logger.info(`🚫 [ARTIFACT CHECK] Not saving - not a finished document`);
    return false;
  }

  /**
   * Get artifact filename based on context and template
   */
  getArtifactFilename(context, template) {
    let filename = 'document.md'; // Default
    
    if (template && template.output && template.output.filename) {
      filename = template.output.filename;
    } else if (context.creates) {
      filename = context.creates;
    }
    
    // Ensure .md extension
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }
    
    return filename;
  }

  /**
   * Extract document content from agent result (not conversational content)
   * This should only return content for finished documents like PRD, Architecture, etc.
   */
  extractDocumentContent(result, template, context) {
    // Only extract document content for specific document-creating steps
    if (!context.creates) {
      logger.info(`🚫 [DOCUMENT EXTRACT] No 'creates' field - this is conversational response, not document`);
      return null;
    }

    // Document artifacts that should be saved to S3
    const documentArtifacts = [
      'project-brief.md', 'prd.md', 'product_requirements_document.md',
      'architecture.md', 'system_architecture.md', 'technical_spec.md',
      'api_documentation.md', 'user_stories.md', 'epic_breakdown.md',
      'project_plan.md', 'design_spec.md', 'wireframes.md',
      'database_schema.md', 'deployment_guide.md', 'testing_strategy.md',
      'brownfield-analysis.md', 'brownfield-prd.md', 'brownfield-architecture.md',
      'fullstack-architecture.md', 'front-end-spec.md'
    ];

    const artifactName = context.creates.toLowerCase();
    const isDocumentArtifact = documentArtifacts.some(doc => 
      artifactName.includes(doc.replace('.md', '')) || artifactName === doc
    );

    if (isDocumentArtifact && result.content && result.content.length > 500) {
      logger.info(`✅ [DOCUMENT EXTRACT] Extracting document content for: ${context.creates}`);
      
      // Extract document content from result (could be in different formats)
      let documentContent = result.content;
      
      // If content is JSON formatted with main_response, extract that
      if (typeof documentContent === 'string' && documentContent.startsWith('```json')) {
        try {
          const jsonMatch = documentContent.match(/```json\n(.*?)\n```/s);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.main_response || parsed.document || parsed.content) {
              documentContent = parsed.main_response || parsed.document || parsed.content;
            }
          }
        } catch (e) {
          // Keep original content if JSON parsing fails
        }
      }

      return documentContent;
    }

    logger.info(`🚫 [DOCUMENT EXTRACT] Not a document artifact: ${context.creates} - this is conversational response`);
    return null;
  }

  // ============================================================================
  // SIMPLE CACHE OPERATIONS (no complex CacheManager needed)
  // ============================================================================

  getWorkflowState(workflowId) {
    // Workflow state now managed in database
    return null;
  }

  updateWorkflowState(workflowId, updates) {
    // Workflow state now managed in database
    logger.info(`Workflow state update for ${workflowId} - handled at database level`);
  }

  addAgentOutput(workflowId, agentId, output) {
    // Agent outputs now stored in database via workflow artifacts
    logger.info(`Agent output from ${agentId} for workflow ${workflowId} - stored in database`);
  }

  cleanupCaches() {
    this.cache.clear();
  }
}

module.exports = { SimplifiedAgentExecutor };