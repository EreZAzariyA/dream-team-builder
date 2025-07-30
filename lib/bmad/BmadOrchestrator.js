/**
 * BMAD Orchestrator - Main coordination system
 * Integrates with existing Redux store and provides API for workflow management
 */

import { WorkflowEngine } from './WorkflowEngine.js';
import { AgentLoader } from './AgentLoader.js';
import { AgentCommunicator } from './AgentCommunicator.js';
import { WorkflowStatus, AgentStatus, WorkflowSequences } from './types.js';

export class BmadOrchestrator {
  constructor(store = null) {
    this.store = store; // Redux store for integration
    this.workflowEngine = new WorkflowEngine();
    this.agentLoader = new AgentLoader();
    this.communicator = new AgentCommunicator();
    this.initialized = false;
    this.eventSubscriptions = new Map();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the BMAD orchestrator system
   */
  async initialize() {
    try {
      console.log('Initializing BMAD Orchestrator...');
      
      // Initialize workflow engine
      await this.workflowEngine.initialize();
      
      // Load all agents
      await this.agentLoader.loadAllAgents();
      
      // Setup communication handlers
      this.setupCommunicationHandlers();
      
      this.initialized = true;
      console.log('BMAD Orchestrator initialized successfully');
      
      // Dispatch initialization to Redux store if available
      if (this.store) {
        this.store.dispatch({
          type: 'bmad/initialized',
          payload: {
            agents: this.agentLoader.getAllAgentsMetadata(),
            sequences: Object.keys(WorkflowSequences)
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize BMAD Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Start a new workflow from user prompt
   */
  async startWorkflow(userPrompt, options = {}) {
    if (!this.initialized) {
      throw new Error('BMAD Orchestrator not initialized');
    }

    try {
      // Validate user prompt
      if (!userPrompt || userPrompt.trim().length < 10) {
        throw new Error('User prompt must be at least 10 characters long');
      }

      // Prepare workflow configuration
      const workflowConfig = {
        name: options.name || `BMAD Workflow - ${new Date().toISOString()}`,
        description: options.description || 'Automated BMAD workflow execution',
        userPrompt: userPrompt.trim(),
        sequence: options.sequence || WorkflowSequences.FULL_STACK,
        context: {
          initiatedBy: options.userId || 'system',
          priority: options.priority || 'normal',
          tags: options.tags || [],
          ...options.context
        },
        metadata: {
          source: 'user_prompt',
          version: '1.0',
          ...options.metadata
        }
      };

      // Start workflow execution
      const result = await this.workflowEngine.startWorkflow(workflowConfig);
      
      // Update Redux store if available
      if (this.store) {
        this.store.dispatch({
          type: 'workflow/started',
          payload: {
            workflowId: result.workflowId,
            config: workflowConfig,
            status: result.status
          }
        });
      }

      return result;

    } catch (error) {
      console.error('Error starting workflow:', error);
      throw error;
    }
  }

  /**
   * Get workflow status and progress
   */
  getWorkflowStatus(workflowId) {
    const status = this.workflowEngine.getWorkflowStatus(workflowId);
    if (!status) return null;

    // Enhance with communication data
    const messages = this.communicator.getMessageHistory(workflowId);
    const timeline = this.communicator.getCommunicationTimeline(workflowId);
    const stats = this.communicator.getStatistics(workflowId);

    return {
      ...status,
      communication: {
        messageCount: messages.length,
        timeline,
        statistics: stats
      },
      agents: this.getWorkflowAgentStatuses(workflowId)
    };
  }

  /**
   * Get agent statuses for a specific workflow
   */
  getWorkflowAgentStatuses(workflowId) {
    const channels = this.communicator.getActiveChannels(workflowId);
    const agentStatuses = {};

    channels.forEach(channel => {
      const agentMetadata = this.agentLoader.getAgentMetadata(channel.agentId);
      agentStatuses[channel.agentId] = {
        ...agentMetadata,
        workflowStatus: channel.status,
        startTime: channel.startTime,
        endTime: channel.endTime,
        error: channel.error
      };
    });

    return agentStatuses;
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(workflowId) {
    try {
      const result = await this.workflowEngine.pauseWorkflow(workflowId);
      
      if (this.store) {
        this.store.dispatch({
          type: 'workflow/paused',
          payload: { workflowId, status: result.status }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error pausing workflow:', error);
      throw error;
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(workflowId) {
    try {
      const result = await this.workflowEngine.resumeWorkflow(workflowId);
      
      if (this.store) {
        this.store.dispatch({
          type: 'workflow/resumed',
          payload: { workflowId, status: result.status }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(workflowId) {
    try {
      const result = await this.workflowEngine.cancelWorkflow(workflowId);
      
      if (this.store) {
        this.store.dispatch({
          type: 'workflow/cancelled',
          payload: { workflowId, status: result.status }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error cancelling workflow:', error);
      throw error;
    }
  }

  /**
   * Get all available agents
   */
  getAvailableAgents() {
    return this.agentLoader.getAllAgentsMetadata();
  }

  /**
   * Get all available workflow sequences
   */
  getWorkflowSequences() {
    return WorkflowSequences;
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows() {
    const workflows = this.workflowEngine.getActiveWorkflows();
    return workflows.map(workflow => ({
      ...workflow,
      communication: this.communicator.getStatistics(workflow.id)
    }));
  }

  /**
   * Get workflow execution history
   */
  getExecutionHistory(limit = 50) {
    return this.workflowEngine.getExecutionHistory(limit);
  }

  /**
   * Subscribe to workflow events for real-time updates
   */
  subscribeToWorkflow(workflowId, callbacks) {
    const unsubscribeFn = this.communicator.subscribeToWorkflow(workflowId, {
      'message': (data) => {
        callbacks.onMessage?.(data);
        this.dispatchToStore('workflow/message', data);
      },
      'agent:activated': (data) => {
        callbacks.onAgentActivated?.(data);
        this.dispatchToStore('agent/activated', data);
      },
      'agent:completed': (data) => {
        callbacks.onAgentCompleted?.(data);
        this.dispatchToStore('agent/completed', data);
      },
      'agent:communication': (data) => {
        callbacks.onAgentCommunication?.(data);
        this.dispatchToStore('agent/communication', data);
      },
      'workflow:error': (data) => {
        callbacks.onError?.(data);
        this.dispatchToStore('workflow/error', data);
      }
    });

    this.eventSubscriptions.set(workflowId, unsubscribeFn);
    return unsubscribeFn;
  }

  /**
   * Unsubscribe from workflow events
   */
  unsubscribeFromWorkflow(workflowId) {
    const unsubscribeFn = this.eventSubscriptions.get(workflowId);
    if (unsubscribeFn) {
      unsubscribeFn();
      this.eventSubscriptions.delete(workflowId);
    }
  }

  /**
   * Create custom workflow sequence
   */
  createCustomSequence(name, steps) {
    // Validate steps
    const validation = this.agentLoader.validateWorkflowSequence(steps);
    if (!validation.valid) {
      throw new Error(`Invalid workflow sequence: ${validation.errors.join(', ')}`);
    }

    return {
      name,
      steps,
      id: `custom_${Date.now()}`,
      created: new Date()
    };
  }

  /**
   * Get workflow artifacts (includes saved files)
   */
  async getWorkflowArtifacts(workflowId) {
    return await this.workflowEngine.getWorkflowArtifacts(workflowId);
  }

  /**
   * Setup event handlers for internal coordination
   */
  setupEventHandlers() {
    // Handle workflow completion
    this.workflowEngine.communicator.on('workflow:complete', (data) => {
      this.dispatchToStore('workflow/completed', data);
    });

    // Handle agent status changes
    this.communicator.on('agent:activated', (data) => {
      this.dispatchToStore('agent/statusChanged', {
        agentId: data.agentId,
        status: AgentStatus.ACTIVE,
        workflowId: data.workflowId
      });
    });

    this.communicator.on('agent:completed', (data) => {
      this.dispatchToStore('agent/statusChanged', {
        agentId: data.agentId,
        status: AgentStatus.COMPLETED,
        workflowId: data.workflowId
      });
    });
  }

  /**
   * Setup communication handlers
   */
  setupCommunicationHandlers() {
    // Enhanced message handling for workflow coordination
    this.communicator.on('message', (message) => {
      console.log(`[BMAD] ${message.type}: ${message.from} → ${message.to}`);
    });
  }

  /**
   * Dispatch action to Redux store if available
   */
  dispatchToStore(type, payload) {
    if (this.store) {
      this.store.dispatch({ type, payload });
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth() {
    return {
      initialized: this.initialized,
      agentsLoaded: this.agentLoader.agentCache.size,
      activeWorkflows: this.workflowEngine.activeWorkflows.size,
      totalExecutions: this.workflowEngine.executionHistory.size,
      communicationChannels: this.communicator.activeChannels.size,
      status: this.initialized ? 'healthy' : 'initializing'
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Unsubscribe from all events
    for (const [workflowId, unsubscribeFn] of this.eventSubscriptions) {
      unsubscribeFn();
    }
    this.eventSubscriptions.clear();

    // Cleanup communicator
    this.communicator.cleanup();

    // Cleanup workflow engine
    this.workflowEngine.cleanup();

    // Clear agent cache
    this.agentLoader.clearCache();

    this.initialized = false;
    console.log('BMAD Orchestrator cleanup completed');
  }
}

export default BmadOrchestrator;