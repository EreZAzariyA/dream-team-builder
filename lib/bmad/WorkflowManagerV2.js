/**
 * WORKFLOW MANAGER V2 - REFACTORED
 * 
 * Clean, focused workflow orchestrator that delegates to specialized services
 * Reduced from 1600+ lines to ~200 lines by applying single responsibility principle
 */

import { WorkflowStatus } from './types.js';
import WorkflowParser from './WorkflowParser.js';
import { AgentLoader } from './AgentLoader.js';
import logger from '../utils/logger.js';

// Core services
import WorkflowExecutor from './services/WorkflowExecutor.js';
import WorkflowLifecycleManager from './services/WorkflowLifecycleManager.js';
import UserInteractionService from './services/UserInteractionService.js';
import ArtifactManager from './services/ArtifactManager.js';
import WorkflowStepExecutor from './services/WorkflowStepExecutor.js';

// Core components
import ContextBuilder from './core/ContextBuilder.js';
import ResponseValidator from './core/ResponseValidator.js';
import ErrorRecoveryManager from './core/ErrorRecoveryManager.js';

class WorkflowManagerV2 {
  constructor(options = {}) {
    // Core parsers and loaders
    this.workflowParser = new WorkflowParser();
    this.agentLoader = new AgentLoader();
    
    // Core components
    this.contextBuilder = new ContextBuilder(options.contextBuilder);
    this.responseValidator = new ResponseValidator(options.responseValidator);
    this.errorRecoveryManager = new ErrorRecoveryManager(options.errorRecovery);
    
    // External services
    this.aiService = options.aiService;
    this.pusherService = options.pusherService;
    
    // Specialized service classes
    this.lifecycleManager = new WorkflowLifecycleManager(this.pusherService);
    this.userInteractionService = new UserInteractionService(this.pusherService, options.messageService);
    this.artifactManager = new ArtifactManager(options.gitService);
    
    // Step executor (handles different step types)
    this.stepExecutor = new WorkflowStepExecutor({
      agentLoader: this.agentLoader,
      contextBuilder: this.contextBuilder,
      responseValidator: this.responseValidator,
      errorRecoveryManager: this.errorRecoveryManager,
      aiService: this.aiService,
      userInteractionService: this.userInteractionService,
      artifactManager: this.artifactManager,
      lifecycleManager: this.lifecycleManager
    });
    
    // Workflow executor (main execution logic)
    this.workflowExecutor = new WorkflowExecutor(
      this.stepExecutor,
      this.lifecycleManager,
      this.userInteractionService
    );
  }

  async initialize() {
    logger.info('✅ WorkflowManager V2 initialized with specialized services');
  }

