
const Workflow = require('../../database/models/Workflow.js').default;
import logger from '@/lib/utils/logger.js';
const WorkflowAnalytics = require('../../database/models/WorkflowAnalytics.js');
const WorkflowCheckpoint = require('../../database/models/WorkflowCheckpoint.js');

class DatabaseService {
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
      const dbWorkflow = await Workflow.findById(workflowId);
      if (!dbWorkflow) return null;

      return {
        id: dbWorkflow._id.toString(),
        name: dbWorkflow.title,
        status: dbWorkflow.status,
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
        progress: dbWorkflow.bmadWorkflowData?.totalSteps > 0 
          ? Math.round((dbWorkflow.bmadWorkflowData.currentStep / dbWorkflow.bmadWorkflowData.totalSteps) * 100)
          : 0
      };
    } catch (error) {
      logger.error(`Error getting workflow status from DB for ${workflowId}:`, error);
      return null;
    }
  }

  async saveWorkflow(workflowId, workflow) {
    // Ultimate comprehensive error handling
    logger.info(`[DatabaseService] saveWorkflow START - workflowId: ${workflowId}`);
    
    try {
      // Check parameters
      if (!workflowId) {
        throw new Error('workflowId parameter is required');
      }
      
      if (!workflow) {
        throw new Error(`Cannot save workflow ${workflowId}: workflow object is undefined/null`);
      }
      
      if (typeof workflow !== 'object') {
        throw new Error(`Cannot save workflow ${workflowId}: workflow must be an object, got ${typeof workflow}`);
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
        
        await Workflow.findByIdAndUpdate(workflowId, partialUpdateData, { upsert: false });
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
      
      // Include status if provided
      if (workflow.status) {
        updateData.status = workflow.status;
      }
      
      // Include elicitationDetails if provided (simplified and safe)
      if (workflowRef && typeof workflowRef === 'object' && 'elicitationDetails' in workflowRef) {
        updateData.elicitationDetails = workflowRef.elicitationDetails;
      }
      
      await Workflow.findByIdAndUpdate(workflowId, updateData, { upsert: true });
    } catch (error) {
      const errorToLog = error instanceof Error ? error : new Error(error.message || String(error));
      logger.error(`Error saving workflow ${workflowId} to database:`, errorToLog);
      throw error;
    }
  }

  async saveAnalytics(workflow) {
    try {
      const analyticsData = {
        workflowId: workflow.id,
        userId: workflow.context.initiatedBy,
        duration: workflow.endTime - workflow.startTime,
        agentCount: workflow.sequence.length,
        status: workflow.status,
      };

      const analytics = new WorkflowAnalytics(analyticsData);
      await analytics.save();
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
