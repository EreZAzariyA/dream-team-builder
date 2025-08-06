
import logger from '@/lib/utils/logger.js';
const WorkflowCheckpoint = require('../../database/models/WorkflowCheckpoint.js');

class CheckpointManager {
  constructor(workflowEngine) {
    this.workflowEngine = workflowEngine;
    this.maxCheckpoints = 10;
    this.workflowCheckpoints = new Map();
  }

  async create(workflowId, checkpointType, description = '') {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    if (!workflow || !workflow.checkpointEnabled) {
      return null;
    }

    try {
      const checkpointId = this.generateCheckpointId();
      
      const checkpointData = {
        checkpointId,
        workflowId,
        type: checkpointType,
        description,
        step: workflow.currentStep,
        currentAgent: workflow.currentAgent,
        status: workflow.status,
        userId: workflow.context.initiatedBy,
        
        state: {
          artifacts: JSON.parse(JSON.stringify(workflow.artifacts)),
          messages: JSON.parse(JSON.stringify(workflow.messages)),
          errors: JSON.parse(JSON.stringify(workflow.errors)),
          context: JSON.parse(JSON.stringify(workflow.context)),
          metadata: JSON.parse(JSON.stringify(workflow.metadata))
        }
      };

      const checkpointDoc = new WorkflowCheckpoint(checkpointData);
      await checkpointDoc.save();

      if (!this.workflowCheckpoints.has(workflowId)) {
        this.workflowCheckpoints.set(workflowId, []);
      }

      const inMemoryCheckpoints = this.workflowCheckpoints.get(workflowId);
      inMemoryCheckpoints.push({
        id: checkpointId,
        type: checkpointType,
        description,
        timestamp: checkpointDoc.timestamp,
        step: workflow.currentStep,
        currentAgent: workflow.currentAgent
      });

      if (inMemoryCheckpoints.length > this.maxCheckpoints) {
        inMemoryCheckpoints.shift();
      }

      return { id: checkpointId, ...checkpointData };

    } catch (error) {
      logger.error(`Error creating checkpoint for workflow ${workflowId}:`, error);
      return null;
    }
  }

  async rollback(workflowId, checkpointId) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      const checkpointDoc = await WorkflowCheckpoint.findOne({ 
        checkpointId, 
        workflowId 
      }).lean();
      
      if (!checkpointDoc) {
        throw new Error(`Checkpoint ${checkpointId} not found in database for workflow ${workflowId}`);
      }

      workflow.status = 'ROLLING_BACK';

      await this.workflowEngine.communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'user',
        type: 'system',
        content: {
          message: `Rolling back to checkpoint: ${checkpointDoc.description}`,
          checkpointId,
          checkpointType: checkpointDoc.type,
          targetStep: checkpointDoc.step
        },
        timestamp: new Date()
      });

      workflow.currentStep = checkpointDoc.step;
      workflow.currentAgent = checkpointDoc.currentAgent;
      workflow.artifacts = JSON.parse(JSON.stringify(checkpointDoc.state.artifacts));
      workflow.messages = JSON.parse(JSON.stringify(checkpointDoc.state.messages));
      workflow.errors = JSON.parse(JSON.stringify(checkpointDoc.state.errors));
      workflow.context = JSON.parse(JSON.stringify(checkpointDoc.state.context));
      workflow.metadata = JSON.parse(JSON.stringify(checkpointDoc.state.metadata));

      if (workflow.currentAgent) {
        this.workflowEngine.agentLoader.updateAgentStatus(workflow.currentAgent, 'IDLE');
      }

      workflow.status = 'ROLLED_BACK';

      return {
        workflowId,
        checkpointId,
        targetStep: checkpointDoc.step,
        status: workflow.status,
        message: 'Rollback completed successfully'
      };

    } catch (error) {
      workflow.status = 'ERROR';
      workflow.errors.push({
        timestamp: new Date(),
        error: `Rollback failed: ${error.message}`,
        type: 'rollback_error'
      });
      throw error;
    }
  }

  generateCheckpointId() {
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

module.exports = { CheckpointManager };
