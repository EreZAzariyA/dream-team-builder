/**
 * Workflow State Manager
 * Handles workflow status, queries, and state persistence
 */

const { WorkflowStatus, WorkflowSequences } = require('../types.js');
import logger from '../../utils/logger.js';

class WorkflowStateManager {
  constructor(workflowEngine) {
    this.engine = workflowEngine;
  }

  async getWorkflowStatus(workflowId) {
    const dbStatus = await this.engine.databaseService.getWorkflowStatus(workflowId);
    if (dbStatus) return dbStatus;

    const workflow = this.engine.activeWorkflows.get(workflowId) || this.engine.executionHistory.get(workflowId);
    if (!workflow) return null;

    return {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      currentStep: workflow.currentStep,
      totalSteps: workflow.sequence.length,
      currentAgent: workflow.currentAgent,
      startTime: workflow.startTime,
      endTime: workflow.endTime,
      artifactCount: workflow.artifacts.length,
      messageCount: workflow.messages.length,
      errors: workflow.errors,
      elicitationDetails: workflow.elicitationDetails,
      sequence: workflow.sequence || [],
      artifacts: workflow.artifacts || [],
      checkpoints: workflow.checkpoints || [],
      progress: workflow.sequence?.length > 0 
        ? Math.round((workflow.currentStep / workflow.sequence.length) * 100)
        : 0
    };
  }

