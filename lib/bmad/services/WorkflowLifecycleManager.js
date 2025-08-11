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
      await this.engine.stepExecutor.executeNextStep(workflowId);

      return {
        workflowId,
        status: workflow.status,
        message: 'Workflow started successfully'
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
}

module.exports = { WorkflowLifecycleManager };