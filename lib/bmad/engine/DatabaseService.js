
const Workflow = require('../../database/models/Workflow.js').default;
import logger from '@/lib/utils/logger.js';
const WorkflowAnalytics = require('../../database/models/WorkflowAnalytics.js');
const WorkflowCheckpoint = require('../../database/models/WorkflowCheckpoint.js');

class DatabaseService {
  /**
   * Helper method to find workflow by workflowId field
   */
  async findWorkflow(workflowId) {
    // Always search by workflowId field, not _id
    return await Workflow.findOne({ workflowId: workflowId });
  }

  async rehydrateState() {
    try {
      const activeStates = ['RUNNING', 'PAUSED_FOR_ELICITATION'];
      const activeWorkflows = await Workflow.find({ status: { $in: activeStates } }).lean();

      return activeWorkflows;
    } catch (error) {
      logger.error('Error re-hydrating workflow state from database:', error);
      return [];
    }
  }

  async getWorkflowStatus(workflowId) {
    try {
      const dbWorkflow = await this.findWorkflow(workflowId);
      if (!dbWorkflow) return null;

      return {
        id: dbWorkflow._id.toString(),
        workflowId: dbWorkflow.workflowId,
        name: dbWorkflow.title,
        title: dbWorkflow.title,
        description: dbWorkflow.description,
        prompt: dbWorkflow.prompt,
        template: dbWorkflow.template,
        status: dbWorkflow.status,
        userId: dbWorkflow.userId,
        currentStep: dbWorkflow.bmadWorkflowData?.currentStep || 0,
        totalSteps: dbWorkflow.bmadWorkflowData?.totalSteps || 0,
        currentAgent: dbWorkflow.currentAgent?.agentId || null,
        startTime: dbWorkflow.startedAt,
        endTime: dbWorkflow.completedAt,
        artifactCount: dbWorkflow.bmadWorkflowData?.artifacts?.length || 0,
        messageCount: dbWorkflow.bmadWorkflowData?.messages?.length || 0,
        errors: dbWorkflow.bmadWorkflowData?.errors || [],
        elicitationDetails: dbWorkflow.elicitationDetails,
        sequence: dbWorkflow.bmadWorkflowData?.sequence || [],
        artifacts: dbWorkflow.bmadWorkflowData?.artifacts || [],
        checkpoints: dbWorkflow.bmadWorkflowData?.checkpoints || [],
        bmadWorkflowData: dbWorkflow.bmadWorkflowData,
        metadata: dbWorkflow.metadata,
        progress: dbWorkflow.bmadWorkflowData?.totalSteps > 0 
          ? Math.round((dbWorkflow.bmadWorkflowData.currentStep / dbWorkflow.bmadWorkflowData.totalSteps) * 100)
          : 0
      };
    } catch (error) {
      logger.error(`Error getting workflow status from DB for ${workflowId}:`, error);
      return null;
    }
  }