  getActiveWorkflows() {
    return Array.from(this.engine.activeWorkflows.values()).map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      currentStep: workflow.currentStep,
      totalSteps: workflow.sequence.length,
      currentAgent: workflow.currentAgent,
      startTime: workflow.startTime
    }));
  }

  getExecutionHistory(limit = 50) {
    return Array.from(this.engine.executionHistory.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  async getWorkflowArtifacts(workflowId) {
    const workflow = this.engine.activeWorkflows.get(workflowId) || this.engine.executionHistory.get(workflowId);
    if (!workflow) return [];

    if (workflow.status === WorkflowStatus.RUNNING || workflow.status === WorkflowStatus.PAUSED) {
      return workflow.artifacts || [];
    }

    try {
      const savedArtifacts = await this.engine.artifactManager.loadWorkflowArtifacts(workflowId);
      return savedArtifacts.length > 0 ? savedArtifacts : (workflow.artifacts || []);
    } catch (error) {
      return workflow.artifacts || [];
    }
  }

  async getWorkflowCheckpoints(workflowId) {
    return this.engine.checkpointManager.get(workflowId);
  }

  async resumeFromRollback(workflowId) {
    const workflow = this.engine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'ROLLED_BACK') {
      throw new Error(`Workflow ${workflowId} is not in rolled back state`);
    }

    try {
      if (workflow.checkpointEnabled) {
        await this.engine.checkpointManager.create(workflowId, 'resume_from_rollback', `Resuming workflow from step ${workflow.currentStep}`);
      }

      workflow.status = WorkflowStatus.RUNNING;
      await this.engine.stepExecutor.executeNextStep(workflowId);

      return {
        workflowId,
        status: workflow.status,
        currentStep: workflow.currentStep,
        message: 'Workflow resumed successfully'
      };

    } catch (error) {
      workflow.status = WorkflowStatus.ERROR;
      throw error;
    }
  }

  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId) {
    const dbWorkflow = await this.engine.databaseService.getWorkflowStatus(workflowId);
    if (!dbWorkflow) {
      throw new Error(`Workflow ${workflowId} not found in database`);
    }

    if (dbWorkflow.status !== WorkflowStatus.PAUSED_FOR_ELICITATION) {
      throw new Error(`Workflow ${workflowId} is not paused for elicitation (status: ${dbWorkflow.status})`);
    }

    let workflow = this.engine.activeWorkflows.get(workflowId);
    const isDynamicWorkflow = dbWorkflow.metadata?.workflowType === 'dynamic';
    
    logger.info('🔍 [ELICITATION RESUME DEBUG] Workflow state before rehydration:');
    logger.info(`  - workflow exists in activeWorkflows: ${!!workflow}`);
    logger.info(`  - isDynamicWorkflow: ${isDynamicWorkflow}`);
    logger.info(`  - workflow.sequence length: ${workflow?.sequence?.length || 'UNDEFINED'}`);
    logger.info(`  - workflow.sequence[0] keys: ${workflow?.sequence?.[0] ? Object.keys(workflow.sequence[0]) : 'UNDEFINED'}`);
    
    if (!workflow) {
      workflow = await this.rehydrateWorkflowFromDatabase(workflowId, dbWorkflow);
      logger.info('🔍 [ELICITATION RESUME DEBUG] Workflow rehydrated from database');
    } else if (isDynamicWorkflow) {
      logger.info('🔍 [ELICITATION RESUME DEBUG] Using existing dynamic workflow from activeWorkflows - NOT rehydrating to preserve step data');
      // For dynamic workflows, do NOT rehydrate if workflow exists in activeWorkflows
      // This preserves the complete step objects with all parsed data
    }

    try {
      let targetAgentId = agentId;
      
      const elicitationMessage = {
        from: 'user',
        to: targetAgentId,
        type: 'elicitation_response',
        content: elicitationResponse,
        timestamp: new Date(),
        workflowId: workflowId
      };
      
      workflow.messages.push(elicitationMessage);

      if (this.engine.messageService) {
        await this.engine.messageService.addMessage(workflowId, elicitationMessage);
      }

      // Process elicitation response for routing decisions
      await this.processElicitationResponseForRouting(workflow, elicitationResponse, targetAgentId);
      
      workflow.elicitationDetails = null;
      workflow.status = WorkflowStatus.RUNNING;
      
      await this.engine.databaseService.saveWorkflow(workflowId, { status: WorkflowStatus.RUNNING, elicitationDetails: null });
      
      const isDynamicWorkflow = workflow.metadata?.workflowType === 'dynamic' || 
                               dbWorkflow.metadata?.workflowType === 'dynamic' ||
                               workflow.dynamicWorkflow;
      
      if (isDynamicWorkflow) {
        await this.engine.dynamicWorkflowHandler.executeNextStep(workflowId);
      } else {
        await this.engine.stepExecutor.executeNextStep(workflowId);
      }

      return {
        workflowId,
        status: workflow.status,
        currentStep: workflow.currentStep,
        message: 'Workflow resumed with elicitation response'
      };

    } catch (error) {
      workflow.status = WorkflowStatus.ERROR;
      throw error;
    }
  }

  async rehydrateWorkflowFromDatabase(workflowId, dbWorkflow) {
    const isDynamicWorkflow = dbWorkflow.metadata?.workflowType === 'dynamic';
    
    if (isDynamicWorkflow) {
      return await this.rehydrateDynamicWorkflow(workflowId, dbWorkflow);
    } else {
      return await this.rehydrateLegacyWorkflow(workflowId, dbWorkflow);
    }
  }

  async rehydrateDynamicWorkflow(workflowId, dbWorkflow) {
    const cachedWorkflow = this.engine.dynamicWorkflowHandler.dynamicWorkflows.get(dbWorkflow.template);
    if (cachedWorkflow) {
      const workflow = this.createWorkflowFromCache(workflowId, dbWorkflow, cachedWorkflow);
      this.engine.activeWorkflows.set(workflowId, workflow);
      return workflow;
    } else {
      try {
        const reloadedWorkflow = await this.engine.workflowParser.parseWorkflowFile(dbWorkflow.template);
        await this.engine.workflowParser.resolveReferences(reloadedWorkflow);
        this.engine.dynamicWorkflowHandler.dynamicWorkflows.set(dbWorkflow.template, reloadedWorkflow);
        
        const workflow = this.createWorkflowFromReloaded(workflowId, dbWorkflow, reloadedWorkflow);
        this.engine.activeWorkflows.set(workflowId, workflow);
        return workflow;
      } catch (error) {
        logger.error('Failed to reload dynamic workflow:', error);
        return null;
      }
    }
  }

  async rehydrateLegacyWorkflow(workflowId, dbWorkflow) {
    let sequence = [];
    const templateSequence = WorkflowSequences[dbWorkflow.template] || [];
    const dbSequence = dbWorkflow.bmadWorkflowData?.sequence || [];
    
    if (dbSequence.length > 0 && templateSequence.length > 0) {
      sequence = dbSequence
        .sort((a, b) => a.order - b.order)
        .map(dbStep => {
          const templateStep = templateSequence.find(ts => ts.agentId === dbStep.agentId);
          return templateStep ? {
            agentId: dbStep.agentId,
            role: templateStep.role,
            description: templateStep.description
          } : {
            agentId: dbStep.agentId,
            role: 'Agent',
            description: `Execute ${dbStep.agentId} tasks`
          };
        });
    } else if (templateSequence.length > 0) {
      sequence = templateSequence;
    }
  
    const workflow = {
      id: dbWorkflow._id.toString(),
      name: dbWorkflow.title,
      status: dbWorkflow.status,
      currentStep: dbWorkflow.bmadWorkflowData?.currentStep || 0,
      currentAgent: dbWorkflow.currentAgent?.agentId || null,
      sequence: sequence,
      messages: dbWorkflow.bmadWorkflowData?.messages || [],
      artifacts: dbWorkflow.bmadWorkflowData?.artifacts || [],
      checkpoints: dbWorkflow.bmadWorkflowData?.checkpoints || [],
      errors: dbWorkflow.bmadWorkflowData?.errors || [],
      elicitationDetails: dbWorkflow.elicitationDetails,
      startTime: dbWorkflow.startedAt,
      endTime: dbWorkflow.completedAt
    };
    
    this.engine.activeWorkflows.set(workflowId, workflow);
    return workflow;
  }

  createWorkflowFromCache(workflowId, dbWorkflow, cachedWorkflow) {
    return {
      id: workflowId,
      name: dbWorkflow.title,
      description: dbWorkflow.description,
      sequence: cachedWorkflow.steps,
      userPrompt: dbWorkflow.prompt,
      status: dbWorkflow.status,
      currentStep: dbWorkflow.progress?.currentStep || 0,
      currentAgent: null,
      startTime: dbWorkflow.metadata?.startTime,
      endTime: null,
      context: {
        initiatedBy: dbWorkflow.userId,
        artifacts: new Map(),
        routingDecisions: new Map(),
        elicitationHistory: []
      },
      artifacts: dbWorkflow.bmadWorkflowData?.artifacts || [],
      messages: dbWorkflow.bmadWorkflowData?.messages || [],
      errors: dbWorkflow.bmadWorkflowData?.errors || [],
      metadata: {
        ...dbWorkflow.metadata,
        workflowType: 'dynamic'
      },
      checkpointEnabled: this.engine.checkpointEnabled,
      dynamicWorkflow: cachedWorkflow,
      handoffPrompts: cachedWorkflow.handoffPrompts,
      elicitationDetails: dbWorkflow.elicitationDetails
    };
  }

  createWorkflowFromReloaded(workflowId, dbWorkflow, reloadedWorkflow) {
    return {
      id: workflowId,
      name: dbWorkflow.title,
      description: dbWorkflow.description,
      sequence: reloadedWorkflow.steps,
      userPrompt: dbWorkflow.prompt,
      status: dbWorkflow.status,
      currentStep: dbWorkflow.progress?.currentStep || 0,
      currentAgent: null,
      startTime: dbWorkflow.metadata?.startTime,
      endTime: null,
      context: {
        initiatedBy: dbWorkflow.userId,
        artifacts: new Map(),
        routingDecisions: new Map(),
        elicitationHistory: []
      },
      artifacts: dbWorkflow.bmadWorkflowData?.artifacts || [],
      messages: dbWorkflow.bmadWorkflowData?.messages || [],
      errors: dbWorkflow.bmadWorkflowData?.errors || [],
      metadata: {
        ...dbWorkflow.metadata,
        workflowType: 'dynamic'
      },
      checkpointEnabled: this.engine.checkpointEnabled,
      dynamicWorkflow: reloadedWorkflow,
      handoffPrompts: reloadedWorkflow.handoffPrompts,
      elicitationDetails: dbWorkflow.elicitationDetails
    };
  }

  async processElicitationResponseForRouting(workflow, elicitationResponse, agentId) {
    logger.info('🔄 [ROUTING] Processing elicitation response for routing decision:', {
      response: elicitationResponse,
      currentStep: workflow.currentStep,
      workflowId: workflow.id
    });

    // For enhancement_classification elicitation, classify the user's response
    if (workflow.currentStep === 0 || workflow.sequence?.[workflow.currentStep]?.step === 'enhancement_classification') {
      const classification = this.classifyEnhancementScope(elicitationResponse);
      
      if (!workflow.context.routingDecisions) {
        workflow.context.routingDecisions = new Map();
      }
      
      workflow.context.routingDecisions.set('enhancement_classification', classification);
      
      logger.info('🎯 [ROUTING] Enhancement classified as:', {
        classification,
        response: elicitationResponse
      });
    }
  }

  classifyEnhancementScope(userResponse) {
    const response = userResponse.toLowerCase();
    
    // Simple classification based on keywords and complexity indicators
    const singleStoryIndicators = [
      'simple', 'basic', 'just', 'only', 'small', 'quick', 'minimal',
      'creating and deleting', 'crud', 'add and remove', 'straightforward'
    ];
    
    const smallFeatureIndicators = [
      'few features', 'some functionality', 'moderate', 'medium', 
      'authentication', 'user management', 'basic ui'
    ];
    
    const majorEnhancementIndicators = [
      'complex', 'advanced', 'comprehensive', 'full-featured', 'enterprise',
      'microservices', 'scalable', 'distributed', 'many features', 'extensive'
    ];

    // Count matches for each category
    const singleStoryScore = singleStoryIndicators.filter(indicator => 
      response.includes(indicator)
    ).length;
    
    const smallFeatureScore = smallFeatureIndicators.filter(indicator => 
      response.includes(indicator)
    ).length;
    
    const majorEnhancementScore = majorEnhancementIndicators.filter(indicator => 
      response.includes(indicator)
    ).length;

    logger.info('🔍 [CLASSIFICATION] Scores:', {
      response,
      singleStoryScore,
      smallFeatureScore,
      majorEnhancementScore
    });

    // Determine classification based on scores
    if (singleStoryScore > 0 && singleStoryScore >= smallFeatureScore && singleStoryScore >= majorEnhancementScore) {
      return 'single_story';
    } else if (smallFeatureScore > majorEnhancementScore) {
      return 'small_feature';
    } else if (majorEnhancementScore > 0) {
      return 'major_enhancement';
    }
    
    // Default classification for unclear responses
    // If it mentions specific simple features, classify as single_story
    if (response.includes('creating') && response.includes('deleting') && response.includes('simple')) {
      return 'single_story';
    }
    
    // Default to small_feature for most cases
    return 'small_feature';
  }
}

module.exports = { WorkflowStateManager };