/**
 * Workflow Lifecycle Manager
 * Handles workflow creation, initialization, completion, and state transitions
 */

const { WorkflowStatus } = require('../types.js');
const { logUserActivity } = require('../../utils/activityLogger.js');

class WorkflowLifecycleManager {
  constructor(workflowEngine) {
    this.engine = workflowEngine;
  }

  async startWorkflow(config) {
    const workflowId = config.workflowId || this.generateWorkflowId();

    try {
      let sequence = [];
      let initialArtifacts = [];

      // Phase 2: Check if workflow is template-based
      if (config.templateName) {
        const template = await this.engine.templateProcessor.loadTemplate(config.templateName);
        const templateResult = await this.engine.templateProcessor.process(
          config.templateName,
          config.context,
          config.context.initiatedBy
        );

        // The sequence of the workflow is the sections of the template
        sequence = template.sections.map(section => ({
          agentId: section.owner || 'pm', // Default to PM if no owner
          action: `Process section: ${section.title}`,
          creates: section.id,
          requires: section.requires || [],
        }));

        if (templateResult.status === 'elicitation_required') {
          workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
          workflow.elicitationDetails = templateResult.elicitation;
        } else {
          initialArtifacts.push({
            type: 'document',
            id: config.templateName,
            content: templateResult.document,
            createdBy: 'system',
          });
        }

      } else {
        sequence = Array.isArray(config.sequence) ? config.sequence : (this.engine.getWorkflowSequence(config.sequence));
      }

      const workflow = {
        id: workflowId,
        name: config.name || 'BMAD Workflow',
        description: config.description || 'Automated BMAD workflow execution',
        sequence: sequence,
        userPrompt: config.userPrompt || '',
        status: WorkflowStatus.INITIALIZING,
        currentStep: 0,
        currentAgent: null,
        startTime: new Date(),
        endTime: null,
        context: config.context || {},
        artifacts: initialArtifacts,
        messages: [],
        errors: [],
        metadata: config.metadata || {},
        checkpointEnabled: this.engine.checkpointEnabled
      };

      const validation = await this.engine.agentLoader.validateWorkflowSequence(workflow.sequence);
      if (!validation.valid) {
        throw new Error(`Invalid workflow sequence: ${validation.errors.join(', ')}`);
      }

      this.engine.activeWorkflows.set(workflowId, workflow);
      await this.engine.databaseService.saveWorkflow(workflowId, workflow, workflow.context?.initiatedBy || 'system');

      if (workflow.checkpointEnabled) {
        await this.engine.checkpointManager.create(workflowId, 'workflow_initialized', 'Workflow started and validated');
      }

      await logUserActivity(workflow.context.initiatedBy, 'workflow_start', { workflowId, name: workflow.name, prompt: workflow.userPrompt });
      
      // PERFORMANCE FIX: Execute first step asynchronously to prevent deployment API blocking
      // Start workflow execution in background without waiting
      setImmediate(async () => {
        try {
          console.log(`🚀 [WorkflowLifecycle] Starting async execution for workflow: ${workflowId}`);
          
          // Add detailed logging to debug workflow execution
          const workflowBeforeExecution = this.engine.activeWorkflows.get(workflowId);
          if (!workflowBeforeExecution) {
            throw new Error(`Workflow ${workflowId} not found in active workflows during async execution`);
          }
          
          console.log(`🔍 [WorkflowLifecycle] Workflow state before execution:`, {
            workflowId,
            currentStep: workflowBeforeExecution.currentStep,
            sequenceLength: workflowBeforeExecution.sequence?.length,
            status: workflowBeforeExecution.status,
            hasSequence: !!workflowBeforeExecution.sequence
          });
          
          if (!workflowBeforeExecution.sequence || workflowBeforeExecution.sequence.length === 0) {
            throw new Error(`Workflow ${workflowId} has no sequence to execute`);
          }
          
          await this.engine.stepExecutor.executeNextStep(workflowId);
          console.log(`✅ [WorkflowLifecycle] First step execution completed for workflow: ${workflowId}`);
          
        } catch (error) {
          console.error(`❌ [WorkflowLifecycle] Async step execution failed for ${workflowId}:`, error);
          console.error(`❌ [WorkflowLifecycle] Error stack:`, error.stack);
          
          // Update workflow status to error on async failure
          const failedWorkflow = this.engine.activeWorkflows.get(workflowId);
          if (failedWorkflow) {
            failedWorkflow.status = 'ERROR';
            failedWorkflow.errors.push({
              timestamp: new Date(),
              error: error.message,
              step: failedWorkflow.currentStep,
              agent: failedWorkflow.currentAgent,
              type: 'async_execution_failure',
              stack: error.stack
            });
            
            // Send error notification to frontend
            try {
              await this.engine.pusherService.triggerWorkflowError(workflowId, {
                error: error.message,
                type: 'async_execution_failure',
                step: failedWorkflow.currentStep
              });
            } catch (pusherError) {
              console.error(`❌ [WorkflowLifecycle] Failed to send error notification:`, pusherError);
            }
          }
        }
      });

      // Return immediately without waiting for first step execution
      return {
        workflowId,
        status: 'INITIALIZING', // Status will update to RUNNING when first step starts
        message: 'Workflow started successfully - execution beginning asynchronously'
      };

    } catch (error) {
      const workflow = this.engine.activeWorkflows.get(workflowId);
      if (workflow) {
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
          errorMessage = 'Unknown error occurred during workflow start';
        }
        
        workflow.errors.push({
          timestamp: new Date(),
          error: errorMessage,
          step: workflow.currentStep
        });
      }
      throw new Error(typeof error === 'string' ? error : (error?.message || 'Workflow start failed'));
    }
  }

  async startDynamicWorkflow(config, userId) {
    return this.engine.dynamicWorkflowHandler.start(config, userId);
  }

  async completeWorkflow(workflowId, customMessage = null) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = WorkflowStatus.COMPLETED;
    workflow.endTime = new Date();
    workflow.currentAgent = null;

    // CRITICAL FIX: Notify AgentTeam of workflow completion
    await this.notifyTeamDeploymentCompletion(workflowId, workflow);

    try {
      const savedArtifacts = await this.engine.artifactManager.saveWorkflowArtifacts(workflowId, workflow.artifacts);
      workflow.savedArtifacts = savedArtifacts;
    } catch (error) {
      // Prevent recursive error object creation - only store the error message string
      let errorMessage;
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error && error.toString && typeof error.toString === 'function') {
        errorMessage = error.toString();
      } else {
        errorMessage = 'Unknown error occurred';
      }
      
      workflow.errors.push({
        timestamp: new Date(),
        error: `Failed to save artifacts: ${errorMessage}`,
        step: 'completion'
      });
    }

    // Only send system completion message if no custom message was provided
    if (!customMessage) {
      await this.engine.communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'user',
        type: 'workflow_complete',
        content: {
          workflowId,
          totalSteps: workflow.sequence.length,
          executionTime: workflow.endTime - workflow.startTime,
          artifactCount: workflow.artifacts.length,
          savedArtifacts: workflow.savedArtifacts?.length || 0,
          success: true,
          userPrompt: workflow.userPrompt,
          context: workflow.context
        },
        timestamp: new Date()
      });
    }

    this.engine.executionHistory.set(workflowId, workflow);
    this.engine.activeWorkflows.delete(workflowId);
    
    if (workflow.checkpointEnabled) {
      await this.engine.checkpointManager.create(workflowId, 'workflow_completed', 'Workflow completed successfully');
    }

    await this.engine.databaseService.saveAnalytics(workflow);
    await logUserActivity(workflow.context.initiatedBy, 'workflow_complete', { workflowId, status: workflow.status, duration: workflow.endTime - workflow.startTime });

    try {
      const AIService = (await import('../../ai/AIService.js')).default;
      const aiService = AIService.getInstance();
      if (aiService && workflow.context.initiatedBy) {
        aiService.clearQueue(workflow.context.initiatedBy);
      }
    } catch (error) {
      // Silent fail for AI service cleanup
    }
  }

  async pauseWorkflow(workflowId) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
    
    if (workflow.currentAgent) {
      this.engine.agentLoader.updateAgentStatus(workflow.currentAgent, 'PAUSED');
    }

    return { workflowId, status: workflow.status };
  }

  async resumeWorkflow(workflowId) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.RUNNING;
    
    if (workflow.currentAgent) {
      this.engine.agentLoader.updateAgentStatus(workflow.currentAgent, 'ACTIVE');
    }

    await this.engine.stepExecutor.executeNextStep(workflowId);
    return { workflowId, status: workflow.status };
  }

  async cancelWorkflow(workflowId) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.CANCELLED;
    workflow.endTime = new Date();
    
    if (workflow.currentAgent) {
      this.engine.agentLoader.updateAgentStatus(workflow.currentAgent, 'IDLE');
    }

    this.engine.executionHistory.set(workflowId, workflow);
    this.engine.activeWorkflows.delete(workflowId);

    await this.engine.databaseService.saveAnalytics(workflow);

    return { workflowId, status: workflow.status };
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * CRITICAL FIX: Notify AgentTeam when workflow completes successfully
   * This ensures team deployment status is updated when workflow finishes
   */
  async notifyTeamDeploymentCompletion(workflowId, workflow) {
    try {
      // Import AgentTeam model dynamically to avoid circular dependencies
      const { connectMongoose } = require('../../database/mongodb.js');
      await connectMongoose();
      
      const AgentTeam = require('../../database/models/AgentTeam.js').default;
      
      // Find the team deployment associated with this workflow
      const teamDeployment = await AgentTeam.findOne({
        'deployment.workflowInstanceId': workflowId,
        'deployment.status': { $in: ['deploying', 'active'] }
      });

      if (teamDeployment) {
        // Complete the team deployment
        await teamDeployment.complete({
          workflowCompletion: true,
          workflowId: workflowId,
          completedAt: 'workflow_execution',
          workflowDuration: workflow.endTime - workflow.startTime,
          totalSteps: workflow.sequence?.length || 0,
          artifactsGenerated: workflow.artifacts?.length || 0
        });

        console.log(`🔗 [WorkflowLifecycleManager] Team deployment ${teamDeployment.teamInstanceId} marked as completed`);
      } else {
        console.warn(`⚠️ [WorkflowLifecycleManager] No team deployment found for completed workflow ${workflowId}`);
      }
    } catch (notificationError) {
      // Don't throw - notification failure shouldn't break the main workflow completion
      console.error('❌ [WorkflowLifecycleManager] Failed to notify team deployment of workflow completion:', notificationError.message);
    }
  }
}

module.exports = { WorkflowLifecycleManager };