
const { WorkflowStatus } = require('../types.js');
import logger from '../../utils/logger.js';

class DynamicWorkflowHandler {
  constructor(workflowEngine, workflowParser) {
    this.workflowEngine = workflowEngine;
    this.workflowParser = workflowParser;
    this.dynamicWorkflows = new Map();
  }

  async start(config, userId = null) {
    // Validate required config parameters
    if (!config || !config.sequence) {
      throw new Error('Dynamic workflow configuration requires a sequence parameter');
    }
    
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
          return this.workflowEngine.startWorkflow(config, userId);
        }
      }

      const workflow = {
        id: workflowId,
        name: dynamicWorkflow.name || config.name || 'Dynamic BMAD Workflow',
        title: dynamicWorkflow.name || config.name || 'Dynamic BMAD Workflow',
        description: dynamicWorkflow.description || config.description || 'Dynamic workflow execution',
        sequence: dynamicWorkflow.steps,
        prompt: config.userPrompt || '',
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

      // Save initial workflow state to database
      await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow, userId);

      if (workflow.checkpointEnabled) {
        await this.workflowEngine.checkpointManager.create(workflowId, 'workflow_initialized', `Dynamic workflow ${config.sequence} started`);
      }

      // Extract userId from workflow context
      const extractedUserId = workflow.context?.initiatedBy || userId;
      
      await this.executeNextStep(workflowId, extractedUserId);
      
      // Save updated workflow state after first step execution
      const finalWorkflow = this.workflowEngine.activeWorkflows.get(workflowId);
      if (finalWorkflow) {
        await this.workflowEngine.databaseService.saveWorkflow(workflowId, finalWorkflow, extractedUserId);
      }


      return {
        workflowId,
        status: finalWorkflow?.status || workflow.status,
        currentStep: finalWorkflow?.currentStep || workflow.currentStep,
        message: `Dynamic workflow ${config.sequence} started successfully`
      };

    } catch (error) {
      const existingWorkflow = this.workflowEngine.activeWorkflows.get(workflowId);
      if (existingWorkflow) {
        existingWorkflow.status = WorkflowStatus.ERROR;
        let errorMessage;
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if (error && error.toString && typeof error.toString === 'function') {
          errorMessage = error.toString();
        } else {
          errorMessage = 'Unknown workflow error occurred';
        }
        
        existingWorkflow.errors.push({
          timestamp: new Date(),
          error: errorMessage,
          step: existingWorkflow.currentStep || 0,
          type: 'dynamic_workflow_error'
        });
        
        // Save error state to database
        try {
          await this.workflowEngine.databaseService.saveWorkflow(workflowId, existingWorkflow, userId);
        } catch (saveError) {
          logger.error(`Failed to save error state for workflow ${workflowId}:`, saveError);
        }
      }
      
      logger.error(`Dynamic workflow ${workflowId} failed during start:`, error);
      throw error;
    }
  }

  async executeNextStep(workflowId, userId = null) {
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

      // Detect step type based on properties if not explicitly set
      let stepType = step.type;
      if (!stepType) {
        if (step.routes) {
          stepType = 'routing';
        } else if (step.condition) {
          stepType = 'step';
        } else {
          stepType = 'agent';
        }
      }

      switch (stepType) {
        case 'routing':
          return await this.handleRoutingStep(workflowId, step, userId);
        case 'cycle':
          return await this.handleCycleStep(workflowId, step, userId);
        case 'workflow_control':
          return await this.handleWorkflowControlStep(workflowId, step, userId);
        case 'step':
          return await this.handleRegularStep(workflowId, step, userId);
        case 'agent':
        default:
          return await this.handleRegularStep(workflowId, step, userId);
      }

    } catch (error) {
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
        errorMessage = 'Unknown error occurred';
      }
      
      workflow.errors.push({
        timestamp: new Date(),
        error: errorMessage,
        step: workflow.currentStep,
        type: 'dynamic_step_error'
      });
      throw new Error(errorMessage); // Throw a clean error instead of the original
    }
  }

  async handleRegularStep(workflowId, step, userId = null) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    let executionResult = null; // Initialize executionResult
    
    logger.info(`🔍 [HANDLE REGULAR STEP] Starting step ${workflow.currentStep} for agent ${step.agentId}, status: ${workflow.status}`);
    logger.info(`🔍 [HANDLE REGULAR STEP] Step details: ${JSON.stringify({
      stepName: step.step,
      action: step.action,
      agentId: step.agentId,
      condition: step.condition
    })}`);
    
    if (step.condition && !this.evaluateStepCondition(workflow, step)) {
      logger.info(`🔍 [HANDLE REGULAR STEP] Step condition not met: ${step.condition}, advancing step`);
      workflow.currentStep++;
      return await this.executeNextStep(workflowId, userId);
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
    
    logger.info(`🔍 [AGENT CONTEXT] Prepared context: ${JSON.stringify({
      action: agentContext.action,
      command: agentContext.command,
      needsClassification: workflow.context?.routingDecisions?.get('needs_classification'),
      userResponse: workflow.context?.routingDecisions?.get('user_enhancement_response'),
      hasClassificationContext: !!workflow.context?.routingDecisions?.get('classification_context')
    })}`);
    
    try {
      logger.info(`🔍 [AGENT EXECUTION] About to execute agent ${step.agentId} with context`);
      executionResult = await this.workflowEngine.executeAgent(workflowId, step.agentId, agentContext, userId);
      logger.info(`🔍 [AGENT EXECUTION] Agent execution completed: ${JSON.stringify({
        success: executionResult?.success,
        type: executionResult?.type,
        hasOutput: !!executionResult?.output,
        error: executionResult?.error
      })}`);
    } catch (error) {
      logger.error(`[DynamicWorkflowHandler] Error executing agent: ${error.message}`);
      executionResult = { success: false, error: error.message, type: 'execution_error' };
    }


    // CRITICAL FIX: Don't treat successful AI executions as elicitation
    // If the AI successfully processed the user input, we should advance, not repeat elicitation
    
    // Determine if this step needs elicitation
    const condition1 = executionResult?.elicitationRequired;
    const condition2 = executionResult?.type === 'elicitation_required';
    const condition3a = !executionResult?.success;
    const condition3b = (step.uses || step.action === 'classify enhancement scope' || step.action === 'check existing documentation');
    const condition3c = !workflow.context?.routingDecisions?.get('user_enhancement_response');
    
    // SPECIAL: Template error should trigger elicitation for steps with 'uses'
    const isTemplateError = executionResult?.type === 'template_error';
    const condition4 = isTemplateError && step.uses;
    
    const condition3 = condition3a && condition3b && condition3c;
    
    // NEW: Check if we're resuming from elicitation (workflow was paused for elicitation)
    const isResumingFromElicitation = workflow.status === WorkflowStatus.PAUSED_FOR_ELICITATION;
    
    // FIXED LOGIC: If we're resuming from elicitation and got a successful result, DON'T treat as elicitation
    const isElicitationStep = (
      !isResumingFromElicitation && // Don't elicit if we're resuming
      (condition1 || condition2 || condition3 || condition4)
    ) || (
      isResumingFromElicitation && // If resuming, only elicit if execution failed
      !executionResult?.success &&
      (condition1 || condition2)
    );

    // 🤖 ENHANCED: Check if AI processed instructions and generated user-friendly content
    // if (executionResult?.success && executionResult?.output?.content) {
    //   const aiResponseResult = await this.processAIResponse(executionResult, step, workflow, workflowId, userId);
    //   if (aiResponseResult === 'handled') {
    //     return; // AI response was handled, we're done
    //   }
    //   if (aiResponseResult === 'continue') {
    //     workflow.currentStep++;
    //     return await this.executeNextStep(workflowId, userId);
    //   }
    //   // If aiResponseResult is null, fall through to regular processing
    // }

    if (isElicitationStep) {
      workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
      
      // Special handling for template errors - provide more context
      let elicitationTitle, elicitationInstruction;
      if (isTemplateError && step.uses) {
        elicitationTitle = `${step.action || 'Task'} - Manual Input Required`;
        elicitationInstruction = `The automated template for "${step.uses}" is not available. Please provide the following information manually:\n\n${step.notes || 'Please provide the required information for this step.'}`;
      } else {
        elicitationTitle = executionResult?.elicitationData?.sectionTitle || step.action || 'User Input Required';
        
        elicitationInstruction = executionResult?.elicitationData?.instruction || step.notes || 'Please provide additional information';
      }
      
      workflow.elicitationDetails = {
        sectionTitle: elicitationTitle,
        instruction: elicitationInstruction,
        sectionId: executionResult?.elicitationData?.sectionId || step.step || `step_${step.index}`,
        agentId: step.agentId,
        content: executionResult?.elicitationData?.content || executionResult?.content || step.notes,
        type: executionResult?.type || 'elicitation_required' // Track elicitation type
      };
      workflow.currentAgent = {
        agentId: step.agentId,
        agentName: agent.name || step.agentId, // Assuming agent.name is available or use agentId as fallback
        startedAt: new Date()
      };
      
      await this.workflowEngine.communicator.sendMessage(workflowId, {
        from: step.agentId,
        to: 'user', 
        type: 'elicitation_request',
        content: workflow.elicitationDetails,
        timestamp: new Date()
      });
      
      // Save workflow state with elicitation details to database
      await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow, userId);
      
      return;
    }

    // If we reach here, the step executed successfully and we should progress

    if (executionResult.success || executionResult.timedOut) {
      // If we were resuming from elicitation, set status to RUNNING after successful processing
      if (isResumingFromElicitation) {
        workflow.status = WorkflowStatus.RUNNING;
      }
      
      await this.workflowEngine.handleAgentCompletion(workflowId, step.agentId, executionResult);
      
      // Special handling for classification steps - extract and store the classification result
      if (step.action === 'classify enhancement scope' && executionResult.success) {
        const classification = workflow.context?.routingDecisions?.get('enhancement_classification');
        logger.info(`🔍 [CLASSIFICATION RESULT] Classification set to: ${classification}`);
      }
      
      // For dynamic workflows, we need to advance to the next step after successful completion
      workflow.currentStep++;
      
      // Send Pusher update for step advancement
      if (this.workflowEngine.communicator) {
        await this.workflowEngine.communicator.sendMessage(workflowId, {
          from: 'system',
          to: 'user',
          type: 'workflow_progress',
          content: {
            currentStep: workflow.currentStep,
            totalSteps: workflow.sequence.length,
            progress: Math.round((workflow.currentStep / workflow.sequence.length) * 100),
            message: `Advanced to step ${workflow.currentStep + 1}: ${workflow.sequence[workflow.currentStep]?.step || 'Next Step'}`
          },
          timestamp: new Date()
        });
      }
      
      // Continue with the next step execution - let the bmad-orchestrator agent handle routing
      return await this.executeNextStep(workflowId, userId);
    } else {
      // Ensure error message is always a string to prevent recursive objects
      const cleanError = typeof executionResult?.error === 'string' 
        ? executionResult.error 
        : (executionResult?.error?.message || String(executionResult?.error) || 'Unknown error');
      throw new Error(`Agent ${step.agentId} execution failed: ${cleanError}`);
    }
  }

  async handleRoutingStep(workflowId, step, userId = null) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    
    logger.info(`🔍 [ROUTING STEP] Processing routing step: ${step.step || step.stepName}, action: ${step.action}`);
    logger.info(`🔍 [ROUTING STEP] Step details: ${JSON.stringify({ step: step.step, stepName: step.stepName, routes: !!step.routes, action: step.action })}`);
    
    if ((step.step === 'routing_decision' || step.stepName === 'routing_decision') && step.action === 'route based on classification') {
      let routingChoice = workflow.context.routingDecisions.get('enhancement_classification');
      const userResponse = workflow.context.routingDecisions.get('user_enhancement_response');
      
      logger.info(`🔍 [ROUTING CHOICE] Current classification: ${routingChoice}, user response exists: ${!!userResponse}`);
      
      // If no classification exists, let bmad-orchestrator read from workflow artifacts
      if (!routingChoice) {
        logger.info(`🎭 [BMAD ORCHESTRATOR] Reading classification from workflow artifacts`);
        
        // Check if classification artifact exists from previous step
        const classificationArtifact = workflow.context?.artifacts?.get('enhancement_classification') || 
                                       workflow.artifacts?.find(a => a.id === 'enhancement_classification');
        
        if (classificationArtifact) {
          // Parse the classification from artifact content
          routingChoice = this.parseClassificationFromArtifact(classificationArtifact);
          logger.info(`🎭 [BMAD ORCHESTRATOR] Found classification in artifact: ${routingChoice}`);
        } else {
          // No classification artifact found - this is a workflow design issue
          logger.warn(`🎭 [BMAD ORCHESTRATOR] No classification artifact found. Defaulting to major_enhancement`);
          routingChoice = 'major_enhancement';
        }
        
        // Store the classification result in routing decisions for this routing step
        workflow.context.routingDecisions.set('enhancement_classification', routingChoice);
      }

      // Get the (possibly updated) routing choice
      const finalRoutingChoice = workflow.context.routingDecisions.get('enhancement_classification');
      
      if (finalRoutingChoice === 'single_story' || finalRoutingChoice === 'small_feature') {
        // Find the corresponding route and handle it properly
        const route = step.routes[finalRoutingChoice];
        logger.info(`🛤️ [ROUTING] Following ${finalRoutingChoice} route:`, route);
        
        if (route && route.goto) {
          // This route redirects to a different workflow path/task
          logger.info(`🛤️ [ROUTING] Route redirects to: ${route.goto}`);
          
          // For brownfield_story_creation or brownfield_epic_creation, 
          // these are external tasks that should be handled outside this workflow
          const routeMessage = finalRoutingChoice === 'single_story' 
            ? `Enhancement classified as single story. Use the brownfield-create-story task to create a focused development story.`
            : `Enhancement classified as small feature. Use the brownfield-create-epic task to create an epic with multiple related stories.`;
            
          // Send completion message with routing instructions
          await this.workflowEngine.communicator.sendMessage(workflowId, {
            from: 'bmad-orchestrator',
            to: 'user',
            type: 'workflow_complete',
            content: {
              message: routeMessage,
              nextAction: route.goto,
              classification: finalRoutingChoice,
              userPrompt: workflow.userPrompt
            },
            timestamp: new Date()
          });
          
          await this.workflowEngine.completeWorkflow(workflowId, `Custom routing completion`);
          return;
        } else {
          // Fallback if route structure is unexpected
          await this.workflowEngine.completeWorkflow(workflowId, `Completed via ${finalRoutingChoice} route`);
          return;
        }
      }
      
      // If major_enhancement, just continue to the next step in the sequence
      workflow.currentStep++;
      return await this.executeNextStep(workflowId, userId);
    }
    
    workflow.currentStep++;
    return await this.executeNextStep(workflowId, userId);
  }

  async handleCycleStep(workflowId, step, userId = null) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    workflow.currentStep++;
    return await this.executeNextStep(workflowId, userId);
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

  /**
   * 🤖 Enhanced AI response processing with flexible format handling
   */
  async processAIResponse(executionResult, step, workflow, workflowId, userId) {
    try {
      // Try to parse as JSON first
      const aiOutput = JSON.parse(executionResult.output.content);
      logger.info(`🤖 [AI PROCESSED] AI generated response:`, aiOutput);
      
      // Handle elicitation response
      if (aiOutput.elicitationRequired && aiOutput.userMessage) {
        logger.info(`✅ [AI ELICITATION] AI processed instructions and generated user question`);
        return await this.handleAIElicitation(aiOutput, step, workflow, workflowId, userId);
      }
      
      // Handle classification response
      if (aiOutput.classification) {
        logger.info(`🧠 [AI CLASSIFICATION] AI provided classification: ${aiOutput.classification}`);
        workflow.context.routingDecisions.set('enhancement_classification', aiOutput.classification);
        return 'continue';
      }
      
      // Handle general content response (no elicitation needed)
      if (aiOutput.userMessage && !aiOutput.elicitationRequired) {
        logger.info(`📝 [AI CONTENT] AI provided informational content, continuing workflow`);
        // Store the AI response as an artifact if needed
        if (step.creates) {
          workflow.context.artifacts.set(step.creates, aiOutput.userMessage);
        }
        return 'continue';
      }
      
      logger.info(`🤖 [AI RESPONSE] No specific handling pattern matched, falling back to standard processing`);
      return null;
      
    } catch (parseError) {
      // Not valid JSON - try to handle as plain text
      logger.info(`🤖 [AI RESPONSE] Not JSON format, checking plain text response`);
      
      const content = executionResult.output.content;
      
      // Classification detection in plain text (check first, before elicitation detection)
      const classificationMatch = content.match(/classification[:\s]*(single_story|small_feature|major_enhancement)/i);
      if (classificationMatch) {
        const classification = classificationMatch[1].toLowerCase();
        logger.info(`🧠 [AI TEXT CLASSIFICATION] Found classification in text: ${classification}`);
        workflow.context.routingDecisions.set('enhancement_classification', classification);
        return 'continue';
      }
      
      // Enhanced classification detection - look for the classification values directly
      if (content.toLowerCase().includes('single_story') || 
          content.toLowerCase().includes('small_feature') || 
          content.toLowerCase().includes('major_enhancement')) {
        
        // Extract the classification value
        let classification = 'major_enhancement'; // default
        if (content.toLowerCase().includes('single_story')) classification = 'single_story';
        else if (content.toLowerCase().includes('small_feature')) classification = 'small_feature';
        
        logger.info(`🧠 [AI TEXT CLASSIFICATION] Found classification by keyword: ${classification}`);
        workflow.context.routingDecisions.set('enhancement_classification', classification);
        return 'continue';
      }
      
      // REMOVED: Hard-coded classification fallback logic
      // The bmad-orchestrator agent now handles intelligent classification during routing
      
      // Check for common patterns in plain text responses (BUT NOT for classification steps)
      if (step.action !== 'classify enhancement scope' && 
          (content.includes('elicitation') || content.includes('user input') || content.includes('?'))) {
        logger.info(`🤖 [AI TEXT] Text response appears to need user input, treating as elicitation`);
        return await this.handleAIElicitation({ 
          userMessage: content, 
          elicitationRequired: true 
        }, step, workflow, workflowId, userId);
      }
      
      // General content - store and continue
      logger.info(`📝 [AI TEXT] General text content, continuing workflow`);
      if (step.creates) {
        workflow.context.artifacts.set(step.creates, content);
      }
      return 'continue';
    }
  }

  /**
   * Handle AI-generated elicitation
   */
  async handleAIElicitation(aiOutput, step, workflow, workflowId, userId) {
    workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
    workflow.elicitationDetails = {
      sectionTitle: step.action || 'User Input Required',
      instruction: aiOutput.userMessage,
      context: aiOutput.context || '',
      agentId: step.agentId,
      content: aiOutput.userMessage
    };
    workflow.currentAgent = {
      agentId: step.agentId,
      agentName: step.agentId, // Fallback, ideally get from agentLoader
      startedAt: new Date()
    };
    
    await this.workflowEngine.communicator.sendMessage(workflowId, {
      from: step.agentId,
      to: 'user', 
      type: 'elicitation_request',
      content: workflow.elicitationDetails,
      timestamp: new Date()
    });
    
    // Save workflow state with elicitation details to database
    await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow, userId);
    
    return 'handled';
  }

  /**
   * Parse classification result from workflow artifact (proper agent communication)
   */
  parseClassificationFromArtifact(artifact) {
    if (!artifact) return null;
    
    const content = artifact.content || artifact.data || artifact.text || '';
    const contentLower = content.toLowerCase();
    
    // Look for classification values in the artifact content
    if (contentLower.includes('single_story') || contentLower.includes('single story')) {
      return 'single_story';
    }
    if (contentLower.includes('small_feature') || contentLower.includes('small feature')) {
      return 'small_feature';
    }
    if (contentLower.includes('major_enhancement') || contentLower.includes('major enhancement')) {
      return 'major_enhancement';
    }
    
    return null;
  }

  async handleWorkflowControlStep(workflowId, step, userId = null) {
    const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
    
    
    // Log the workflow control step for user awareness but don't execute it as an agent
    if (this.workflowEngine.messageService) {
      await this.workflowEngine.messageService.sendWorkflowMessage(workflowId, {
        type: 'workflow_guidance',
        title: `Workflow Guidance: ${step.controlAction}`,
        content: step.description,
        agentId: 'bmad-orchestrator',
        agentName: 'BMad Orchestrator'
      });
    }
    
    // Simply move to the next step for workflow control steps
    workflow.currentStep++;
    return await this.executeNextStep(workflowId, userId);
  }
}

module.exports = { DynamicWorkflowHandler };
