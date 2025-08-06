/**
 * Workflow Engine - Consolidated Single-Source-of-Truth Version
 * Pure orchestrator that delegates all functionality to specialized services
 * 
 * PRINCIPLES:
 * - Single Source of Truth: Each concern handled by ONE service
 * - Pure Delegation: No duplicate implementations
 * - Minimal Code: Orchestrates, doesn't reimplement
 * - Clear Separation: Each service has distinct responsibility
 */

const { AgentLoader } = require('./AgentLoader.js');
const { AgentCommunicator } = require('./AgentCommunicator.js');
const { AgentExecutor } = require('./AgentExecutor.js');
const { MockAgentExecutor } = require('./MockAgentExecutor.js');
const { ArtifactManager } = require('./ArtifactManager.js');
const { WorkflowSequences } = require('./types.js');
import WorkflowParser from './WorkflowParser.js';
const { DynamicWorkflowHandler } = require('./engine/DynamicWorkflowHandler.js');
const { CheckpointManager } = require('./engine/CheckpointManager.js');
const { DatabaseService } = require('./engine/DatabaseService.js');

// Import consolidated service modules - SINGLE SOURCES OF TRUTH
const { WorkflowLifecycleManager } = require('./services/WorkflowLifecycleManager.js');
const { WorkflowStepExecutor } = require('./services/WorkflowStepExecutor.js');
const { WorkflowStateManager } = require('./services/WorkflowStateManager.js');
import logger from '../utils/logger.js';

class WorkflowEngine {
  constructor(options = {}) {
    // Core dependencies
    this.agentLoader = new AgentLoader();
    this.communicator = options.communicator || new AgentCommunicator();
    this.messageService = options.messageService;
    this.mockMode = options.mockMode === true;
    
    // Get aiService - either from options or dynamically import
    this.aiService = options.aiService;
    
    this.executor = this.mockMode 
      ? new MockAgentExecutor(this.agentLoader)
      : new AgentExecutor(this.agentLoader, this.aiService);
    this.artifactManager = new ArtifactManager();
    this.activeWorkflows = new Map();
    this.executionHistory = new Map();
    this.workflowParser = new WorkflowParser();
    this.dynamicWorkflowHandler = new DynamicWorkflowHandler(this, this.workflowParser);
    this.checkpointManager = new CheckpointManager(this);
    this.databaseService = new DatabaseService();
    
    // Configuration options
    this.defaultTimeout = options.defaultTimeout || 120000;
    this.maxTimeout = options.maxTimeout || 300000;
    this.timeoutRetries = options.timeoutRetries || 1;
    this.checkpointEnabled = options.checkpointEnabled !== false;

    // Initialize service modules - SINGLE SOURCES OF TRUTH
    this.lifecycleManager = new WorkflowLifecycleManager(this);
    this.stepExecutor = new WorkflowStepExecutor(this);
    this.stateManager = new WorkflowStateManager(this);
  }

  async initialize() {
    try {
      // If aiService wasn't provided, try to get it dynamically
      if (!this.aiService && !this.mockMode) {
        try {
          // Import the default export which is already an aiService instance
          this.aiService = (await import('../ai/AIService.js')).default;
          // Update executor with aiService - recreate or update existing
          if (this.executor && typeof this.executor.updateAiService === 'function') {
            this.executor.updateAiService(this.aiService);
          } else {
            this.executor = new AgentExecutor(this.agentLoader, this.aiService);
          }
        } catch (error) {
          logger.warn('Could not load AIService during initialization, some features may be limited:', error.message);
        }
      }
      
      await this.agentLoader.loadAllAgents();
      await this.artifactManager.initialize();
      
      // Rehydrate active workflows from database
      const activeWorkflows = await this.databaseService.rehydrateState();
      for (const dbWorkflow of activeWorkflows) {
        this.activeWorkflows.set(dbWorkflow._id.toString(), {
          id: dbWorkflow._id.toString(),
          name: dbWorkflow.title,
          description: dbWorkflow.description,
          sequence: dbWorkflow.bmadWorkflowData?.sequence || [],
          userPrompt: dbWorkflow.prompt,
          status: dbWorkflow.status,
          currentStep: dbWorkflow.progress?.currentStep || 0,
          currentAgent: null,
          startTime: dbWorkflow.metadata?.startTime,
          endTime: null,
          context: { initiatedBy: dbWorkflow.userId },
          artifacts: [],
          messages: [],
          errors: [],
          metadata: dbWorkflow.metadata,
          checkpointEnabled: this.checkpointEnabled,
          elicitationDetails: dbWorkflow.elicitationDetails
        });
      }
    } catch (error) {
      logger.error('Failed to initialize Workflow Engine:', error);
      throw error;
    }
  }

