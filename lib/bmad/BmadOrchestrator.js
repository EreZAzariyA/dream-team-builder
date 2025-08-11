/**
 * BMAD Orchestrator - Refactored Clean Version
 * High-level orchestration layer that coordinates workflow execution with UI/external systems
 * 
 * PRINCIPLES:
 * - Single Responsibility: Focuses on coordination, not implementation
 * - Minimal Abstractions: Delegates to WorkflowEngine for all workflow logic
 * - Clear Separation: Handles orchestration concerns (events, store, communication)
 */

const { AgentActivationEngine } = require('./core/AgentActivationEngine.js');
const { AgentLoader } = require('./AgentLoader.js');
const { AgentCommunicator } = require('./AgentCommunicator.js');
const { MessageService } = require('./MessageService.js').default;
const { WorkflowSequences } = require('./types.js');
const { PusherService } = require('./orchestration/PusherService.js');
const { StoreService } = require('./orchestration/StoreService.js');
const { EventHandler } = require('./orchestration/EventHandler.js');
const { ConfigurationManager } = require('./core/ConfigurationManager.js');
const { TemplateProcessor } = require('./TemplateProcessor.js');
const { ArtifactManager } = require('./ArtifactManager.js');
const { ElicitationHandler } = require('./ElicitationHandler.js');
const { ShardingManager } = require('./ShardingManager.js');
const { ChecklistManager } = require('./ChecklistManager.js');
const { WorkflowEngine } = require('./WorkflowEngine.js');
import logger from '../utils/logger.js';

class BmadOrchestrator {
  constructor(store = null, options = {}) {
    // Orchestration dependencies - these handle external concerns
    this.agentLoader = new AgentLoader();
    this.agentActivationEngine = new AgentActivationEngine();
    this.communicator = new AgentCommunicator();
    this.messageService = new MessageService(options.messageService);
    this.pusherService = new PusherService();
    this.storeService = new StoreService(store);
    this.eventHandler = new EventHandler(this.communicator, this.storeService, this.pusherService);

    this.configurationManager = new ConfigurationManager();
    this.templateProcessor = new TemplateProcessor(this.configurationManager, this.agentLoader);
    this.artifactManager = new ArtifactManager();
    this.elicitationHandler = new ElicitationHandler(this.configurationManager);
    this.shardingManager = new ShardingManager(this.configurationManager);
    this.checklistManager = new ChecklistManager(this.configurationManager);

    this.mockMode = options.mockMode === true || process.env.BMAD_MOCK_MODE === 'true';
    this.aiService = options.aiService;
    
    // Core workflow engine - handles all workflow logic
    this.workflowEngine = new WorkflowEngine({ 
      communicator: this.communicator,
      messageService: this.messageService,
      mockMode: this.mockMode,
      aiService: this.aiService,
      configurationManager: this.configurationManager,
      templateProcessor: this.templateProcessor,
      artifactManager: this.artifactManager,
      elicitationHandler: this.elicitationHandler,
      shardingManager: this.shardingManager,
      checklistManager: this.checklistManager
    });
    
    this.initialized = false;
    this.eventSubscriptions = new Map();
    
    this.eventHandler.setup();
  }

