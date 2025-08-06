
const { WorkflowStatus } = require('../types.js');

class DynamicWorkflowHandler {
  constructor(workflowEngine, workflowParser) {
    this.workflowEngine = workflowEngine;
    this.workflowParser = workflowParser;
    this.dynamicWorkflows = new Map();
  }

  async start(config) {
    const workflowId = config.workflowId || this.workflowEngine.generateWorkflowId();
    
    try {
      let dynamicWorkflow = this.dynamicWorkflows.get(config.sequence);
      
      if (!dynamicWorkflow) {
        const workflowExists = await this.workflowParser.workflowExists(config.sequence);
        if (workflowExists) {
          dynamicWorkflow = await this.workflowParser.parseWorkflowFile(config.sequence);
          await this.workflowParser.resolveReferences(dynamicWorkflow);
          this.dynamicWorkflows.set(config.sequence, dynamicWorkflow);
        } else {
          return this.workflowEngine.startWorkflow(config);
        }
      }

      const workflow = {
        id: workflowId,
        name: dynamicWorkflow.name || config.name || 'Dynamic BMAD Workflow',
        description: dynamicWorkflow.description || config.description || 'Dynamic workflow execution',
        sequence: dynamicWorkflow.steps,
        userPrompt: config.userPrompt || '',
        status: WorkflowStatus.INITIALIZING,
        currentStep: 0,
        currentAgent: null,
        startTime: new Date(),
        endTime: null,
        context: {
          ...config.context,
          artifacts: new Map(),
          routingDecisions: new Map(),
          elicitationHistory: []
        },
        artifacts: [],
        messages: [],
        errors: [],
        metadata: {
          ...config.metadata,
          workflowType: 'dynamic',
          yamlSource: config.sequence,
          originalYaml: dynamicWorkflow.originalYaml
        },
        checkpointEnabled: this.workflowEngine.checkpointEnabled,
        dynamicWorkflow: dynamicWorkflow,
        handoffPrompts: dynamicWorkflow.handoffPrompts
      };

      if (!workflow.sequence || workflow.sequence.length === 0) {
        throw new Error(`Dynamic workflow ${config.sequence} has no executable steps`);
      }

      this.workflowEngine.activeWorkflows.set(workflowId, workflow);
      await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow);

      if (workflow.checkpointEnabled) {
        await this.workflowEngine.checkpointManager.create(workflowId, 'workflow_initialized', `Dynamic workflow ${config.sequence} started`);
      }

      await this.executeNextStep(workflowId);

      return {
        workflowId,
        status: workflow.status,
        message: `Dynamic workflow ${config.sequence} started successfully`
      };

    } catch (error) {
      const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.status = WorkflowStatus.ERROR;
        workflow.errors.push({
          timestamp: new Date(),
          error: error.message,
          step: workflow.currentStep,
          type: 'dynamic_workflow_error'
        });
      }
      throw error;
    }
  }

  async executeNextStep(workflowId) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      if (workflow.currentStep >= workflow.sequence.length) {
        await this.workflowEngine.completeWorkflow(workflowId);
        return;
      }

      const step = workflow.sequence[workflow.currentStep];

      switch (step.type) {
        case 'routing':
          return await this.handleRoutingStep(workflowId, step);
        case 'cycle':
          return await this.handleCycleStep(workflowId, step);
        case 'step':
        case 'agent':
        default:
          return await this.handleRegularStep(workflowId, step);
      }

    } catch (error) {
      workflow.status = WorkflowStatus.ERROR;
      workflow.errors.push({
        timestamp: new Date(),
        error: error.message,
        step: workflow.currentStep,
        type: 'dynamic_step_error'
      });
      throw error;
    }
  }

  async handleRegularStep(workflowId, step) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    
    if (step.condition && !this.evaluateStepCondition(workflow, step)) {
      workflow.currentStep++;
      return await this.executeNextStep(workflowId);
    }

    if (step.requires && !this.validateArtifactRequirements(workflow, step)) {
      throw new Error(`Step ${workflow.currentStep} requirements not met: ${step.requires}`);
    }

    if (workflow.status !== WorkflowStatus.PAUSED_FOR_ELICITATION) {
      workflow.status = WorkflowStatus.RUNNING;
    }

    const agent = await this.workflowEngine.agentLoader.loadAgent(step.agentId);
    if (!agent) {
      throw new Error(`Agent ${step.agentId} not found`);
    }

    const agentContext = this.workflowEngine.prepareAgentContext(workflow, step, agent);
    const executionResult = await this.workflowEngine.executeAgent(workflowId, step.agentId, agentContext);

    if (executionResult.elicitationRequired || executionResult.type === 'elicitation_required') {
      workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
      workflow.elicitationDetails = {
        sectionTitle: executionResult.elicitationData?.sectionTitle || 'User Input Required',
        instruction: executionResult.elicitationData?.instruction || 'Please provide additional information',
        sectionId: executionResult.elicitationData?.sectionId,
        agentId: step.agentId,
        content: executionResult.elicitationData?.content || executionResult.content
      };
      workflow.currentAgent = step.agentId;
      
      await this.workflowEngine.communicator.sendMessage(workflowId, {
        from: step.agentId,
        to: 'user', 
        type: 'elicitation_request',
        content: workflow.elicitationDetails,
        timestamp: new Date()
      });
      
      // Save workflow state with elicitation details to database
      await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow);
      
      return;
    }

    if (executionResult.success || executionResult.timedOut) {
      await this.workflowEngine.handleAgentCompletion(workflowId, step.agentId, executionResult);
    } else {
      throw new Error(`Agent ${step.agentId} execution failed: ${executionResult?.error || 'Unknown error'}`);
    }
  }

  async handleRoutingStep(workflowId, step) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    
    logger.info('🔄 [ROUTING DEBUG] Handling routing step:', {
      stepName: step.step || step.stepName,
      condition: step.condition,
      hasRoutes: !!step.routes,
      routingDecisions: workflow.context.routingDecisions ? Array.from(workflow.context.routingDecisions.entries()) : 'none'
    });
    
    if ((step.step === 'routing_decision' || step.stepName === 'routing_decision') && step.condition === 'based_on_classification') {
      const routingChoice = workflow.context.routingDecisions.get('enhancement_classification');
      
      if (!routingChoice) {
        workflow.context.routingDecisions.set('enhancement_classification', 'major_enhancement');
        workflow.currentStep++;
        return await this.executeNextStep(workflowId);
      }

      if (routingChoice === 'single_story' || routingChoice === 'small_feature') {
        await this.workflowEngine.completeWorkflow(workflowId, `Completed via ${routingChoice} route`);
        return;
      }
      
      workflow.currentStep++;
      return await this.executeNextStep(workflowId);
    }
    
    workflow.currentStep++;
    return await this.executeNextStep(workflowId);
  }

  async handleCycleStep(workflowId, step) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    workflow.currentStep++;
    return await this.executeNextStep(workflowId);
  }

  evaluateStepCondition(workflow, step) {
    const condition = step.condition;
    
    switch (condition) {
      case 'major_enhancement_path':
        return workflow.context.routingDecisions.get('enhancement_classification') === 'major_enhancement';
      case 'documentation_inadequate':
        return workflow.context.routingDecisions.get('documentation_check') === 'inadequate';
      case 'after_prd_creation':
        return workflow.context.artifacts.has('prd.md');
      case 'architecture_changes_needed':
        return workflow.context.routingDecisions.get('architecture_decision') === 'needed';
      case 'po_checklist_issues':
        return workflow.context.routingDecisions.get('po_validation') === 'issues_found';
      case 'enhancement_includes_ui_changes':
        return workflow.context.routingDecisions.get('enhancement_includes_ui_changes') === true;
      default:
        return true;
    }
  }

  validateArtifactRequirements(workflow, step) {
    if (!step.requires) return true;
    
    const requires = Array.isArray(step.requires) ? step.requires : [step.requires];
    
    for (const artifact of requires) {
      if (!workflow.context.artifacts.has(artifact)) {
        return false;
      }
    }
    
    return true;
  }
}

module.exports = { DynamicWorkflowHandler };
