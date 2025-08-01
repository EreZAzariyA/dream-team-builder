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
const { logUserActivity } = require('../utils/activityLogger.js');

class WorkflowEngine {
  constructor() {
    this.agentLoader = new AgentLoader();
    this.communicator = new AgentCommunicator();
    this.executor = new AgentExecutor(this.agentLoader);
    this.artifactManager = new ArtifactManager();
    this.activeWorkflows = new Map();
    this.executionHistory = new Map();
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
    const workflowId = this.generateWorkflowId();
    
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
        metadata: config.metadata || {}
      };

      // Validate workflow sequence
      const validation = await this.agentLoader.validateWorkflowSequence(workflow.sequence);
      if (!validation.valid) {
        throw new Error(`Invalid workflow sequence: ${validation.errors.join(', ')}`);
      }

      // Store workflow
      this.activeWorkflows.set(workflowId, workflow);

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
      workflow.status = WorkflowStatus.ERROR;
      workflow.errors.push({
        timestamp: new Date(),
        error: error.message,
        step: workflow.currentStep,
        agent: workflow.currentAgent
      });
      throw error;
    }
  }

  /**
   * Execute a specific agent with real task processing
   */
  async executeAgent(workflowId, agentId, context) {
    const workflow = this.activeWorkflows.get(workflowId);
    const agent = await this.agentLoader.loadAgent(agentId);

    try {
      // Execute agent using real task processing
      const executionResult = await this.executor.executeAgent(agent, context);

      // Update agent status
      this.agentLoader.updateAgentStatus(agentId, AgentStatus.COMPLETED, {
        workflowId,
        result: executionResult
      });

      return executionResult;

    } catch (error) {
      console.error(`Error executing agent ${agentId}:`, error);
      this.agentLoader.updateAgentStatus(agentId, AgentStatus.ERROR, {
        workflowId,
        error: error.message
      });
      
      // Return error result instead of throwing to keep workflow running
      return {
        agentId,
        agentName: agent?.agent?.name || agentId,
        executionTime: 0,
        artifacts: [],
        messages: [`Error executing ${agentId}: ${error.message}`],
        success: false,
        error: error.message
      };
    }
  }


  /**
   * Handle agent completion and move to next step
   */
  async handleAgentCompletion(workflowId, agentId, executionResult) {
    const workflow = this.activeWorkflows.get(workflowId);
    
    // Store execution results
    workflow.artifacts.push(...executionResult.artifacts);
    workflow.messages.push({
      from: agentId,
      to: 'system',
      type: 'completion',
      content: executionResult,
      timestamp: new Date()
    });

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
   * Cleanup completed workflows
   */
  cleanup(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    for (const [workflowId, workflow] of this.executionHistory) {
      if (workflow.endTime && workflow.endTime < cutoffTime) {
        this.executionHistory.delete(workflowId);
      }
    }
  }
}

module.exports = { WorkflowEngine };