  async initialize() {
    try {
      const modeText = this.mockMode ? ' (MOCK MODE)' : '';
      logger.info(`Initializing BMAD Orchestrator${modeText}...`);
      
      // Initialize core engine and load agents
      await this.workflowEngine.initialize();
      await this.configurationManager.loadConfiguration();
      await this.agentLoader.loadAllAgents();
      await this.artifactManager.initialize(this.configurationManager, this.agentLoader);
      
      this.initialized = true;
      logger.info(`BMAD Orchestrator initialized successfully${modeText}`);
      
      // Dispatch initialization event to store
      this.storeService.dispatch('bmad/initialized', {
        agents: this.agentLoader.getAllAgentsMetadata(),
        sequences: Object.keys(WorkflowSequences)
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize BMAD Orchestrator:', error);
      throw error;
    }
  }

  async startWorkflow(userPrompt, options = {}) {
    if (!this.initialized) {
      throw new Error('BMAD Orchestrator not initialized');
    }

    try {
      if (!userPrompt || userPrompt.trim().length < 10) {
        throw new Error('User prompt must be at least 10 characters long');
      }

      const requestedSequence = options.sequence || 'greenfield-fullstack';
      const dynamicWorkflowExists = await this.workflowEngine.workflowParser.workflowExists(requestedSequence);
      
      logger.info(`🔍 [BmadOrchestrator] Checking for dynamic workflow: ${requestedSequence} - ${dynamicWorkflowExists ? 'Found' : 'Not found'}`);

      const workflowConfig = {
        workflowId: options.workflowId, // Include workflowId in config
        userId: options.userId, // Include userId in config
        name: options.name || `BMAD Workflow - ${new Date().toISOString()}`,
        description: options.description || 'Automated BMAD workflow execution',
        userPrompt: userPrompt.trim(),
        sequence: requestedSequence,
        context: {
          initiatedBy: options.userId || 'system',
          priority: options.priority || 'normal',
          tags: options.tags || [],
          ...options.context
        },
        metadata: {
          source: 'user_prompt',
          version: '1.0',
          workflowType: dynamicWorkflowExists ? 'dynamic' : 'legacy',
          ...options.metadata
        },
      };

      let result;
      
      if (dynamicWorkflowExists) {
        logger.info(`🚀 [BmadOrchestrator] Starting dynamic workflow: ${requestedSequence}`);
        result = await this.workflowEngine.startDynamicWorkflow(workflowConfig, options.userId);
      } else {
        logger.info(`📋 [BmadOrchestrator] Starting legacy workflow: ${requestedSequence}`);
        
        const selectedSequence = WorkflowSequences[requestedSequence] || WorkflowSequences['greenfield-fullstack'];
        
        const validation = await this.agentLoader.validateWorkflowSequence(selectedSequence);
        if (!validation.valid) {
          throw new Error(`Invalid workflow sequence: ${validation.errors.join(', ')}`);
        }

        workflowConfig.sequence = selectedSequence;
        result = await this.workflowEngine.startWorkflow(workflowConfig, options?.userId);
      }
      
      // Dispatch orchestration event
      this.storeService.dispatch('workflow/started', {
        workflowId: result.workflowId,
        config: workflowConfig,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('Error starting workflow:', error);
      throw error;
    }
  }

  // Enhanced workflow status with orchestration data
  async getWorkflowStatus(workflowId) {
    const status = await this.workflowEngine.getWorkflowStatus(workflowId);
    if (!status) return null;

    // Get messages from AgentCommunicator which is where workflow execution actually stores them
    const messages = this.communicator.getMessageHistory(workflowId) || [];
    const communicationStats = this.communicator.getStatistics(workflowId);

    // Also try to get messages from MessageService as backup
    try {
      await this.messageService.initializeWorkflow(workflowId);
      const messageServiceMessages = this.messageService.getMessageHistory(workflowId);
      const messageServiceStats = this.messageService.getStatistics(workflowId);
      
      // Merge messages from both sources (prefer AgentCommunicator as it's more up-to-date during execution)
      const allMessages = [...messages];
      if (messageServiceMessages.length > 0) {
        // Add any additional messages from MessageService that aren't in AgentCommunicator
        messageServiceMessages.forEach(msg => {
          const exists = allMessages.some(existing => existing.id === msg.id || 
            (existing.timestamp === msg.timestamp && existing.content === msg.content));
          if (!exists) {
            allMessages.push(msg);
          }
        });
      }

      return {
        ...status,
        communication: {
          messageCount: allMessages.length,
          timeline: allMessages.map(msg => ({
            id: msg.id,
            from: msg.from,
            to: msg.to,
            type: msg.type,
            timestamp: msg.timestamp,
            content: msg.content || msg.summary || ''
          })),
          statistics: {
            totalMessages: allMessages.length,
            agentCommunicatorMessages: messages.length,
            messageServiceMessages: messageServiceMessages.length,
            ...communicationStats
          }
        },
        agents: this.getWorkflowAgentStatuses(workflowId)
      };
    } catch (error) {
      logger.warn('Error getting MessageService data, using AgentCommunicator only:', error.message);
      
      return {
        ...status,
        communication: {
          messageCount: messages.length,
          timeline: messages.map(msg => ({
            id: msg.id,
            from: msg.from,
            to: msg.to,
            type: msg.type,
            timestamp: msg.timestamp,
            content: msg.content || msg.summary || ''
          })),
          statistics: {
            totalMessages: messages.length,
            source: 'AgentCommunicator',
            ...communicationStats
          }
        },
        agents: this.getWorkflowAgentStatuses(workflowId)
      };
    }
  }

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

  // Workflow Control Methods - Delegate to WorkflowEngine with Store Events
  async pauseWorkflow(workflowId) {
    try {
      const result = await this.workflowEngine.pauseWorkflow(workflowId);
      this.storeService.dispatch('workflow/paused', { workflowId, status: result.status });
      return result;
    } catch (error) {
      logger.error('Error pausing workflow:', error);
      throw error;
    }
  }

  async resumeWorkflow(workflowId) {
    try {
      const result = await this.workflowEngine.resumeWorkflow(workflowId);
      this.storeService.dispatch('workflow/resumed', { workflowId, status: result.status });
      return result;
    } catch (error) {
      logger.error('Error resuming workflow:', error);
      throw error;
    }
  }

  // FIXED: Added missing workflowId parameter and userId for AI service initialization
  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId, userId = null) {
    try {
      logger.info(`🔄 Resuming workflow ${workflowId} with elicitation response`);
      await this.configurationManager.loadConfiguration();
      
      // DYNAMIC ELICITATION PROCESSING - supports both 1-9 and free text
      const workflow = this.workflowEngine.activeWorkflows.get(workflowId);
      
      // Process response dynamically based on content
      const processedResponse = await this.elicitationHandler.processResponse(
        elicitationResponse, 
        workflow?.elicitationDetails
      );
      
      logger.info(`🔄 [DYNAMIC] Processing ${processedResponse.mode} response: "${processedResponse.response}"`);
      
      let contextUpdate;
      
      if (processedResponse.mode === 'method_selection') {
        // 1-9 method selection was used
        contextUpdate = {
          elicitationMethod: processedResponse.method,
          userResponse: processedResponse.response,
          elicitationComplete: true,
          responseMode: 'method_selection',
          methodTitle: processedResponse.methodTitle
        };
      } else {
        // Free text was used
        contextUpdate = {
          userResponse: processedResponse.response,
          elicitationComplete: true,
          responseMode: 'free_text',
          // Store response for the specific template section if available
          ...(workflow?.elicitationDetails?.sectionId && {
            [workflow.elicitationDetails.sectionId]: processedResponse.response
          })
        };
      }

      const result = await this.workflowEngine.resumeWorkflowWithElicitation(workflowId, contextUpdate, agentId, userId);
      this.storeService.dispatch('workflow/elicitationResumed', { workflowId, status: result.status, elicitationResponse });
      return result;
    } catch (error) {
      logger.error('Error resuming workflow with elicitation:', error);
      throw error;
    }
  }

  async cancelWorkflow(workflowId) {
    try {
      const result = await this.workflowEngine.cancelWorkflow(workflowId);
      this.storeService.dispatch('workflow/cancelled', { workflowId, status: result.status });
      return result;
    } catch (error) {
      logger.error('Error cancelling workflow:', error);
      throw error;
    }
  }

  // Enhanced active workflows with orchestration data
  getActiveWorkflows() {
    const workflows = this.workflowEngine.getActiveWorkflows();
    return workflows.map(workflow => ({
      ...workflow,
      communication: this.communicator.getStatistics(workflow.id)
    }));
  }

  // Simple delegations - no orchestration enhancement needed
  getExecutionHistory(limit = 50) {
    return this.workflowEngine.getExecutionHistory(limit);
  }

  async getWorkflowArtifacts(workflowId) {
    return await this.workflowEngine.getWorkflowArtifacts(workflowId);
  }

  async getWorkflowCheckpoints(workflowId) {
    return await this.workflowEngine.getWorkflowCheckpoints(workflowId);
  }

  async resumeFromRollback(workflowId) {
    if (!this.initialized) {
      throw new Error('BMAD Orchestrator not initialized');
    }

    const result = await this.workflowEngine.resumeFromRollback(workflowId);
    this.storeService.dispatch('workflow/resumedFromRollback', result);
    return result;
  }

  // Agent and Sequence Information - Direct Access
  getAvailableAgents() {
    return this.agentLoader.getAllAgentsMetadata();
  }

  getWorkflowSequences() {
    return WorkflowSequences;
  }

  // Event Subscription Management - Orchestration Concern
  subscribeToWorkflow(workflowId, callbacks) {
    const unsubscribeFn = this.communicator.subscribeToWorkflow(workflowId, {
      'message': (data) => {
        callbacks.onMessage?.(data);
        this.storeService.dispatch('workflow/message', data);
      },
      'agent:activated': (data) => {
        callbacks.onAgentActivated?.(data);
        this.storeService.dispatch('agent/activated', data);
      },
      'agent:completed': (data) => {
        callbacks.onAgentCompleted?.(data);
        this.storeService.dispatch('agent/completed', data);
      },
      'agent:communication': (data) => {
        callbacks.onAgentCommunication?.(data);
        this.storeService.dispatch('agent/communication', data);
      },
      'workflow:error': (data) => {
        callbacks.onError?.(data);
        this.storeService.dispatch('workflow/error', data);
      }
    });

    this.eventSubscriptions.set(workflowId, unsubscribeFn);
    return unsubscribeFn;
  }

  unsubscribeFromWorkflow(workflowId) {
    const unsubscribeFn = this.eventSubscriptions.get(workflowId);
    if (unsubscribeFn) {
      unsubscribeFn();
      this.eventSubscriptions.delete(workflowId);
    }
  }

  // Utility Methods
  createCustomSequence(name, steps) {
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

  async cleanup() {
    for (const [workflowId, unsubscribeFn] of this.eventSubscriptions) {
      unsubscribeFn();
    }
    this.eventSubscriptions.clear();
    this.communicator.cleanup();
    this.workflowEngine.cleanup();
    this.agentLoader.clearCache();
    this.initialized = false;
    logger.info('BMAD Orchestrator cleanup completed');
  }
}

// Singleton management
let orchestratorInstance = null;

const getOrchestrator = async () => {
  if (!orchestratorInstance) {
    // Dynamically import aiService for server-side usage
    let aiService = null;
    try {
      const AIServiceModule = await import('../ai/AIService.js');
      // Try both default export and named export
      const AIServiceClass = AIServiceModule.default || AIServiceModule.AIService;
      if (AIServiceClass) {
        aiService = AIServiceClass.getInstance ? AIServiceClass.getInstance() : AIServiceClass;
        logger.info('✅ AIService loaded successfully for orchestrator');
      } else {
        throw new Error('AIService class not found in module exports');
      }
    } catch (error) {
      logger.warn('Could not load AIService, running in limited mode:', error.message);
      logger.debug('AIService import error details:', error);
    }
    
    orchestratorInstance = new BmadOrchestrator(null, { aiService });
    await orchestratorInstance.initialize();
  } else {
    // Try to update aiService if it wasn't available during initial creation
    if (!orchestratorInstance.aiService && !orchestratorInstance.mockMode) {
      try {
        const AIServiceModule = await import('../ai/AIService.js');
        const AIServiceClass = AIServiceModule.default || AIServiceModule.AIService;
        if (AIServiceClass) {
          const aiService = AIServiceClass.getInstance ? AIServiceClass.getInstance() : AIServiceClass;
          if (aiService) {
            orchestratorInstance.aiService = aiService;
            orchestratorInstance.workflowEngine.aiService = aiService;
            if (orchestratorInstance.workflowEngine.executor && orchestratorInstance.workflowEngine.executor.updateAiService) {
              orchestratorInstance.workflowEngine.executor.updateAiService(aiService);
            }
            logger.info('✅ AIService updated in existing orchestrator instance');
          }
        }
      } catch (error) {
        logger.debug('Failed to update AIService in existing orchestrator:', error.message);
      }
    }
  }
  return orchestratorInstance;
};

module.exports = { BmadOrchestrator, getOrchestrator };
