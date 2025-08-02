/**
 * BMAD Workflow Execution Engine
 * Manages sequential agent execution and workflow coordination
 */

const { AgentLoader } = require('./AgentLoader.js');
const { AgentCommunicator } = require('./AgentCommunicator.js');
const { AgentExecutor } = require('./AgentExecutor.js');
const { ArtifactManager } = require('./ArtifactManager.js');
const { WorkflowStatus, AgentStatus } = require('./types.js');
const WorkflowAnalytics = require('../database/models/WorkflowAnalytics.js');
const WorkflowCheckpoint = require('../database/models/WorkflowCheckpoint.js');
const { logUserActivity } = require('../utils/activityLogger.js');

class WorkflowEngine {
  constructor(options = {}) {
    this.agentLoader = new AgentLoader();
    this.communicator = options.communicator || new AgentCommunicator();
    this.executor = new AgentExecutor(this.agentLoader);
    this.artifactManager = new ArtifactManager();
    this.activeWorkflows = new Map();
    this.executionHistory = new Map();
    
    // Timeout configuration
    this.defaultTimeout = options.defaultTimeout || 120000; // 2 minutes default
    this.maxTimeout = options.maxTimeout || 300000; // 5 minutes max
    this.timeoutRetries = options.timeoutRetries || 1;
    
    // Checkpoint configuration
    this.checkpointEnabled = options.checkpointEnabled !== false; // Default enabled
    this.maxCheckpoints = options.maxCheckpoints || 10; // Keep last 10 checkpoints
    this.workflowCheckpoints = new Map(); // workflowId -> checkpoints[]
  }

  /**
   * Initialize the workflow engine
   */
  async initialize() {
    try {
      await this.agentLoader.loadAllAgents();
      await this.artifactManager.initialize();
      console.log('BMAD Workflow Engine initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Workflow Engine:', error);
      throw error;
    }
  }

