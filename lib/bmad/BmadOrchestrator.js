/**
 * BMAD Orchestrator - Main coordination system
 * Integrates with existing Redux store and provides API for workflow management
 */

const { WorkflowEngine } = require('./WorkflowEngine.js');
const { AgentLoader } = require('./AgentLoader.js');
const { AgentCommunicator } = require('./AgentCommunicator.js');
const { WorkflowStatus, AgentStatus, WorkflowSequences } = require('./types.js');

// Import Pusher for real-time events (only in server environment)
let pusherServer = null;
try {
  if (typeof window === 'undefined') {
    const { pusherServer: pusher } = require('../pusher/config.js');
    pusherServer = pusher;
  }
} catch (error) {
  console.warn('Pusher server not available:', error.message);
}

class BmadOrchestrator {
  constructor(store = null) {
    this.store = store; // Redux store for integration
    this.agentLoader = new AgentLoader();
    this.communicator = new AgentCommunicator();
    this.workflowEngine = new WorkflowEngine({ communicator: this.communicator });
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
      const selectedSequence = options.sequence && WorkflowSequences[options.sequence]
        ? WorkflowSequences[options.sequence]
        : WorkflowSequences.FULL_STACK;

      // Validate selected sequence
      const validation = await this.agentLoader.validateWorkflowSequence(selectedSequence);
      if (!validation.valid) {
        throw new Error(`Invalid workflow sequence: ${validation.errors.join(', ')}`);
      }

      const workflowConfig = {
        name: options.name || `BMAD Workflow - ${new Date().toISOString()}`,
        description: options.description || 'Automated BMAD workflow execution',
        userPrompt: userPrompt.trim(),
        sequence: selectedSequence,
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
        },
        workflowId: options.workflowId // Ensure workflowId is passed to WorkflowEngine
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
   * Get workflow checkpoints
   */
  async getWorkflowCheckpoints(workflowId) {
    return await this.workflowEngine.getWorkflowCheckpoints(workflowId);
  }

  /**
   * Rollback workflow to checkpoint
   */
  async rollbackToCheckpoint(workflowId, checkpointId) {
    if (!this.initialized) {
      throw new Error('BMAD Orchestrator not initialized');
    }

    const result = await this.workflowEngine.rollbackToCheckpoint(workflowId, checkpointId);
    
    // Dispatch rollback event to Redux store if available
    if (this.store) {
      this.store.dispatch({
        type: 'workflow/rolledBack',
        payload: result
      });
    }

    return result;
  }

  /**
   * Resume workflow from rollback
   */
  async resumeFromRollback(workflowId) {
    if (!this.initialized) {
      throw new Error('BMAD Orchestrator not initialized');
    }

    const result = await this.workflowEngine.resumeFromRollback(workflowId);
    
    // Dispatch resume event to Redux store if available
    if (this.store) {
      this.store.dispatch({
        type: 'workflow/resumedFromRollback',
        payload: result
      });
    }

    return result;
  }

  /**
   * Setup event handlers for internal coordination
   */
  setupEventHandlers() {
    // Handle workflow completion
    this.communicator.on('workflow:complete', (data) => {
      this.dispatchToStore('workflow/completed', data);
      this.triggerPusherEvent(data.workflowId, 'workflow-update', {
        status: 'completed',
        message: 'Workflow completed successfully'
      });
    });

    // Handle agent status changes
    this.communicator.on('agent:activated', (data) => {
      this.dispatchToStore('agent/statusChanged', {
        agentId: data.agentId,
        status: AgentStatus.ACTIVE,
        workflowId: data.workflowId
      });
      this.triggerPusherEvent(data.workflowId, 'agent-activated', {
        agentId: data.agentId,
        status: 'active',
        message: `Agent ${data.agentId} is now active`
      });
    });

    this.communicator.on('agent:completed', (data) => {
      this.dispatchToStore('agent/statusChanged', {
        agentId: data.agentId,
        status: AgentStatus.COMPLETED,
        workflowId: data.workflowId
      });
      this.triggerPusherEvent(data.workflowId, 'agent-completed', {
        agentId: data.agentId,
        status: 'completed',
        message: `Agent ${data.agentId} completed successfully`
      });
    });

    // Handle inter-agent communication and all message types
    this.communicator.on('message', (message) => {
      console.log(`[BMAD] ${message.type}: ${message.from} → ${message.to}`);
      if (message.workflowId) {
        // Send specific event based on message type
        if (message.type === 'activation') {
          this.triggerPusherEvent(message.workflowId, 'agent-activated', {
            agentId: message.to,
            status: 'active',
            message: `Agent ${message.to} activated`,
            timestamp: new Date().toISOString()
          });
        } else if (message.type === 'completion') {
          this.triggerPusherEvent(message.workflowId, 'agent-completed', {
            agentId: message.from,
            status: 'completed',
            message: `Agent ${message.from} completed successfully`,
            timestamp: new Date().toISOString()
          });
        }
        
        // Always send workflow message for live communication feed
        this.triggerPusherEvent(message.workflowId, 'workflow-message', {
          message: {
            id: message.id || `msg_${Date.now()}`,
            from: message.from,
            to: message.to,
            summary: this.generateMessageSummary(message),
            content: message.content, // Add full content
            timestamp: new Date().toISOString()
          }
        });
        
        // Send agent communication event for inter-agent messages
        if (message.type === 'inter_agent') {
          this.triggerPusherEvent(message.workflowId, 'agent-communication', {
            from: message.from,
            to: message.to,
            content: message.content, // Add full content
            summary: message.content?.summary || 'Agent communication', // Keep summary for display
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  }

  /**
   * Generate human-readable message summary
   */
  generateMessageSummary(message) {
    switch (message.type) {
      case 'activation':
        return `Activating ${message.to} agent`;
      case 'completion':
        return `${message.from} completed task`;
      case 'error':
        return `Error in ${message.from}: ${message.content?.error || 'Unknown error'}`;
      case 'inter_agent':
        return `${message.from} → ${message.to}: ${message.content?.summary || 'Communication'}`;
      case 'workflow_complete':
        return 'Workflow completed successfully';
      default:
        return `${message.type} message from ${message.from} to ${message.to}`;
    }
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
   * Trigger Pusher event for real-time updates
   */
  async triggerPusherEvent(workflowId, eventType, data) {
    if (!pusherServer || !workflowId) return;

    try {
      const channelName = `workflow-${workflowId}`;
      const eventData = {
        workflowId,
        timestamp: new Date().toISOString(),
        ...data
      };

      console.log(`[Pusher Server] Triggering event on channel: ${channelName}, event: ${eventType}`);
      await pusherServer.trigger(channelName, eventType, eventData);
      console.log(`🔔 Pusher event sent: ${channelName} -> ${eventType}`);
    } catch (error) {
      console.error('Failed to trigger Pusher event:', error);
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

module.exports = BmadOrchestrator;