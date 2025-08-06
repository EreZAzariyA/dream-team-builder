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
    logger.info('🔍 [STEP EXECUTOR DEBUG] executeNextStep called with workflowId:', workflowId);
    
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    logger.info('🔍 [STEP EXECUTOR DEBUG] Retrieved workflow:');
    logger.info(`  - workflow.id: ${workflow.id}`);
    logger.info(`  - workflow.sequence type: ${typeof workflow.sequence}`);
    logger.info(`  - workflow.sequence.length: ${workflow.sequence?.length}`);
    logger.info(`  - workflow.currentStep: ${workflow.currentStep}`);
    logger.info(`  - workflow.metadata.workflowType: ${workflow.metadata?.workflowType}`);

    try {
      if (workflow.currentStep >= workflow.sequence.length) {
        await this.engine.lifecycleManager.completeWorkflow(workflowId);
        return;
      }

      if (workflow.status !== WorkflowStatus.PAUSED_FOR_ELICITATION) {
        workflow.status = WorkflowStatus.RUNNING;
      }

      const step = workflow?.sequence[workflow.currentStep];
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

      logger.info('WorkflowStepExecutor - Step before context:', step); // DEBUG LOG
      const agentContext = this.prepareAgentContext(workflow, step, agent);
      agentContext.command = step.command; // Add the command to the context
      logger.info('WorkflowStepExecutor - Agent context after command:', agentContext); // DEBUG LOG

      await this.engine.communicator.sendMessage(workflowId, {
        from: 'system',
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
      const executionResult = await this.executeAgentUnified(workflowId, step.agentId, agentContext);

      if (executionResult.success || executionResult.timedOut) {
        await this.handleAgentCompletion(workflowId, step.agentId, executionResult);
      } else if (executionResult.elicitationRequired || executionResult.type === 'elicitation_required') {
        workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
        workflow.elicitationDetails = {
          sectionTitle: executionResult.elicitationData?.sectionTitle || 'User Input Required',
          instruction: executionResult.elicitationData?.instruction || 'Please provide additional information',
          sectionId: executionResult.elicitationData?.sectionId,
          agentId: step.agentId
        };
        workflow.currentAgent = step.agentId;
        
        await this.engine.communicator.sendMessage(workflowId, {
          from: step.agentId,
          to: 'user',
          type: 'elicitation_request',
          content: {
            sectionTitle: executionResult.elicitationData?.sectionTitle || 'User Input Required',
            instruction: executionResult.elicitationData?.instruction || 'Please provide additional information',
            sectionId: executionResult.elicitationData?.sectionId,
            agentId: step.agentId
          }
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
        workflow.errors.push({
          timestamp: new Date(),
          error: error.message,
          step: workflow.currentStep,
          agent: workflow.currentAgent
        });
        throw error;
      }
    }
  }

  /**
   * SIMPLIFIED AGENT EXECUTION - No nested retry logic!
   * All retry/timeout logic handled by AgentExecutor itself
   */
  async executeAgentUnified(workflowId, agentId, context) {
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
    
    if (executionResult.type === 'elicitation_required') {
      workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
      workflow.elicitationDetails = executionResult;
      await this.engine.communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'user',
        type: 'elicitation_required',
        content: executionResult,
        timestamp: new Date()
      });
      return;
    }

    if (executionResult.artifacts && executionResult.artifacts.length > 0) {
      workflow.artifacts.push(...executionResult.artifacts);
    }
    
    const completionMessage = {
      from: agentId,
      to: 'system',
      type: 'completion',
      content: executionResult,
      timestamp: new Date()
    };
    
    workflow.messages.push(completionMessage);
    
    const currentStep = workflow.sequence[workflow.currentStep];
    const agentRole = currentStep?.role || 'Unknown Role';
    
    await this.engine.communicator.sendMessage(workflowId, {
      from: agentId,
      to: 'system',
      type: 'completion',
      content: {
        summary: `Agent ${agentId} completed - Generated ${executionResult.artifacts?.length || 0} artifacts in ${Math.round(executionResult.executionTime || 0)}ms (${executionResult.attempts} attempts)`,
        artifacts: executionResult.artifacts?.map(a => a.name).join(', ') || 'No artifacts',
        executionTime: executionResult.executionTime,
        success: executionResult.success,
        agentRole: agentRole,
        attempts: executionResult.attempts
      }
    });

    // Handle execution issues
    if (!executionResult.success) {
      if (executionResult.timedOut) {
        workflow.errors.push({
          timestamp: new Date(),
          error: `Agent ${agentId} execution timeout after ${executionResult.attempts} attempts`,
          step: workflow.currentStep,
          agent: agentId,
          type: 'timeout',
          attempts: executionResult.attempts
        });
        
        await this.engine.communicator.sendMessage(workflowId, {
          from: 'system',
          to: 'user',
          type: 'error',
          content: {
            message: `Agent ${agentId} execution timed out after ${executionResult.attempts} attempts, continuing with limited results`,
            agentId,
            step: workflow.currentStep,
            canContinue: true,
            attempts: executionResult.attempts
          },
          timestamp: new Date()
        });
      } else {
        workflow.errors.push({
          timestamp: new Date(),
          error: executionResult.error,
          step: workflow.currentStep,
          agent: agentId,
          type: 'execution_error',
          attempts: executionResult.attempts
        });
      }
    }

    this.engine.agentLoader.updateAgentStatus(agentId, AgentStatus.IDLE);

    if (workflow.currentAgent !== agentId) {
      return;
    }

    workflow.currentStep++;
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
        from: 'system',
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