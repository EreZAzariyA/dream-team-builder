/**
 * Workflow Execution Service
 * Handles the core workflow execution logic without all the peripheral responsibilities
 */

import logger from '../../utils/logger.js';
import { WorkflowStatus } from '../types.js';

class WorkflowExecutor {
  constructor(stepExecutor, lifecycleManager, userInteractionService) {
    this.stepExecutor = stepExecutor;
    this.lifecycleManager = lifecycleManager;
    this.userInteractionService = userInteractionService;
  }

  /**
   * Execute workflow steps directly - core execution logic only
   */
  async executeWorkflow(workflowId) {
    logger.info(`🔄 Starting workflow execution: ${workflowId}`);

    const workflow = await this.lifecycleManager.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== WorkflowStatus.RUNNING) {
      logger.warn(`⚠️ Workflow ${workflowId} is not in RUNNING state (${workflow.status})`);
      return workflow;
    }

    const sequence = workflow.bmadWorkflowData?.sequence;
    if (!sequence || !Array.isArray(sequence)) {
      throw new Error(`Workflow ${workflowId} has invalid or missing sequence`);
    }

    logger.info(`📋 Workflow has ${sequence.length} steps, currently at step ${workflow.bmadWorkflowData.currentStep}`);

    // Execute steps from current position
    while (workflow.bmadWorkflowData.currentStep < sequence.length && workflow.status === WorkflowStatus.RUNNING) {
      const stepIndex = workflow.bmadWorkflowData.currentStep;
      const step = sequence[stepIndex];

      logger.info(`🎯 Executing step ${stepIndex + 1}/${sequence.length}: ${step.step || 'unnamed'}`);

      try {
        const stepResult = await this.stepExecutor.executeStep(workflowId, step, workflow);
        
        if (stepResult.status === 'waiting_for_user') {
          logger.info(`⏸️ Workflow paused waiting for user input at step ${stepIndex + 1}`);
          break;
        }

        if (stepResult.status === 'error') {
          workflow.status = WorkflowStatus.ERROR;
          workflow.errors = workflow.errors || [];
          workflow.errors.push({
            step: stepIndex,
            error: stepResult.error,
            timestamp: new Date()
          });
          await this.lifecycleManager.saveWorkflow(workflow);
          throw new Error(`Step ${stepIndex + 1} failed: ${stepResult.error}`);
        }

        // Move to next step
        workflow.bmadWorkflowData.currentStep++;
        await this.lifecycleManager.saveWorkflow(workflow);

      } catch (error) {
        logger.error(`❌ Step ${stepIndex + 1} execution failed: ${error.message}`);
        throw error;
      }
    }

    // Check if workflow is complete
    if (workflow.bmadWorkflowData.currentStep >= sequence.length) {
      await this.lifecycleManager.completeWorkflow(workflowId);
      logger.info(`✅ Workflow ${workflowId} completed successfully`);
    }

    return workflow;
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(workflowId, step, workflow) {
    return await this.stepExecutor.executeStep(workflowId, step, workflow);
  }
}

export default WorkflowExecutor;