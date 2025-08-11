/**
 * Workflow Step Executor - Simplified Version
 * Focuses purely on workflow orchestration, delegates ALL retry logic to AgentExecutor
 * 
 * PRINCIPLES:
 * - Pure Orchestration: No retry logic, just workflow coordination
 * - Single Execution Path: One call to AgentExecutor per step
 * - Clear Delegation: AgentExecutor owns all execution concerns
 * - Workflow Focus: Handles step progression, agent coordination, error routing
 */

const { WorkflowStatus, AgentStatus } = require('../types.js');
import logger from '../../utils/logger.js';

class WorkflowStepExecutor {
  constructor(workflowEngine) {
    this.engine = workflowEngine;
  }

  async executeNextStep(workflowId) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      if (workflow.currentStep >= workflow.sequence.length) {
        await this.engine.lifecycleManager.completeWorkflow(workflowId);
        return;
      }

      if (workflow.status !== WorkflowStatus.PAUSED_FOR_ELICITATION) {
        workflow.status = WorkflowStatus.RUNNING;
      }

      const step = workflow?.sequence[workflow.currentStep];
      
      // --- START MODIFICATION: Enrich workflow:step-update event ---
      const currentStepDetails = {
        stepIndex: workflow.currentStep,
        stepName: step.stepName || step.action || 'Unnamed Step',
        agentId: step.agentId,
        description: step.description || step.notes || '',
        command: step.command || step.uses || '',
        action: step.action || '',
        status: 'running', // Mark as running when execution starts
      };

      this.engine.communicator.sendMessage(workflowId, {
        from: 'bmad-orchestrator',
        to: 'user',
        type: 'workflow:step-update',
        content: {
          workflowId: workflow.id,
          currentStepIndex: workflow.currentStep,
          totalWorkflowSteps: workflow.sequence.length,
          currentStepDetails: currentStepDetails,
          workflowProgress: Math.round(((workflow.currentStep + 1) / workflow.sequence.length) * 100),
        },
        timestamp: new Date()
      });
      // --- END MODIFICATION ---

      // Handle 'various' agent for dynamic selection
      if (step.agentId === 'various') {
        workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION; // Or a new status like PAUSED_FOR_AGENT_SELECTION
        workflow.elicitationDetails = {
          sectionTitle: 'Agent Selection Required',
          instruction: step.notes || 'Please select the appropriate agent to address the issues.',
          sectionId: 'agent_selection',
          agentId: 'bmad-orchestrator', // BMad Orchestrator is asking for input
          agentName: 'BMad Orchestrator'
        };

        await this.engine.communicator.sendMessage(workflowId, {
          from: 'bmad-orchestrator',
          to: 'user',
          type: 'elicitation_request',
          content: workflow.elicitationDetails
        });
        return; // Pause workflow until user provides agent selection
      }

      const agent = await this.engine.agentLoader.loadAgent(step.agentId);

      if (!agent) {
        throw new Error(`Agent ${step.agentId} not found`);
      }

      if (workflow.checkpointEnabled) {
        await this.engine.checkpointManager.create(workflowId, `before_agent_${step.agentId}`, `Before executing ${step.agentId} at step ${workflow.currentStep}`);
      }

      workflow.currentAgent = step.agentId;
      this.engine.agentLoader.updateAgentStatus(step.agentId, AgentStatus.ACTIVE, {
        workflowId,
        executionId: this.generateExecutionId()
      });

      // Phase 2: Load required artifacts
      if (step.requires && Array.isArray(step.requires)) {
        for (const artifactType of step.requires) {
          const artifact = await this.engine.artifactManager.loadDocument(artifactType, step.agentId);
          if (artifact) {
            // Avoid duplicating artifacts
            if (!workflow.artifacts.some(a => a.path === artifact.path)) {
              workflow.artifacts.push(artifact);
            }
          }
        }
      }

      const agentContext = this.prepareAgentContext(workflow, step, agent);
      agentContext.command = step.command; // Add the command to the context

