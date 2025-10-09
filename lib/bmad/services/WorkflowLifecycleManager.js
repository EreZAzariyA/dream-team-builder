/**
 * Workflow Lifecycle Manager
 * Handles workflow state transitions and persistence
 */

import logger from '../../utils/logger.js';
import Workflow from '../../database/models/Workflow.js';
import { WorkflowStatus } from '../types.js';

class WorkflowLifecycleManager {
  constructor(pusherService) {
    this.pusherService = pusherService;
  }

  /**
   * Load workflow from database
   */
  async loadWorkflow(workflowId) {
    try {
      const workflow = await Workflow.findOne({ workflowId: workflowId }).exec();
      if (!workflow) return null;

      // Ensure artifacts is a Map
      if (workflow.context?.artifacts && !(workflow.context.artifacts instanceof Map)) {
        if (Array.isArray(workflow.context.artifacts)) {
          workflow.context.artifacts = new Map(workflow.context.artifacts);
        } else if (typeof workflow.context.artifacts === 'object') {
          workflow.context.artifacts = new Map(Object.entries(workflow.context.artifacts));
        } else {
          workflow.context.artifacts = new Map();
        }
      }

      return workflow;
    } catch (error) {
      logger.error(`❌ Error loading workflow ${workflowId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save workflow to database
   */
  async saveWorkflow(workflowData) {
    try {
      // Convert Map to Array for storage
      if (workflowData.context?.artifacts instanceof Map) {
        workflowData.context.artifacts = Array.from(workflowData.context.artifacts.entries());
      }

      workflowData.updatedAt = new Date();

      const result = await Workflow.findOneAndUpdate(
        { workflowId: workflowData.workflowId },
        workflowData,
        { upsert: true, new: true }
      ).exec();

      return result;
    } catch (error) {
      logger.error(`❌ Error saving workflow ${workflowData.workflowId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId) {
    const workflow = await this.loadWorkflow(workflowId);
    return workflow ? workflow.status : null;
  }

  /**
   * Pause workflow
   */
  async pauseWorkflow(workflowId) {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.PAUSED;
    await this.saveWorkflow(workflow);

    logger.info(`⏸️ Workflow ${workflowId} paused`);
    return workflow;
  }

  /**
   * Resume workflow
   */
  async resumeWorkflow(workflowId) {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.RUNNING;
    await this.saveWorkflow(workflow);

    logger.info(`▶️ Workflow ${workflowId} resumed`);
    return workflow;
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(workflowId) {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.CANCELLED;
    workflow.completedAt = new Date();
    await this.saveWorkflow(workflow);

    logger.info(`🛑 Workflow ${workflowId} cancelled`);
    return workflow;
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(workflowId) {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.COMPLETED;
    workflow.completedAt = new Date();
    workflow.endTime = new Date();
    await this.saveWorkflow(workflow);

    // Send completion event
    if (this.pusherService) {
      try {
        const { WorkflowId } = await import('../../utils/workflowId.js');
        const channelName = WorkflowId.toChannelName(workflowId);
        
        await this.pusherService.trigger(channelName, 'workflow-completed', {
          workflowId: workflowId,
          status: WorkflowStatus.COMPLETED,
          completedAt: workflow.completedAt,
          artifacts: workflow.context?.artifacts ? Array.from(workflow.context.artifacts.keys()) : []
        });
      } catch (error) {
        logger.warn('Failed to send workflow completion event:', error.message);
      }
    }

    logger.info(`✅ Workflow ${workflowId} completed`);
    return workflow;
  }

  /**
   * Get workflow artifacts
   */
  async getWorkflowArtifacts(workflowId) {
    const workflow = await this.loadWorkflow(workflowId);
    return workflow?.context?.artifacts || new Map();
  }

  /**
   * Reset workflow to specific step
   */
  async resetWorkflowToStep(workflowId, stepIndex) {
    const workflow = await this.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.bmadWorkflowData.currentStep = stepIndex;
    workflow.status = WorkflowStatus.RUNNING;
    
    // Clear any artifacts created after this step
    if (workflow.context?.artifacts) {
      const sequence = workflow.bmadWorkflowData.sequence;
      const artifactsToRemove = [];
      
      for (let i = stepIndex; i < sequence.length; i++) {
        if (sequence[i].creates && workflow.context.artifacts.has(sequence[i].creates)) {
          artifactsToRemove.push(sequence[i].creates);
        }
      }
      
      artifactsToRemove.forEach(artifact => {
        workflow.context.artifacts.delete(artifact);
      });
    }

    await this.saveWorkflow(workflow);
    logger.info(`🔄 Workflow ${workflowId} reset to step ${stepIndex}`);
    
    return workflow;
  }
}

export default WorkflowLifecycleManager;