  /**
   * Start a workflow - main entry point
   */
  async startWorkflow(userPrompt, options = {}) {
    try {
      // Input validation
      if (!userPrompt || userPrompt.trim().length < 10) {
        throw new Error('User prompt must be at least 10 characters long');
      }

      const workflowTemplate = options.sequence || 'greenfield-fullstack';
      
      // Parse workflow template
      const isDynamicWorkflow = await this.workflowParser.workflowExists(workflowTemplate);
      if (!isDynamicWorkflow) {
        throw new Error(`Workflow template "${workflowTemplate}" not found`);
      }

      const dynamicWorkflow = await this.workflowParser.parseWorkflowFile(workflowTemplate);
      await this.workflowParser.resolveReferences(dynamicWorkflow);

      if (!dynamicWorkflow.steps || dynamicWorkflow.steps.length === 0) {
        throw new Error(`Workflow ${workflowTemplate} has no executable steps`);
      }

      // Create workflow instance
      const workflowId = options.workflowId || this.generateWorkflowId();
      const workflow = this.createWorkflowInstance(workflowId, dynamicWorkflow, userPrompt, options);

      // Save initial workflow
      await this.lifecycleManager.saveWorkflow(workflow);
      logger.info(`🚀 Workflow created: ${workflowId} with ${dynamicWorkflow.steps.length} steps`);

      // Start async execution
      this.startAsyncExecution(workflowId);

      // Send startup notification
      await this.sendWorkflowStartedEvent(workflowId, workflowTemplate);

      return {
        workflowId: workflowId,
        status: WorkflowStatus.RUNNING,
        steps: dynamicWorkflow.steps.length,
        template: workflowTemplate
      };

    } catch (error) {
      logger.error(`❌ Failed to start workflow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute workflow (delegates to WorkflowExecutor)
   */
  async executeWorkflow(workflowId) {
    try {
      return await this.workflowExecutor.executeWorkflow(workflowId);
    } catch (error) {
      // Enhanced error recovery
      const recoveryResult = await this.handleWorkflowError(error, workflowId);
      if (recoveryResult.success) {
        return await this.workflowExecutor.executeWorkflow(workflowId);
      }
      throw error;
    }
  }

  // ===== LIFECYCLE MANAGEMENT (Delegated) =====
  
  async getWorkflowStatus(workflowId) {
    return await this.lifecycleManager.getWorkflowStatus(workflowId);
  }

  async pauseWorkflow(workflowId) {
    return await this.lifecycleManager.pauseWorkflow(workflowId);
  }

  async resumeWorkflow(workflowId) {
    const workflow = await this.lifecycleManager.resumeWorkflow(workflowId);
    // Resume execution
    setImmediate(() => this.executeWorkflow(workflowId).catch(error => {
      logger.error(`❌ Error resuming workflow: ${error.message}`);
    }));
    return workflow;
  }

  async cancelWorkflow(workflowId) {
    return await this.lifecycleManager.cancelWorkflow(workflowId);
  }

  async completeWorkflow(workflowId) {
    return await this.lifecycleManager.completeWorkflow(workflowId);
  }

  // ===== ARTIFACT MANAGEMENT (Delegated) =====

  async getWorkflowArtifacts(workflowId) {
    return await this.artifactManager.getWorkflowArtifacts(workflowId, this.lifecycleManager);
  }

  async getArtifact(workflowId, artifactName) {
    return await this.artifactManager.getArtifact(workflowId, artifactName, this.lifecycleManager);
  }

  // ===== USER INTERACTION (Delegated) =====

  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentName, userId = null) {
    return await this.userInteractionService.resumeWorkflowWithElicitation(
      workflowId, elicitationResponse, agentName, userId
    );
  }

  // ===== PRIVATE HELPER METHODS =====

  createWorkflowInstance(workflowId, dynamicWorkflow, userPrompt, options) {
    return {
      id: workflowId,
      workflowId: workflowId,
      name: dynamicWorkflow.name || options.name || `${options.sequence || 'workflow'} Workflow`,
      title: dynamicWorkflow.name || options.name || `${options.sequence || 'workflow'} Workflow`,
      description: dynamicWorkflow.description || options.description || 'AI-powered workflow execution',
      template: options.sequence || 'greenfield-fullstack',
      prompt: userPrompt.trim(),
      userPrompt: userPrompt.trim(),
      userId: options.userId,
      status: WorkflowStatus.RUNNING,
      bmadWorkflowData: { 
        sequence: dynamicWorkflow.steps, 
        currentStep: 0 
      },
      
      currentAgent: null,
      startTime: new Date(),
      context: {
        initiatedBy: options.userId || 'system',
        priority: options.priority || 'normal',
        tags: options.tags || [options.sequence || 'workflow'],
        artifacts: new Map(),
        routingDecisions: {},
        elicitationHistory: [],
        ...(options.githubContext && {
          githubContext: options.githubContext,
          repositoryUrl: options.githubContext.repository?.html_url
        }),
        ...(options.repositoryAnalysis && {
          repositoryAnalysis: options.repositoryAnalysis
        })
      },
      metadata: {
        version: '2.0',
        createdWith: 'WorkflowManager V2'
      },
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  startAsyncExecution(workflowId) {
    const executeAsync = async () => {
      try {
        logger.info(`🚀 Starting async execution for workflow: ${workflowId}`);
        await this.executeWorkflow(workflowId);
      } catch (error) {
        await this.handleWorkflowError(error, workflowId);
      }
    };
    
    setImmediate(() => executeAsync());
  }

  async sendWorkflowStartedEvent(workflowId, workflowTemplate) {
    if (this.pusherService) {
      try {
        const { WorkflowId } = await import('../utils/workflowId.js');
        const channelName = WorkflowId.toChannelName(workflowId);
        
        await this.pusherService.trigger(channelName, 'workflow-started', {
          workflowId: workflowId,
          template: workflowTemplate,
          status: WorkflowStatus.RUNNING
        });
      } catch (error) {
        logger.warn('Failed to send workflow started event:', error.message);
      }
    }
  }

  async handleWorkflowError(error, workflowId) {
    logger.error(`❌ Workflow error: ${error.message}`);
    
    try {
      const workflow = await this.lifecycleManager.loadWorkflow(workflowId);
      const recoveryContext = {
        workflowId,
        workflow,
        error,
        retryCallback: () => this.executeWorkflow(workflowId)
      };
      
      const recoveryResult = await this.errorRecoveryManager.handleError(error, recoveryContext);
      
      if (recoveryResult.success) {
        logger.info(`✅ [ERROR-RECOVERY] Successfully recovered from workflow error`);
        return recoveryResult;
      } else {
        // Mark workflow as error
        workflow.status = WorkflowStatus.ERROR;
        workflow.errors.push({
          error: error.message,
          timestamp: new Date(),
          step: workflow.bmadWorkflowData?.currentStep,
          recoveryAttempted: true
        });
        await this.lifecycleManager.saveWorkflow(workflow);
        return { success: false };
      }
      
    } catch (recoveryError) {
      logger.error(`❌ [ERROR-RECOVERY] Recovery attempt failed: ${recoveryError.message}`);
      return { success: false };
    }
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ===== COMPATIBILITY METHODS (for BmadOrchestrator) =====
  
  getActiveWorkflows() {
    return []; // Placeholder for compatibility
  }

  async getWorkflowCheckpoints(workflowId) {
    return []; // Placeholder - integrate with CheckpointManager if needed
  }

  async resumeFromRollback(workflowId) {
    return await this.resumeWorkflow(workflowId);
  }

  getExecutionHistory(limit = 100) {
    return []; // Placeholder for compatibility
  }

  get activeWorkflows() {
    return new Map(); // Placeholder for compatibility
  }

  get executionHistory() {
    return new Map(); // Placeholder for compatibility
  }

  updateAiService(aiService) {
    this.aiService = aiService;
    // Update all child services
    if (this.stepExecutor) {
      this.stepExecutor.aiService = aiService;
    }
  }

  cleanup() {
    // Cleanup method for compatibility
    logger.info('🧹 WorkflowManagerV2 cleanup completed');
  }

  // ===== STATISTICS AND MONITORING =====

  getErrorRecoveryStats() {
    return this.errorRecoveryManager.getErrorStats();
  }

  async getWorkflowStats(workflowId) {
    const workflow = await this.lifecycleManager.loadWorkflow(workflowId);
    if (!workflow) return null;

    const artifacts = workflow.context?.artifacts || new Map();
    const artifactStats = this.artifactManager.getArtifactStats(artifacts);
    
    return {
      workflowId,
      status: workflow.status,
      currentStep: workflow.bmadWorkflowData?.currentStep || 0,
      totalSteps: workflow.bmadWorkflowData?.sequence?.length || 0,
      progress: Math.round(((workflow.bmadWorkflowData?.currentStep || 0) / (workflow.bmadWorkflowData?.sequence?.length || 1)) * 100),
      artifacts: artifactStats,
      errors: workflow.errors?.length || 0,
      duration: workflow.completedAt ? 
        workflow.completedAt.getTime() - workflow.createdAt.getTime() : 
        Date.now() - workflow.createdAt.getTime()
    };
  }
}

export default WorkflowManagerV2;