  async saveWorkflow(workflowId, workflow, userId) {
    // Ultimate comprehensive error handling
    logger.info(`[DatabaseService] saveWorkflow START - workflowId: ${workflowId}`);
    try {
      if (!workflowId) {
        throw new Error('workflowId parameter is required');
      }
      if (!workflow || typeof workflow !== 'object') {
        throw new Error(`Cannot save workflow ${workflowId}: workflow object is undefined/null or not an object`);
      }
      
      if (!userId) {
        throw new Error('userId parameter is required');
      }
      
      logger.info(`[DatabaseService] Parameters validated successfully`);
      
      // Handle partial workflow updates (status-only updates)
      if (!workflow.sequence && (workflow.status || (workflow && typeof workflow === 'object' && workflow.hasOwnProperty('elicitationDetails')))) {
        // This is a partial update (like status change), only update specific fields
        const partialUpdateData = {};
        
        if (workflow.status) {
          partialUpdateData.status = workflow.status;
        }
        
        if (workflow && typeof workflow === 'object' && workflow.hasOwnProperty('elicitationDetails')) {
          partialUpdateData.elicitationDetails = workflow.elicitationDetails;
        }
        
        await Workflow.findOneAndUpdate({ workflowId: workflowId }, partialUpdateData, { upsert: false });
        return;
      }
      
      // Full workflow update - require sequence
      if (!workflow.sequence || !Array.isArray(workflow.sequence)) {
        throw new Error(`Cannot save workflow ${workflowId}: workflow.sequence is missing or not an array`);
      }
      
      // Create a local reference to avoid any potential modification during execution
      const workflowRef = workflow;
      
      const dbSequence = workflowRef.sequence.map((step, index) => ({
        agentId: step.agentId,
        order: index
      }));
      
      // Build updateData with careful property access
      const updateData = {
        workflowId: workflowId, // Our custom workflow identifier
        userId: userId, // Required by Workflow model
        title: workflowRef.name || workflowRef.title || `BMAD Workflow - ${new Date().toISOString()}`, // Required
        prompt: workflowRef.userPrompt || workflowRef.prompt || `BMAD workflow execution - ${workflowId}`, // Required
        'bmadWorkflowData.sequence': dbSequence,
        'bmadWorkflowData.currentStep': workflowRef.currentStep || 0,
        'bmadWorkflowData.totalSteps': workflowRef.sequence.length
      };
      
      // Add optional properties with safe access
      if (workflowRef && 'messages' in workflowRef) {
        updateData['bmadWorkflowData.messages'] = workflowRef.messages || [];
      } else {
        updateData['bmadWorkflowData.messages'] = [];
      }
      
      if (workflowRef && 'artifacts' in workflowRef) {
        updateData['bmadWorkflowData.artifacts'] = workflowRef.artifacts || [];
      } else {
        updateData['bmadWorkflowData.artifacts'] = [];
      }
      
      if (workflowRef && 'errors' in workflowRef) {
        updateData['bmadWorkflowData.errors'] = workflowRef.errors || [];
      } else {
        updateData['bmadWorkflowData.errors'] = [];
      }
      
      // Include optional fields
      if (workflowRef.status) updateData.status = workflowRef.status;
      if (workflowRef.elicitationDetails) updateData.elicitationDetails = workflowRef.elicitationDetails;
      if (workflowRef.metadata?.yamlSource) updateData.template = workflowRef.metadata.yamlSource;
      if (workflowRef.metadata) updateData.metadata = workflowRef.metadata;
      
      // Use upsert to create or update the workflow by workflowId
      // await Workflow.findOneAndUpdate({ workflowId: workflowId }, updateData, { upsert: true });
    } catch (error) {
      const errorToLog = error instanceof Error ? error : new Error(error.message || String(error));
      logger.error(`Error saving workflow ${workflowId} to database:`, errorToLog);
      throw error;
    }
  }

  async saveAnalytics(workflow) {
    try {
      // Calculate duration safely, handle undefined/null values
      let duration = 0;
      if (workflow.endTime && workflow.startTime) {
        const endTime = new Date(workflow.endTime).getTime();
        const startTime = new Date(workflow.startTime).getTime();
        duration = endTime - startTime;
        // Ensure duration is a valid positive number
        if (isNaN(duration) || duration < 0) {
          duration = 0;
        }
      } else {
        // If workflow is not completed yet, calculate partial duration
        const startTime = workflow.startTime ? new Date(workflow.startTime).getTime() : Date.now();
        const currentTime = Date.now();
        duration = currentTime - startTime;
        // Ensure duration is valid
        if (isNaN(duration) || duration < 0) {
          duration = 0;
        }
      }

      const analyticsData = {
        workflowId: workflow.id,
        userId: workflow.context?.initiatedBy || null,
        duration: duration,
        agentCount: workflow.sequence?.length || 0,
        status: workflow.status || 'running',
      };

      const analytics = new WorkflowAnalytics(analyticsData);
      await analytics.save();
      logger.debug(`Analytics saved for workflow ${workflow.id}: duration=${duration}ms`);
    } catch (error) {
      logger.error(`Error saving analytics for workflow ${workflow.id}:`, error);
    }
  }

  async getCheckpoints(workflowId) {
    try {
      const checkpointDocs = await WorkflowCheckpoint.findByWorkflow(workflowId, 20);
      
      return checkpointDocs.map(cp => ({
        id: cp.checkpointId,
        type: cp.type,
        description: cp.description,
        timestamp: cp.timestamp,
        step: cp.step,
        currentAgent: cp.currentAgent,
        stateSize: cp.stateSize,
        compressed: cp.compressed
      }));
    } catch (error) {
      logger.error(`Error loading checkpoints for workflow ${workflowId}:`, error);
      return [];
    }
  }

  async cleanupCheckpoints(olderThanDays = 7) {
    try {
      const result = await WorkflowCheckpoint.cleanup(olderThanDays);
      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old checkpoints from database`);
      }
    } catch (error) {
      logger.error('Error cleaning up checkpoints from database:', error);
    }
  }
}

module.exports = { DatabaseService };