      if (!step.command && step.notes && !step.uses) {
        workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
        workflow.elicitationDetails = {
          sectionTitle: step.action || 'User Input Required',
          instruction: step.notes,
          sectionId: step.stepName || `step_${step.index}`,
          agentId: step.agentId,
        };

        await this.engine.communicator.sendMessage(workflowId, {
          from: step.agentId,
          to: 'user',
          type: 'elicitation_request',
          content: workflow.elicitationDetails,
        });
        return; // Stop execution and wait for user input
      }

      await this.engine.communicator.sendMessage(workflowId, {
        from: 'bmad-orchestrator',
        to: step.agentId,
        type: 'activation',
        content: {
          instructions: agent.activationInstructions,
          context: agentContext,
          userPrompt: workflow.userPrompt
        },
        timestamp: new Date()
      });

      // SIMPLIFIED: Single call to AgentExecutor with unified retry config
      // CRITICAL FIX: Mark live workflow mode for conversational responses
      agentContext.chatMode = true; // Enable conversational mode for live workflows
      agentContext.workflowMode = 'live'; // Indicate this is a live workflow
      
      const executionResult = await this.executeAgentUnified(workflowId, step.agentId, agentContext);

      if (executionResult.success || executionResult.timedOut) {
        await this.handleAgentCompletion(workflowId, step.agentId, executionResult);
      // Phase 2: Centralized Elicitation Logic
      } else if (executionResult.elicitationRequired || executionResult.type === 'elicitation_required') {
        workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
        
        const elicitationDetails = {
          sectionTitle: executionResult.elicitationData?.sectionTitle || 'User Input Required',
          instruction: executionResult.elicitationData?.instruction || 'Please provide additional information',
          sectionId: executionResult.elicitationData?.sectionId,
          agentId: step.agentId
        };

        const elicitationRequest = await this.engine.elicitationHandler.prepareElicitationRequest(elicitationDetails);

        workflow.elicitationDetails = elicitationRequest;
        workflow.currentAgent = step.agentId;
        
        await this.engine.communicator.sendMessage(workflowId, {
          from: step.agentId,
          to: 'user',
          type: 'elicitation_request',
          content: elicitationRequest
        });
        
        return;
      } else {
        workflow.status = WorkflowStatus.ERROR;
        // workflow.errors.push({
        //   timestamp: new Date(),
        //   error: `Agent ${step.agentId} execution failed: ${executionResult.error}`,
        //   step: workflow.currentStep,
        //   agent: step.agentId,
        //   type: 'agent_failure'
        // });
        return;
      }

    } catch (error) {
      const rollbackSuccess = await this.handleCriticalFailure(workflowId, error);
      
      if (!rollbackSuccess) {
        workflow.status = WorkflowStatus.ERROR;
        // Prevent recursive error object creation - only store the error message string
        let errorMessage;
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if (error && error.toString && typeof error.toString === 'function') {
          errorMessage = error.toString();
        } else {
          errorMessage = 'Unknown error occurred during critical failure handling';
        }
        
        workflow.errors.push({
          timestamp: new Date(),
          error: errorMessage,
          step: workflow.currentStep,
          agent: workflow.currentAgent
        });
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * SIMPLIFIED AGENT EXECUTION - No nested retry logic!
   * All retry/timeout logic handled by AgentExecutor itself
   */
  async executeAgentUnified(workflowId, agentId, context, userId = null) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    const agent = await this.engine.agentLoader.loadAgent(agentId);
    
    const step = workflow.sequence[workflow.currentStep];
    const timeout = step.timeout || this.engine.defaultTimeout;
    const clampedTimeout = Math.min(Math.max(timeout, 10000), this.engine.maxTimeout);

    // Configure execution options for AgentExecutor
    const executionOptions = {
      timeout: clampedTimeout,
      maxRetries: (this.engine.timeoutRetries || 1) + 1, // Convert workflow retries to total attempts
      validation: true,
      workflowId: workflowId
    };

    try {
      // SINGLE CALL - AgentExecutor handles ALL retry logic internally
      // Pass userId for AI service initialization
      if (userId) {
        context.userId = userId;
      }
      const executionResult = await this.engine.executor.executeAgent(agent, context, executionOptions);

      // Update agent status based on result
      if (executionResult.success) {
        this.engine.agentLoader.updateAgentStatus(agentId, AgentStatus.COMPLETED, {
          workflowId,
          result: executionResult
        });
      } else if (executionResult.timedOut) {
        this.engine.agentLoader.updateAgentStatus(agentId, AgentStatus.TIMEOUT, {
          workflowId,
          error: executionResult.error,
          attempts: executionResult.attempts
        });
      } else {
        this.engine.agentLoader.updateAgentStatus(agentId, AgentStatus.ERROR, {
          workflowId,
          error: executionResult.error,
          attempts: executionResult.attempts
        });
      }

      return executionResult;

    } catch (error) {
      // This should rarely happen now since AgentExecutor handles all errors internally
      this.engine.agentLoader.updateAgentStatus(agentId, AgentStatus.ERROR, {
        workflowId,
        error: error.message
      });
      
      return {
        agentId,
        agentName: agent?.agent?.name || agent.id,
        executionTime: 0,
        artifacts: [],
        messages: [`Agent ${agentId} failed with unexpected error: ${error.message}`],
        success: false,
        error: error.message,
        timedOut: false,
        attempts: 1
      };
    }
  }

  async handleAgentCompletion(workflowId, agentId, executionResult) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    const currentStep = workflow.sequence[workflow.currentStep];

    // Create artifacts if the step specifies 'creates' and agent provided output
    if (currentStep.creates && executionResult.success && executionResult.output?.content) {
      const artifactId = currentStep.creates;
      const artifact = {
        id: artifactId,
        type: 'agent_output',
        content: executionResult.output.content,
        createdBy: agentId,
        step: workflow.currentStep,
        timestamp: new Date()
      };
      
      // Store in workflow artifacts
      workflow.artifacts.push(artifact);
      
      // Store in workflow context artifacts map
      if (!workflow.context.artifacts) {
        workflow.context.artifacts = new Map();
      }
      workflow.context.artifacts.set(artifactId, artifact);
      
      logger.info(`📦 [ARTIFACT CREATED] Agent ${agentId} created artifact: ${artifactId}`);
    }
    
    // Special handling for classification steps without explicit 'creates' field
    logger.info(`🔍 [HANDLE AGENT COMPLETION] Step: ${currentStep.action}, Success: ${executionResult.success}, HasOutput: ${!!executionResult.output}, HasContent: ${!!executionResult.output?.content}`);
    
    if (currentStep.action === 'classify enhancement scope' && executionResult.success && executionResult.output?.content) {
      const classificationArtifact = {
        id: 'enhancement_classification',
        type: 'classification_result',
        content: executionResult.output.content,
        createdBy: agentId,
        step: workflow.currentStep,
        timestamp: new Date()
      };
      
      // Store classification artifact
      workflow.artifacts.push(classificationArtifact);
      if (!workflow.context.artifacts) {
        workflow.context.artifacts = new Map();
      }
      workflow.context.artifacts.set('enhancement_classification', classificationArtifact);
      
      logger.info(`🧠 [CLASSIFICATION ARTIFACT] Created enhancement classification artifact from agent output`);
    } else if (currentStep.action === 'classify enhancement scope') {
      logger.warn(`🚨 [CLASSIFICATION ARTIFACT] Failed to create artifact - missing conditions: success=${executionResult.success}, hasOutput=${!!executionResult.output}, hasContent=${!!executionResult.output?.content}`);
    }

    this.engine.agentLoader.updateAgentStatus(agentId, AgentStatus.IDLE);

    // CRITICAL FIX: Send agent's actual response to user
    if (executionResult.success && executionResult.output) {
      const agentResponseContent = executionResult.output.content || executionResult.output.message || 'Agent completed task successfully';
      
      // Send the agent's response directly to the user
      await this.engine.communicator.sendMessage(workflowId, {
        from: agentId,
        to: 'user',
        type: 'completion',
        content: {
          agentRole: agentId,
          summary: `${agentId} completed: ${currentStep.action || currentStep.stepName || 'task'}`,
          response: agentResponseContent,
          executionTime: executionResult.executionTime || 0,
          artifacts: executionResult.artifacts || [],
          success: true,
          // CRITICAL FIX: Pass through conversational mode metadata
          conversationalMode: true,
          chatMode: true,
          workflowMode: 'live'
        },
        timestamp: new Date()
      });

      logger.info(`📤 [AGENT RESPONSE] Sent ${agentId} response to user: ${agentResponseContent.substring(0, 100)}...`);
    }

    // --- START MODIFICATION: Enrich workflow:step-update event for completion ---
    const completedStepDetails = {
      stepIndex: workflow.currentStep,
      stepName: currentStep.stepName || currentStep.action || 'Unnamed Step',
      agentId: agentId,
      description: currentStep.description || currentStep.notes || '',
      command: currentStep.command || currentStep.uses || '',
      action: currentStep.action || '',
      status: 'completed', // Mark as completed
      executionResult: { success: executionResult.success, error: executionResult.error, artifacts: executionResult.artifacts }
    };

    this.engine.communicator.sendMessage(workflowId, {
      from: 'bmad-orchestrator',
      to: 'user',
      type: 'workflow:step-update',
      content: {
        workflowId: workflow.id,
        currentStepIndex: workflow.currentStep,
        totalWorkflowSteps: workflow.sequence.length,
        currentStepDetails: completedStepDetails,
        workflowProgress: Math.round(((workflow.currentStep + 1) / workflow.sequence.length) * 100),
      },
      timestamp: new Date()
    });
    // --- END MODIFICATION ---

    if (workflow.currentAgent !== agentId) {
      return;
    }

    // Phase 3: Dynamic Step Injection
    if (executionResult.newSteps && Array.isArray(executionResult.newSteps)) {
      this.engine.injectSteps(workflowId, executionResult.newSteps, workflow.currentStep + 1);
    }

    // Phase 3: Conditional Pathing Logic
    let nextStepIndex = -1;

    if (executionResult.success && currentStep.onSuccess && currentStep.onSuccess.goto) {
      nextStepIndex = workflow.sequence.findIndex(step => step.stepName === currentStep.onSuccess.goto);
    } else if (!executionResult.success && currentStep.onFailure && currentStep.onFailure.goto) {
      nextStepIndex = workflow.sequence.findIndex(step => step.stepName === current.onFailure.goto);
    }

    if (nextStepIndex !== -1) {
      workflow.currentStep = nextStepIndex;
    } else {
      // Default behavior: proceed to the next step
      workflow.currentStep++;
    }

    workflow.currentAgent = null;

    if (workflow.currentStep < workflow.sequence.length) {
      await this.executeNextStep(workflowId);
    } else {
      await this.engine.lifecycleManager.completeWorkflow(workflowId);
    }
  }

  async handleCriticalFailure(workflowId, error) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow || !workflow.checkpointEnabled) {
      return false;
    }

    try {
      const checkpointDocs = await this.engine.databaseService.getCheckpoints(workflowId);
      if (checkpointDocs.length === 0) {
        return false;
      }

      const safeCheckpoint = checkpointDocs
        .filter(cp => cp.type !== `before_agent_${workflow.currentAgent}`)
        .shift();

      if (!safeCheckpoint) {
        return false;
      }

      await this.engine.checkpointManager.rollback(workflowId, safeCheckpoint.checkpointId);

      await this.engine.communicator.sendMessage(workflowId, {
        from: 'bmad-orchestrator',
        to: 'user',
        type: 'error',
        content: {
          message: `Critical failure detected. Auto-rolled back to safe checkpoint.`,
          originalError: error.message,
          checkpointId: safeCheckpoint.checkpointId,
          autoRollback: true,
          canResume: true
        },
        timestamp: new Date()
      });

      return true;

    } catch (rollbackError) {
      return false;
    }
  }

  prepareAgentContext(workflow, step, agent) {
    return {
      workflowId: workflow.id,
      step: workflow.currentStep,
      totalSteps: workflow.sequence.length,
      userPrompt: workflow.userPrompt,
      previousArtifacts: workflow.artifacts,
      workflowContext: workflow.context,
      agentRole: step.role,
      agentDescription: step.description,
      metadata: workflow.metadata
    };
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

module.exports = { WorkflowStepExecutor };