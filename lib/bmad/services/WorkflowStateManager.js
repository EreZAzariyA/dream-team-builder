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

  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId, userId = null) {
    logger.info(`🔍 [RESUME ELICITATION] Starting resumeWorkflowWithElicitation for workflow ${workflowId}`);
    logger.info(`🔍 [RESUME ELICITATION] Params: elicitationResponse="${elicitationResponse}", agentId="${agentId}", userId="${userId}"`);
    
    const dbWorkflow = await this.engine.databaseService.getWorkflowStatus(workflowId);
    if (!dbWorkflow) {
      throw new Error(`Workflow ${workflowId} not found in database`);
    }

    logger.info(`🔍 [RESUME ELICITATION] Database workflow status: ${dbWorkflow.status}`);

    if (dbWorkflow.status !== WorkflowStatus.PAUSED_FOR_ELICITATION) {
      throw new Error(`Workflow ${workflowId} is not paused for elicitation (status: ${dbWorkflow.status})`);
    }

    let workflow = this.engine.activeWorkflows.get(workflowId);
    
    logger.info(`🔍 [RESUME ELICITATION] Workflow from activeWorkflows: ${JSON.stringify({
      hasWorkflow: !!workflow,
      workflowId: workflow?.id,
      hasSequence: !!workflow?.sequence,
      sequenceLength: workflow?.sequence?.length,
      currentStep: workflow?.currentStep,
      status: workflow?.status
    })}`);
    
    // Enhanced dynamic workflow detection with multiple fallbacks
    const isDynamicWorkflow = dbWorkflow.metadata?.workflowType === 'dynamic' || 
                             workflow?.metadata?.workflowType === 'dynamic' ||
                             workflow?.dynamicWorkflow ||
                             dbWorkflow.template === 'brownfield-fullstack' || // Known YAML workflows
                             dbWorkflow.template === 'greenfield-fullstack' ||
                             dbWorkflow.template?.endsWith('-fullstack') ||
                             // Also check if template matches known dynamic workflow names
                             (dbWorkflow.template && ['brownfield-service', 'greenfield-service', 'brownfield-ui', 'greenfield-ui'].includes(dbWorkflow.template)) ||
                             // If workflow exists in activeWorkflows but has no template data, assume it's dynamic
                             (workflow && !workflow?.metadata?.workflowType && workflow.sequence?.length > 0);
    
    if (!workflow) {
      logger.info(`🔍 [RESUME ELICITATION] Workflow not in activeWorkflows, rehydrating from database`);
      workflow = await this.rehydrateWorkflowFromDatabase(workflowId, dbWorkflow);
      logger.info(`🔍 [RESUME ELICITATION] After rehydration: ${JSON.stringify({
        hasWorkflow: !!workflow,
        hasSequence: !!workflow?.sequence,
        sequenceLength: workflow?.sequence?.length,
        firstStepName: workflow?.sequence?.[0]?.step,
        firstStepAgent: workflow?.sequence?.[0]?.agentId
      })}`);
    } else if (isDynamicWorkflow) {
      // Check if workflow has lost its parsed YAML data (corrupted in memory)
      const firstStep = workflow.sequence?.[0];
      const hasYamlData = firstStep?.step || firstStep?.action || firstStep?.notes || firstStep?.stepName;
      const hasDynamicReference = workflow.dynamicWorkflow && typeof workflow.dynamicWorkflow === 'object';
      
      
      // More aggressive corruption detection - step only has basic DB fields
      const firstStepKeys = Object.keys(firstStep || {});
      const hasOnlyDbFields = firstStep && firstStepKeys.length <= 4 && 
                              firstStep.agentId && 
                              firstStep.hasOwnProperty('order') && 
                              (firstStep._id || firstStep.id) &&
                              // Check that it's missing essential YAML fields
                              !firstStep.action && !firstStep.notes && !firstStep.stepName && !firstStep.step;
      
      
      
      if (!hasYamlData || !hasDynamicReference || hasOnlyDbFields) {
        
        // DIRECT DYNAMIC WORKFLOW REHYDRATION - Bypass broken database template
        const cachedWorkflow = this.engine.dynamicWorkflowHandler.dynamicWorkflows.get('brownfield-fullstack');
        if (cachedWorkflow) {
          workflow = this.createWorkflowFromCache(workflowId, {
            ...dbWorkflow,
            template: 'brownfield-fullstack',
            metadata: { workflowType: 'dynamic' }
          }, cachedWorkflow);
        } else {
          try {
            const reloadedWorkflow = await this.engine.workflowParser.parseWorkflowFile('brownfield-fullstack');
            await this.engine.workflowParser.resolveReferences(reloadedWorkflow);
            this.engine.dynamicWorkflowHandler.dynamicWorkflows.set('brownfield-fullstack', reloadedWorkflow);
            
            workflow = this.createWorkflowFromReloaded(workflowId, {
              ...dbWorkflow,
              template: 'brownfield-fullstack',
              metadata: { workflowType: 'dynamic' }
            }, reloadedWorkflow);
          } catch (error) {
            throw error;
          }
        }
        
        // CRITICAL: Update activeWorkflows with the rehydrated workflow
        this.engine.activeWorkflows.set(workflowId, workflow);
        
      } else {
        // For dynamic workflows, do NOT rehydrate if workflow exists in activeWorkflows
        // This preserves the complete step objects with all parsed data
        // BUT ensure metadata is correct
        if (!workflow.metadata?.workflowType) {
          workflow.metadata = {
            ...workflow.metadata,
            workflowType: 'dynamic'
          };
        }
      }
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
      logger.info(`🔍 [RESUME ELICITATION] About to process elicitation response for routing`);
      await this.processElicitationResponseForRouting(workflow, elicitationResponse, targetAgentId);
      logger.info(`🔍 [RESUME ELICITATION] Completed processing elicitation response for routing`);
      
      // After elicitation, the SAME AGENT who asked the question should process the response
      // DON'T advance to next step - let the asking agent analyze the response with AI

      workflow.elicitationDetails = null;
      workflow.status = WorkflowStatus.RUNNING; // Resume workflow to continue processing
      
      await this.engine.databaseService.saveWorkflow(workflowId, { elicitationDetails: null, status: WorkflowStatus.RUNNING }, workflow.context?.initiatedBy || 'system');
      
      // Ensure workflow context has the correct userId for AI service initialization
      if (userId && (!workflow.context.initiatedBy || workflow.context.initiatedBy !== userId)) {
        workflow.context.initiatedBy = userId;
      }
      
      // CRITICAL FIX: Instead of executeNextStep, continue with the CURRENT step
      // The agent that asked the question should process the user's response
      const currentStepIndex = workflow.currentStep;
      const currentStep = workflow.sequence[currentStepIndex];
      
      logger.info(`🔍 [WORKFLOW STATE MGR] About to continue current step ${currentStepIndex}`);
      logger.info(`🔍 [WORKFLOW STATE MGR] Workflow sequence details: ${JSON.stringify({
        hasSequence: !!workflow.sequence,
        sequenceLength: workflow.sequence?.length,
        sequenceType: typeof workflow.sequence,
        isArray: Array.isArray(workflow.sequence)
      })}`);
      logger.info(`🔍 [WORKFLOW STATE MGR] Current step details: ${JSON.stringify({
        stepName: currentStep?.step,
        agentId: currentStep?.agentId,
        action: currentStep?.action,
        hasStep: !!currentStep
      })}`);
      
      if (currentStep) {
        const isDynamicWorkflow = workflow.metadata?.workflowType === 'dynamic' || 
                                 dbWorkflow.metadata?.workflowType === 'dynamic' ||
                                 workflow.dynamicWorkflow;
        
        logger.info(`🔍 [WORKFLOW STATE MGR] Workflow type check: isDynamic=${isDynamicWorkflow}`);
        
        if (isDynamicWorkflow) {
          // Continue processing the current step with the elicitation response
          logger.info(`🔍 [WORKFLOW STATE MGR] About to call handleRegularStep for dynamic workflow`);
          await this.engine.dynamicWorkflowHandler.handleRegularStep(workflowId, currentStep, userId);
          logger.info(`🔍 [WORKFLOW STATE MGR] handleRegularStep completed`);
        } else {
          // For legacy workflows, execute the current agent with the response
          logger.info(`🔍 [WORKFLOW STATE MGR] About to execute legacy agent: ${targetAgentId}`);
          const agent = this.engine.agentLoader.getAgent(targetAgentId);
          if (agent) {
            await this.engine.executor.executeAgent(agent, workflowId, userId);
          }
        }
      } else {
        logger.error(`🔍 [WORKFLOW STATE MGR] No current step found at index ${currentStepIndex}`);
        logger.error(`🔍 [WORKFLOW STATE MGR] CRITICAL DEBUG - Full workflow object: ${JSON.stringify({
          id: workflow?.id,
          hasSequence: !!workflow?.sequence,
          sequenceData: workflow?.sequence,
          sequenceLength: workflow?.sequence?.length,
          sequenceType: typeof workflow?.sequence,
          isSequenceArray: Array.isArray(workflow?.sequence),
          currentStep: workflow?.currentStep,
          status: workflow?.status
        }, null, 2)}`);
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
    
    logger.info(`🔍 [REHYDRATE] Starting rehydration for workflow ${workflowId}, template: ${dbWorkflow.template}`);
    
    // Use same enhanced detection logic as in resumeWorkflowWithElicitation
    const isDynamicWorkflow = dbWorkflow.metadata?.workflowType === 'dynamic' || 
                             dbWorkflow.template === 'brownfield-fullstack' || // Known YAML workflows
                             dbWorkflow.template === 'greenfield-fullstack' ||
                             dbWorkflow.template?.endsWith('-fullstack') ||
                             // Also check if template matches known dynamic workflow names
                             (dbWorkflow.template && ['brownfield-service', 'greenfield-service', 'brownfield-ui', 'greenfield-ui'].includes(dbWorkflow.template));
    
    logger.info(`🔍 [REHYDRATE] Workflow type detection: isDynamic=${isDynamicWorkflow}, template=${dbWorkflow.template}`);
    
    if (isDynamicWorkflow) {
      return await this.rehydrateDynamicWorkflow(workflowId, dbWorkflow);
    } else {
      logger.info(`🔍 [REHYDRATE] Using legacy rehydration for template: ${dbWorkflow.template}`);
      return await this.rehydrateLegacyWorkflow(workflowId, dbWorkflow);
    }
  }

  async rehydrateDynamicWorkflow(workflowId, dbWorkflow) {
    logger.info(`🔍 [REHYDRATE DYNAMIC] Attempting to rehydrate dynamic workflow: ${dbWorkflow.template}`);
    const cachedWorkflow = this.engine.dynamicWorkflowHandler.dynamicWorkflows.get(dbWorkflow.template);
    logger.info(`🔍 [REHYDRATE DYNAMIC] Cached workflow details: ${JSON.stringify({
      hasCachedWorkflow: !!cachedWorkflow,
      hasSteps: !!cachedWorkflow?.steps,
      stepsLength: cachedWorkflow?.steps?.length,
      stepsType: typeof cachedWorkflow?.steps,
      isStepsArray: Array.isArray(cachedWorkflow?.steps),
      firstStepName: cachedWorkflow?.steps?.[0]?.step
    })}`);
    
    if (cachedWorkflow) {
      const workflow = this.createWorkflowFromCache(workflowId, dbWorkflow, cachedWorkflow);
      logger.info(`🔍 [REHYDRATE DYNAMIC] Created workflow from cache: ${JSON.stringify({
        hasSequence: !!workflow?.sequence,
        sequenceLength: workflow?.sequence?.length,
        firstStepName: workflow?.sequence?.[0]?.step
      })}`);
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
      id: dbWorkflow.workflowId || dbWorkflow._id?.toString() || workflowId,
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

    // Initialize context if it doesn't exist
    if (!workflow.context) {
      workflow.context = {
        initiatedBy: 'system',
        artifacts: new Map(),
        routingDecisions: new Map()
      };
    }

    // Store the user's response for the agent to process
    if (!workflow.context.routingDecisions) {
      workflow.context.routingDecisions = new Map();
    }
    
    // Extract the actual user response text from the elicitation response object
    let userResponseText = elicitationResponse;
    if (typeof elicitationResponse === 'object' && elicitationResponse !== null) {
      userResponseText = elicitationResponse.userResponse || 
                       elicitationResponse.response || 
                       elicitationResponse.text || 
                       JSON.stringify(elicitationResponse);
    }
    
    // Store the raw user response for the agent to analyze
    workflow.context.routingDecisions.set('user_enhancement_response', userResponseText);
    
    // For enhancement classification, prepare the context for the analyst to process
    if (workflow.currentStep === 0 || workflow.sequence?.[workflow.currentStep]?.step === 'enhancement_classification') {
      // Add classification context for the analyst agent to process
      workflow.context.routingDecisions.set('needs_classification', true);
      workflow.context.routingDecisions.set('classification_context', {
        userResponse: userResponseText,
        options: ['single_story', 'small_feature', 'major_enhancement'],
        criteria: {
          single_story: 'Simple enhancements that can be completed in a single story (< 4 hours)',
          small_feature: 'Focused features requiring 1-3 stories',
          major_enhancement: 'Complex enhancements requiring multiple epics and architectural changes'
        }
      });
      
    }
  }

}

module.exports = { WorkflowStateManager };