  // ============================================================================
  // WORKFLOW LIFECYCLE METHODS - DELEGATE TO SINGLE SOURCE OF TRUTH
  // ============================================================================

  async startWorkflow(config) {
    return this.lifecycleManager.startWorkflow(config);
  }

  async startDynamicWorkflow(config) {
    return this.lifecycleManager.startDynamicWorkflow(config);
  }

  async completeWorkflow(workflowId) {
    return this.lifecycleManager.completeWorkflow(workflowId);
  }

  async pauseWorkflow(workflowId) {
    return this.lifecycleManager.pauseWorkflow(workflowId);
  }

  async resumeWorkflow(workflowId) {
    return this.lifecycleManager.resumeWorkflow(workflowId);
  }

  async cancelWorkflow(workflowId) {
    return this.lifecycleManager.cancelWorkflow(workflowId);
  }

  // ============================================================================
  // STEP EXECUTION METHODS - DELEGATE TO SINGLE SOURCE OF TRUTH
  // ============================================================================

  async executeNextStep(workflowId) {
    return this.stepExecutor.executeNextStep(workflowId);
  }

  async executeAgent(workflowId, agentId, context) {
    return this.stepExecutor.executeAgentUnified(workflowId, agentId, context);
  }

  async handleAgentCompletion(workflowId, agentId, executionResult) {
    return this.stepExecutor.handleAgentCompletion(workflowId, agentId, executionResult);
  }

  async handleCriticalFailure(workflowId, error) {
    return this.stepExecutor.handleCriticalFailure(workflowId, error);
  }

  // ============================================================================
  // STATE MANAGEMENT METHODS - DELEGATE TO SINGLE SOURCE OF TRUTH
  // ============================================================================

  async getWorkflowStatus(workflowId) {
    return this.stateManager.getWorkflowStatus(workflowId);
  }

  getActiveWorkflows() {
    return this.stateManager.getActiveWorkflows();
  }

  getExecutionHistory(limit = 50) {
    return this.stateManager.getExecutionHistory(limit);
  }

  async getWorkflowArtifacts(workflowId) {
    return this.stateManager.getWorkflowArtifacts(workflowId);
  }

  async getWorkflowCheckpoints(workflowId) {
    return this.stateManager.getWorkflowCheckpoints(workflowId);
  }

  async resumeFromRollback(workflowId) {
    return this.stateManager.resumeFromRollback(workflowId);
  }

  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId) {
    return this.stateManager.resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId);
  }

  // ============================================================================
  // UTILITY METHODS - Kept in main engine for consistency
  // ============================================================================

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
      metadata: workflow.metadata,
      // Include step action and command for template determination
      action: step.action,
      command: step.command || step.uses,
      stepNotes: step.notes
    };
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Legacy method for backward compatibility
  getWorkflowSequence(sequenceName) {
    return WorkflowSequences[sequenceName] || this.agentLoader.getDefaultWorkflowSequence();
  }

  // Cleanup method
  async cleanup(olderThanHours = 24) {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    for (const [workflowId, workflow] of this.executionHistory) {
      if (workflow.endTime && workflow.endTime < cutoffTime) {
        this.executionHistory.delete(workflowId);
        this.checkpointManager.workflowCheckpoints.delete(workflowId);
      }
    }

    await this.databaseService.cleanupCheckpoints();
  }
}

module.exports = { WorkflowEngine };