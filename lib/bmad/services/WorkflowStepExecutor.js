/**
 * Workflow Step Executor
 * Handles execution of different step types (agent, action, decision, routing)
 */

import logger from '../../utils/logger.js';

class WorkflowStepExecutor {
  constructor(dependencies) {
    this.agentLoader = dependencies.agentLoader;
    this.contextBuilder = dependencies.contextBuilder;
    this.responseValidator = dependencies.responseValidator;
    this.errorRecoveryManager = dependencies.errorRecoveryManager;
    this.aiService = dependencies.aiService;
    this.userInteractionService = dependencies.userInteractionService;
    this.artifactManager = dependencies.artifactManager;
    this.lifecycleManager = dependencies.lifecycleManager;
  }

  /**
   * Execute a workflow step based on its type
   */
  async executeStep(workflowId, step, workflow) {
    logger.info(`🎯 Executing step: ${step.step || 'unnamed'} (type: ${this.determineStepType(step)})`);

    try {
      const stepType = this.determineStepType(step);
      
      switch (stepType) {
        case 'agent':
          return await this.executeAgentStep(workflowId, step, workflow);
        case 'action':
          return await this.executeActionStep(workflowId, step, workflow);
        case 'decision':
          return await this.executeDecisionStep(workflowId, step, workflow);
        case 'routing':
          return await this.executeRoutingStep(workflowId, step, workflow);
        default:
          logger.warn(`⚠️ Unknown step type for step: ${step.step}`);
          return await this.executeAgentStep(workflowId, step, workflow); // Default to agent step
      }
    } catch (error) {
      logger.error(`❌ Step execution failed: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Execute agent-based step
   */
  async executeAgentStep(workflowId, step, workflow) {
    const agentName = step.agent;
    if (!agentName) {
      throw new Error(`Step ${step.step} missing agent specification`);
    }

    // Load agent
    const agent = await this.agentLoader.loadAgent(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }

    // Build context for agent
    const context = await this.contextBuilder.buildAgentContext(agent, step, workflow);
    
    // Execute AI work with validation and error recovery
    try {
      const aiResponse = await this.executeAIWork(agent, step, context, workflow);
      
      // Handle artifact creation if step specifies it
      if (step.creates) {
        await this.artifactManager.saveArtifact(step.creates, aiResponse, workflow, agent);
        
        // Send completion message
        await this.userInteractionService.sendInfoMessage(
          workflowId,
          agent.name || agentName,
          `✅ ${step.creates} has been completed and saved.`
        );
      }

      return { 
        status: 'success', 
        agent: agent.name || agentName,
        provider: aiResponse.provider,
        outputLength: aiResponse.content?.length || 0,
        artifactCreated: step.creates
      };

    } catch (error) {
      // Attempt error recovery
      const recoveryResult = await this.errorRecoveryManager.handleError(error, {
        step,
        agent,
        workflow,
        workflowId
      });

      if (recoveryResult.success) {
        logger.info(`✅ [STEP-RECOVERY] Recovered from agent step error`);
        // Retry the step
        return await this.executeAgentStep(workflowId, step, workflow);
      }

      throw error;
    }
  }

  /**
   * Execute AI work with comprehensive validation
   */
  async executeAIWork(agent, step, context, workflow) {
    const agentPrompt = this.buildAgentPrompt(agent, step, context, workflow);
    
    logger.info(`🤖 Calling AI service for agent ${agent.name || step.agent}...`);
    
    // AI service call with error recovery
    let aiResponse;
    try {
      aiResponse = await this.aiService.call(
        agentPrompt,
        agent,
        'complex',
        context,
        workflow.userId
      );

      if (!aiResponse || !aiResponse.content) {
        throw new Error(`AI service returned empty response`);
      }
      
    } catch (aiError) {
      logger.warn(`⚠️ AI service call failed: ${aiError.message}`);
      
      // Attempt AI service recovery
      const recoveryResult = await this.errorRecoveryManager.handleError(aiError, {
        agent,
        step,
        context,
        workflow,
        retryCallback: () => this.aiService.call(agentPrompt, agent, 'complex', context, workflow.userId)
      });
      
      if (recoveryResult.success && recoveryResult.requiresRetry) {
        logger.info(`🔄 [AI-RECOVERY] Retrying AI call with adjustments`);
        
        const complexity = recoveryResult.strategy === 'use_fallback_model' ? 'simple' : 'complex';
        aiResponse = await this.aiService.call(
          agentPrompt,
          agent,
          complexity,
          recoveryResult.adjustedContext || context,
          workflow.userId
        );
      } else if (recoveryResult.fallback) {
        aiResponse = {
          content: recoveryResult.userMessage || "I encountered an issue and couldn't complete this step.",
          provider: 'fallback',
          model: 'error-recovery',
          isRecoveryResponse: true
        };
      } else {
        throw aiError;
      }
    }

    // Validate AI response
    const validationResult = await this.validateAIResponse(aiResponse, step, agent);
    aiResponse.validation = validationResult;

    return aiResponse;
  }

  /**
   * Validate AI response
   */
  async validateAIResponse(aiResponse, step, agent) {
    logger.info(`🔍 [VALIDATION] Validating AI response for ${agent.name || step.agent}`);
    
    try {
      const validationContext = {
        agent: agent.name || step.agent,
        step: step.step || 'unnamed_step',
        expectedArtifact: step.creates
      };

      // Determine expected format
      let expectedFormat = 'auto';
      if (step.creates) {
        if (step.creates.endsWith('.md')) expectedFormat = 'markdown';
        else if (step.creates.endsWith('.json')) expectedFormat = 'json';
        else if (step.creates.includes('code') || step.creates.includes('test')) expectedFormat = 'code';
        else expectedFormat = 'artifact';
      }

      const validationResult = await this.responseValidator.validateResponse(
        aiResponse, 
        expectedFormat, 
        validationContext
      );

      // Handle validation results
      if (!validationResult.isValid) {
        logger.warn(`⚠️ [VALIDATION] Response validation failed:`, validationResult.errors);
        
        if (validationResult.fallbackUsed) {
          aiResponse.content = validationResult.parsedContent?.content || aiResponse.content;
          aiResponse.validationWarning = 'Response had validation issues but was recovered';
        }
      }

      logger.info(`✅ [VALIDATION] Response validated - Confidence: ${validationResult.confidence.toFixed(2)}`);
      return validationResult;

    } catch (validationError) {
      logger.error(`❌ [VALIDATION] Validation error: ${validationError.message}`);
      return {
        isValid: false,
        confidence: 0.5,
        warnings: [`Validation error: ${validationError.message}`],
        errors: [validationError.message],
        sanitized: false,
        extractedData: {}
      };
    }
  }

  /**
   * Execute action step
   */
  async executeActionStep(workflowId, step, workflow) {
    logger.info(`⚡ Executing action step: ${step.action}`);
    
    // Action steps are typically system operations
    // This would be expanded based on specific action types needed
    
    return { 
      status: 'success', 
      action: step.action,
      message: `Action ${step.action} executed successfully`
    };
  }

  /**
   * Execute decision step
   */
  async executeDecisionStep(workflowId, step, workflow) {
    logger.info(`🤔 Executing decision step: ${step.condition}`);
    
    // Decision logic would be implemented here
    // For now, return success to continue workflow
    
    return { 
      status: 'success', 
      decision: 'continue',
      condition: step.condition
    };
  }

  /**
   * Execute routing step with AI decision making
   */
  async executeRoutingStep(workflowId, step, workflow) {
    logger.info(`🔀 Executing AI-driven routing step: ${step.step || 'routing_decision'}`);
    
    try {
      const workflowContext = await this.contextBuilder.buildRoutingContext(workflow, step);
      const aiDecision = await this.getAIRoutingDecision(workflowContext, step);
      
      if (aiDecision.success) {
        logger.info(`🎯 AI selected route: ${aiDecision.selectedRoute} - ${aiDecision.reason}`);
        
        // Send routing decision message
        await this.userInteractionService.sendInfoMessage(
          workflowId,
          'system',
          `🤖 AI Analysis: ${aiDecision.reason}\n📍 Proceeding with: ${aiDecision.selectedRoute}`
        );
        
        // Store routing decision
        workflow.context.routingDecisions = workflow.context.routingDecisions || {};
        workflow.context.routingDecisions[step.step] = {
          selectedRoute: aiDecision.selectedRoute,
          reason: aiDecision.reason,
          aiAnalysis: aiDecision.analysis,
          timestamp: new Date().toISOString()
        };
        
        workflow.context.selectedRoute = aiDecision.selectedRoute;
        await this.lifecycleManager.saveWorkflow(workflow);
        
        return { status: 'success', selectedRoute: aiDecision.selectedRoute };
      } else {
        return await this.executeFallbackRouting(step, workflow, workflowId);
      }
      
    } catch (error) {
      logger.error(`❌ AI routing error: ${error.message}`);
      return await this.executeFallbackRouting(step, workflow, workflowId);
    }
  }

  /**
   * Get AI routing decision with validation
   */
  async getAIRoutingDecision(workflowContext, step) {
    const prompt = this.buildRoutingPrompt(workflowContext, step);
    
    try {
      const { aiService } = await import('../../ai/AIService.js');
      if (!aiService.initialized) {
        return { success: false, error: 'AI service not available' };
      }
      
      const response = await aiService.call(prompt, null, 1, {
        action: 'workflow_routing',
        workflowId: workflowContext.workflowTemplate
      }, 'system');

      // Use ResponseValidator for JSON parsing
      const validationResult = await this.responseValidator.validateResponse(
        response,
        'json',
        {
          expectedStructure: 'routing_decision',
          requiresFields: ['selectedRoute', 'reason', 'success']
        }
      );

      if (validationResult.isValid && validationResult.parsedContent) {
        return validationResult.parsedContent;
      } else {
        // Fallback JSON parsing
        try {
          return JSON.parse(response.content);
        } catch (parseError) {
          return { success: false, error: 'Invalid AI response format' };
        }
      }
      
    } catch (error) {
      logger.error(`❌ AI routing service error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fallback routing when AI fails
   */
  async executeFallbackRouting(step, workflow, workflowId) {
    logger.info(`🔄 Executing fallback routing for ${step.step}`);
    
    const fallbackRoute = 'major_enhancement';
    
    await this.userInteractionService.sendInfoMessage(
      workflowId,
      'system',
      `⚠️ Using fallback routing logic\n📍 Proceeding with: ${fallbackRoute}`
    );
    
    workflow.context.selectedRoute = fallbackRoute;
    await this.lifecycleManager.saveWorkflow(workflow);
    
    return { status: 'success', selectedRoute: fallbackRoute, fallback: true };
  }

  // Helper methods
  determineStepType(step) {
    if (step.agent) return 'agent';
    if (step.action && !step.creates) return 'action';
    if (step.condition) return 'decision';
    if (step.routes) return 'routing';
    return 'agent'; // Default
  }

  buildAgentPrompt(agent, step, context, workflow) {
    // This would build the comprehensive agent prompt
    // For now, return a basic prompt structure
    return `You are ${agent.name || agent.role}. 
    
Current task: ${step.step}
${step.creates ? `Create: ${step.creates}` : ''}
${step.notes ? `Notes: ${step.notes}` : ''}

User request: ${workflow.userPrompt}

Please complete this task according to your role and expertise.`;
  }

  buildRoutingPrompt(workflowContext, step) {
    return `You are a BMAD workflow execution engine. Analyze the current workflow state and make an intelligent routing decision.

WORKFLOW CONTEXT:
${JSON.stringify(workflowContext, null, 2)}

CURRENT ROUTING STEP:
${JSON.stringify(step, null, 2)}

TASK: Determine which route to take based on:
1. User's original request: "${workflowContext.userPrompt}"
2. Any user responses or classifications from previous steps
3. The available routes in the current step
4. Repository context and complexity

Respond with ONLY a valid JSON object:
{
  "selectedRoute": "route_name",
  "reason": "Clear explanation why this route was chosen",
  "analysis": "Brief analysis of the user request and context",
  "success": true
}

Available routes: ${step.routes ? Object.keys(step.routes).join(', ') : 'No routes defined'}`;
  }
}

export default WorkflowStepExecutor;