  /**
   * Start a new workflow execution
   */
  async startWorkflow(config) {
    const workflowId = config.workflowId || this.generateWorkflowId();
    
    try {
      const workflow = {
        id: workflowId,
        name: config.name || 'BMAD Workflow',
        description: config.description || 'Automated BMAD workflow execution',
        sequence: config.sequence || this.agentLoader.getDefaultWorkflowSequence(),
        userPrompt: config.userPrompt || '',
        status: WorkflowStatus.INITIALIZING,
        currentStep: 0,
        currentAgent: null,
        startTime: new Date(),
        endTime: null,
        context: config.context || {},
        artifacts: [],
        messages: [],
        errors: [],
        metadata: config.metadata || {},
        checkpointEnabled: this.checkpointEnabled
      };

      // Validate workflow sequence
      const validation = await this.agentLoader.validateWorkflowSequence(workflow.sequence);
      if (!validation.valid) {
        throw new Error(`Invalid workflow sequence: ${validation.errors.join(', ')}`);
      }

      // Store workflow
      this.activeWorkflows.set(workflowId, workflow);

      // Initialize checkpoints if enabled
      if (workflow.checkpointEnabled) {
        this.workflowCheckpoints.set(workflowId, []);
        await this.createCheckpoint(workflowId, 'workflow_initialized', 'Workflow started and validated');
      }

      // Log workflow start activity
      await logUserActivity(workflow.context.initiatedBy, 'workflow_start', { workflowId, name: workflow.name, prompt: workflow.userPrompt });

      // Start execution
      workflow.status = WorkflowStatus.RUNNING;
      await this.executeNextStep(workflowId);

      return {
        workflowId,
        status: workflow.status,
        message: 'Workflow started successfully'
      };

    } catch (error) {
      console.error(`Error starting workflow ${workflowId}:`, error);
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.status = WorkflowStatus.ERROR;
        workflow.errors.push({
          timestamp: new Date(),
          error: error.message,
          step: workflow.currentStep
        });
      }
      throw error;
    }
  }

  /**
   * Execute the next step in the workflow
   */
  async executeNextStep(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      // Check if workflow is complete
      if (workflow.currentStep >= workflow.sequence.length) {
        await this.completeWorkflow(workflowId);
        return;
      }

      const step = workflow.sequence[workflow.currentStep];
      const agent = await this.agentLoader.loadAgent(step.agentId);

      if (!agent) {
        throw new Error(`Agent ${step.agentId} not found`);
      }

      // Create checkpoint before agent execution
      if (workflow.checkpointEnabled) {
        await this.createCheckpoint(workflowId, `before_agent_${step.agentId}`, `Before executing ${step.agentId} at step ${workflow.currentStep}`);
      }

      // Update workflow state
      workflow.currentAgent = step.agentId;
      this.agentLoader.updateAgentStatus(step.agentId, AgentStatus.ACTIVE, {
        workflowId,
        executionId: this.generateExecutionId()
      });

      // Prepare agent context
      const agentContext = this.prepareAgentContext(workflow, step, agent);

      // Send activation message
      await this.communicator.sendMessage(workflowId, {
        from: 'system',
        to: step.agentId,
        type: 'activation',
        content: {
          instructions: agent.activationInstructions,
          context: agentContext,
          userPrompt: workflow.userPrompt
        },
        timestamp: new Date()
      });

      // Start agent execution with real task processing
      const executionResult = await this.executeAgent(workflowId, step.agentId, agentContext);

      // Handle execution result
      await this.handleAgentCompletion(workflowId, step.agentId, executionResult);

    } catch (error) {
      console.error(`Error executing step ${workflow.currentStep} in workflow ${workflowId}:`, error);
      
      // Attempt auto-rollback on critical failures
      const rollbackSuccess = await this.handleCriticalFailure(workflowId, error);
      
      if (!rollbackSuccess) {
        // No rollback possible or failed, mark as error
        workflow.status = WorkflowStatus.ERROR;
        workflow.errors.push({
          timestamp: new Date(),
          error: error.message,
          step: workflow.currentStep,
          agent: workflow.currentAgent
        });
        throw error;
      }
      
      // Rollback succeeded, workflow is now in ROLLED_BACK state
      // Don't throw error, let caller handle the rollback state
    }
  }

  /**
   * Execute a specific agent with real task processing and timeout handling
   */
  async executeAgent(workflowId, agentId, context) {
    const workflow = this.activeWorkflows.get(workflowId);
    const agent = await this.agentLoader.loadAgent(agentId);
    
    // Determine timeout for this agent
    const step = workflow.sequence[workflow.currentStep];
    const timeout = step.timeout || this.defaultTimeout;
    const clampedTimeout = Math.min(Math.max(timeout, 10000), this.maxTimeout);

    let attempt = 0;
    let lastError = null;
    let executionResult = null; // Initialize executionResult outside the loop

    while (attempt <= this.timeoutRetries) {
      try {
        console.log(`Executing agent ${agentId} (attempt ${attempt + 1}/${this.timeoutRetries + 1}) with ${clampedTimeout}ms timeout`);
        
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Agent ${agentId} execution timed out after ${clampedTimeout}ms`));
          }, clampedTimeout);
        });

        // Execute agent with timeout using Promise.race
        executionResult = await Promise.race([
          this.executor.executeAgent(agent, context),
          timeoutPromise
        ]);

        // If elicitation is required, propagate the signal immediately
        if (executionResult && executionResult.type === 'elicitation_required') {
          return executionResult;
        }

        // Success - update agent status and break loop
        this.agentLoader.updateAgentStatus(agentId, AgentStatus.COMPLETED, {
          workflowId,
          result: executionResult
        });
        return executionResult; // Successful execution, exit loop and function

      } catch (error) {
        lastError = error;
        attempt++;
        
        if (error.message.includes('timed out')) {
          console.warn(`Agent ${agentId} timed out on attempt ${attempt}/${this.timeoutRetries + 1}`);
          
          // Update status to timeout for retry attempts
          this.agentLoader.updateAgentStatus(agentId, AgentStatus.TIMEOUT, {
            workflowId,
            error: error.message,
            attempt
          });
          
          if (attempt <= this.timeoutRetries) {
            console.log(`Retrying agent ${agentId} execution...`);
            continue; // Continue to next attempt
          }
        } else {
          // Non-timeout error, don't retry
          console.error(`Error executing agent ${agentId}:`, error);
          break; // Break loop for non-retryable errors
        }
      }
    }

    // If loop completes, all attempts failed or a non-retryable error occurred
    const finalStatus = lastError.message.includes('timed out') ? AgentStatus.TIMEOUT : AgentStatus.ERROR;
    this.agentLoader.updateAgentStatus(agentId, finalStatus, {
      workflowId,
      error: lastError.message
    });
    
    // Return error result instead of throwing to keep workflow running
    return {
      agentId,
      agentName: agent?.agent?.name || agentId,
      executionTime: 0,
      artifacts: [],
      messages: [`Agent ${agentId} failed after ${attempt} attempts: ${lastError.message}`],
      success: false,
      error: lastError.message,
      timedOut: lastError.message.includes('timed out'),
      attempts: attempt
    };
  }


  /**
   * Handle agent completion and move to next step
   */
  async handleAgentCompletion(workflowId, agentId, executionResult) {
    const workflow = this.activeWorkflows.get(workflowId);
    
    // If elicitation is required, pause the workflow and signal the frontend
    if (executionResult.type === 'elicitation_required') {
      workflow.status = WorkflowStatus.PAUSED_FOR_ELICITATION;
      workflow.elicitationDetails = executionResult;
      await this.communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'user',
        type: 'elicitation_required',
        content: executionResult,
        timestamp: new Date()
      });
      console.log(`Workflow ${workflowId} paused for elicitation at step ${workflow.currentStep}`);
      return; // Do not proceed to next step or completion
    }

    // Store execution results
    workflow.artifacts.push(...executionResult.artifacts);
    workflow.messages.push({
      from: agentId,
      to: 'system',
      type: 'completion',
      content: executionResult,
      timestamp: new Date()
    });

    // Handle timeout/error recovery
    if (!executionResult.success) {
      if (executionResult.timedOut) {
        console.warn(`Agent ${agentId} timed out after ${executionResult.attempts || 1} attempts`);
        
        // Log timeout for monitoring
        workflow.errors.push({
          timestamp: new Date(),
          error: `Agent ${agentId} execution timeout`,
          step: workflow.currentStep,
          agent: agentId,
          type: 'timeout',
          attempts: executionResult.attempts || 1
        });
        
        // Send timeout notification
        await this.communicator.sendMessage(workflowId, {
          from: 'system',
          to: 'user',
          type: 'error',
          content: {
            message: `Agent ${agentId} execution timed out, continuing with limited results`,
            agentId,
            step: workflow.currentStep,
            canContinue: true
          },
          timestamp: new Date()
        });
      } else {
        // Non-timeout error
        workflow.errors.push({
          timestamp: new Date(),
          error: executionResult.error,
          step: workflow.currentStep,
          agent: agentId,
          type: 'execution_error'
        });
      }
    }

    // Update agent status
    this.agentLoader.updateAgentStatus(agentId, AgentStatus.IDLE);

    // Move to next step
    workflow.currentStep++;
    workflow.currentAgent = null;

    // Execute next step or complete workflow
    if (workflow.currentStep < workflow.sequence.length) {
      await this.executeNextStep(workflowId);
    } else {
      await this.completeWorkflow(workflowId);
    }
  }

  /**
   * Complete workflow execution
   */
  async completeWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = WorkflowStatus.COMPLETED;
    workflow.endTime = new Date();
    workflow.currentAgent = null;

    // Save artifacts to filesystem
    try {
      const savedArtifacts = await this.artifactManager.saveWorkflowArtifacts(workflowId, workflow.artifacts);
      workflow.savedArtifacts = savedArtifacts;
      console.log(`Saved ${savedArtifacts.length} artifacts for completed workflow ${workflowId}`);
    } catch (error) {
      console.error(`Error saving artifacts for workflow ${workflowId}:`, error);
      workflow.errors.push({
        timestamp: new Date(),
        error: `Failed to save artifacts: ${error.message}`,
        step: 'completion'
      });
    }

    // Send completion message
    await this.communicator.sendMessage(workflowId, {
      from: 'system',
      to: 'user',
      type: 'workflow_complete',
      content: {
        workflowId,
        totalSteps: workflow.sequence.length,
        executionTime: workflow.endTime - workflow.startTime,
        artifactCount: workflow.artifacts.length,
        savedArtifacts: workflow.savedArtifacts?.length || 0,
        success: true
      },
      timestamp: new Date()
    });

    // Move to history
    this.executionHistory.set(workflowId, workflow);
    this.activeWorkflows.delete(workflowId);
    
    // Keep final checkpoint for completed workflows
    if (workflow.checkpointEnabled) {
      await this.createCheckpoint(workflowId, 'workflow_completed', 'Workflow completed successfully');
    }

    // Save analytics
    await this.saveWorkflowAnalytics(workflow);

    // Log workflow completion activity
    await logUserActivity(workflow.context.initiatedBy, 'workflow_complete', { workflowId, status: workflow.status, duration: workflow.endTime - workflow.startTime });

    console.log(`Workflow ${workflowId} completed successfully`);
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.PAUSED;
    
    if (workflow.currentAgent) {
      this.agentLoader.updateAgentStatus(workflow.currentAgent, AgentStatus.PAUSED);
    }

    return { workflowId, status: workflow.status };
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.RUNNING;
    
    if (workflow.currentAgent) {
      this.agentLoader.updateAgentStatus(workflow.currentAgent, AgentStatus.ACTIVE);
    }

    await this.executeNextStep(workflowId);
    return { workflowId, status: workflow.status };
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = WorkflowStatus.CANCELLED;
    workflow.endTime = new Date();
    
    if (workflow.currentAgent) {
      this.agentLoader.updateAgentStatus(workflow.currentAgent, AgentStatus.IDLE);
    }

    this.executionHistory.set(workflowId, workflow);
    this.activeWorkflows.delete(workflowId);

    // Save analytics
    await this.saveWorkflowAnalytics(workflow);

    return { workflowId, status: workflow.status };
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId) || this.executionHistory.get(workflowId);
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
      errors: workflow.errors
    };
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values()).map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      currentStep: workflow.currentStep,
      totalSteps: workflow.sequence.length,
      currentAgent: workflow.currentAgent,
      startTime: workflow.startTime
    }));
  }

  /**
   * Prepare agent context for execution
   */
  prepareAgentContext(workflow, step, agent) {
    return {
      workflowId: workflow.id,
      step: workflow.currentStep,
      totalSteps: workflow.sequence.length,
      userPrompt: workflow.userPrompt,
      previousArtifacts: workflow.artifacts,
      workflowContext: workflow.context,
      agentRole: step.role,
      agentDescription: step.description,
      metadata: workflow.metadata
    };
  }

  /**
   * Generate unique workflow ID
   */
  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get workflow execution history
   */
  getExecutionHistory(limit = 50) {
    return Array.from(this.executionHistory.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get workflow artifacts (includes saved files)
   */
  async getWorkflowArtifacts(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId) || this.executionHistory.get(workflowId);
    if (!workflow) return [];

    // Return in-memory artifacts for active workflows
    if (workflow.status === WorkflowStatus.RUNNING || workflow.status === WorkflowStatus.PAUSED) {
      return workflow.artifacts || [];
    }

    // For completed workflows, try to load from filesystem
    try {
      const savedArtifacts = await this.artifactManager.loadWorkflowArtifacts(workflowId);
      return savedArtifacts.length > 0 ? savedArtifacts : (workflow.artifacts || []);
    } catch (error) {
      console.error(`Error loading artifacts for workflow ${workflowId}:`, error);
      return workflow.artifacts || [];
    }
  }

  /**
   * Save workflow analytics data
   */
  async saveWorkflowAnalytics(workflow) {
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
      console.error(`Error saving analytics for workflow ${workflow.id}:`, error);
    }
  }

  /**
   * Create a checkpoint for the workflow
   */
  async createCheckpoint(workflowId, checkpointType, description = '') {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow || !workflow.checkpointEnabled) {
      return null;
    }

    try {
      const checkpointId = this.generateCheckpointId();
      
      // Prepare checkpoint data
      const checkpointData = {
        checkpointId,
        workflowId,
        type: checkpointType,
        description,
        step: workflow.currentStep,
        currentAgent: workflow.currentAgent,
        status: workflow.status,
        userId: workflow.context.initiatedBy,
        
        // Deep clone the workflow state
        state: {
          artifacts: JSON.parse(JSON.stringify(workflow.artifacts)),
          messages: JSON.parse(JSON.stringify(workflow.messages)),
          errors: JSON.parse(JSON.stringify(workflow.errors)),
          context: JSON.parse(JSON.stringify(workflow.context)),
          metadata: JSON.parse(JSON.stringify(workflow.metadata))
        }
      };

      // Save to database
      const checkpointDoc = new WorkflowCheckpoint(checkpointData);
      await checkpointDoc.save();

      // Also keep in memory for fast access (limited)
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

      // Limit in-memory checkpoint history (keep metadata only)
      if (inMemoryCheckpoints.length > this.maxCheckpoints) {
        inMemoryCheckpoints.shift();
      }

      console.log(`Checkpoint saved: ${checkpointType} for workflow ${workflowId} (DB + Memory)`);
      return { id: checkpointId, ...checkpointData };

    } catch (error) {
      console.error(`Error creating checkpoint for workflow ${workflowId}:`, error);
      return null;
    }
  }

  /**
   * Rollback workflow to a specific checkpoint
   */
  async rollbackToCheckpoint(workflowId, checkpointId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      // Load checkpoint from database
      const checkpointDoc = await WorkflowCheckpoint.findOne({ 
        checkpointId, 
        workflowId 
      }).lean();
      
      if (!checkpointDoc) {
        throw new Error(`Checkpoint ${checkpointId} not found in database for workflow ${workflowId}`);
      }

      console.log(`Rolling back workflow ${workflowId} to checkpoint ${checkpointId}`);
      
      // Update workflow status
      workflow.status = WorkflowStatus.ROLLING_BACK;

      // Send rollback notification
      await this.communicator.sendMessage(workflowId, {
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

      // Restore workflow state from checkpoint
      workflow.currentStep = checkpointDoc.step;
      workflow.currentAgent = checkpointDoc.currentAgent;
      workflow.artifacts = JSON.parse(JSON.stringify(checkpointDoc.state.artifacts));
      workflow.messages = JSON.parse(JSON.stringify(checkpointDoc.state.messages));
      workflow.errors = JSON.parse(JSON.stringify(checkpointDoc.state.errors));
      workflow.context = JSON.parse(JSON.stringify(checkpointDoc.state.context));
      workflow.metadata = JSON.parse(JSON.stringify(checkpointDoc.state.metadata));

      // Reset agent statuses
      if (workflow.currentAgent) {
        this.agentLoader.updateAgentStatus(workflow.currentAgent, AgentStatus.IDLE);
      }

      // Update final status
      workflow.status = WorkflowStatus.ROLLED_BACK;

      // Log rollback activity (with proper event type)
      try {
        await logUserActivity(workflow.context.initiatedBy, 'workflow_start', { 
          workflowId, 
          checkpointId, 
          checkpointType: checkpointDoc.type,
          targetStep: checkpointDoc.step,
          action: 'rollback'
        });
      } catch (activityError) {
        console.warn('Failed to log rollback activity:', activityError.message);
      }

      console.log(`Workflow ${workflowId} successfully rolled back to step ${checkpointDoc.step}`);
      
      return {
        workflowId,
        checkpointId,
        targetStep: checkpointDoc.step,
        status: workflow.status,
        message: 'Rollback completed successfully'
      };

    } catch (error) {
      console.error(`Error rolling back workflow ${workflowId}:`, error);
      workflow.status = WorkflowStatus.ERROR;
      workflow.errors.push({
        timestamp: new Date(),
        error: `Rollback failed: ${error.message}`,
        type: 'rollback_error'
      });
      throw error;
    }
  }

  /**
   * Resume workflow from current state after rollback
   */
  async resumeFromRollback(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== WorkflowStatus.ROLLED_BACK) {
      throw new Error(`Workflow ${workflowId} is not in rolled back state`);
    }

    try {
      console.log(`Resuming workflow ${workflowId} from rollback at step ${workflow.currentStep}`);
      
      // Create resume checkpoint
      if (workflow.checkpointEnabled) {
        await this.createCheckpoint(workflowId, 'resume_from_rollback', `Resuming workflow from step ${workflow.currentStep}`);
      }

      // Update status and resume execution
      workflow.status = WorkflowStatus.RUNNING;
      await this.executeNextStep(workflowId);

      return {
        workflowId,
        status: workflow.status,
        currentStep: workflow.currentStep,
        message: 'Workflow resumed successfully'
      };

    } catch (error) {
      console.error(`Error resuming workflow ${workflowId}:`, error);
      workflow.status = WorkflowStatus.ERROR;
      throw error;
    }
  }

  /**
   * Resume workflow execution after elicitation
   */
  async resumeWorkflowWithElicitation(workflowId, elicitationResponse) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== WorkflowStatus.PAUSED_FOR_ELICITATION) {
      throw new Error(`Workflow ${workflowId} is not paused for elicitation`);
    }

    try {
      console.log(`Resuming workflow ${workflowId} with elicitation response`);
      
      // Store the elicitation response in the workflow's context or artifacts
      // For now, let's add it to the messages and context for the next agent to pick up
      workflow.messages.push({
        from: 'user',
        to: workflow.elicitationDetails.agentId,
        type: 'elicitation_response',
        content: elicitationResponse,
        timestamp: new Date()
      });

      // Clear elicitation details
      workflow.elicitationDetails = null;

      // Update status and resume execution
      workflow.status = WorkflowStatus.RUNNING;
      await this.executeNextStep(workflowId);

      return {
        workflowId,
        status: workflow.status,
        currentStep: workflow.currentStep,
        message: 'Workflow resumed with elicitation response'
      };

    } catch (error) {
      console.error(`Error resuming workflow ${workflowId} with elicitation:`, error);
      workflow.status = WorkflowStatus.ERROR;
      throw error;
    }
  }

  /**
   * Get all checkpoints for a workflow
   */
  async getWorkflowCheckpoints(workflowId) {
    try {
      // Load from database for complete history
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
      console.error(`Error loading checkpoints for workflow ${workflowId}:`, error);
      
      // Fallback to in-memory checkpoints
      const inMemoryCheckpoints = this.workflowCheckpoints.get(workflowId) || [];
      return inMemoryCheckpoints.map(cp => ({
        id: cp.id,
        type: cp.type,
        description: cp.description,
        timestamp: cp.timestamp,
        step: cp.step,
        currentAgent: cp.currentAgent
      }));
    }
  }

  /**
   * Auto-rollback on critical failures
   */
  async handleCriticalFailure(workflowId, error, options = {}) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow || !workflow.checkpointEnabled) {
      return false;
    }

    try {
      // Load checkpoints from database
      const checkpointDocs = await WorkflowCheckpoint.findByWorkflow(workflowId, 5);
      if (checkpointDocs.length === 0) {
        return false;
      }

      // Find the most recent safe checkpoint (not the immediate previous one)
      const safeCheckpoint = checkpointDocs
        .filter(cp => cp.type !== `before_agent_${workflow.currentAgent}`)
        .shift(); // findByWorkflow returns newest first

      if (!safeCheckpoint) {
        return false;
      }

      console.log(`Auto-rollback triggered for workflow ${workflowId} due to: ${error.message}`);
      
      // Perform rollback
      await this.rollbackToCheckpoint(workflowId, safeCheckpoint.checkpointId);

      // Send notification about auto-rollback
      await this.communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'user',
        type: 'error',
        content: {
          message: `Critical failure detected. Auto-rolled back to safe checkpoint.`,
          originalError: error.message,
          checkpointId: safeCheckpoint.checkpointId,
          autoRollback: true,
          canResume: true
        },
        timestamp: new Date()
      });

      return true;

    } catch (rollbackError) {
      console.error(`Auto-rollback failed for workflow ${workflowId}:`, rollbackError);
      return false;
    }
  }

  /**
   * Generate unique checkpoint ID
   */
  generateCheckpointId() {
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cleanup completed workflows and old checkpoints
   */
  async cleanup(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    // Cleanup in-memory data
    for (const [workflowId, workflow] of this.executionHistory) {
      if (workflow.endTime && workflow.endTime < cutoffTime) {
        this.executionHistory.delete(workflowId);
        this.workflowCheckpoints.delete(workflowId);
      }
    }

    // Cleanup database checkpoints (keep for 7 days by default)
    try {
      const result = await WorkflowCheckpoint.cleanup(7);
      if (result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} old checkpoints from database`);
      }
    } catch (error) {
      console.error('Error cleaning up checkpoints from database:', error);
    }
  }
}

module.exports = { WorkflowEngine };