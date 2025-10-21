/**
 * BMAD Orchestrator - Refactored Clean Version
 * High-level orchestration layer that coordinates workflow execution with UI/external systems
 * 
 * PRINCIPLES:
 * - Single Responsibility: Focuses on coordination, not implementation
 * - Minimal Abstractions: Delegates to WorkflowEngine for all workflow logic
 * - Clear Separation: Handles orchestration concerns (events, store, communication)
 */

// Removed unused import: AgentActivationEngine
const { AgentLoader } = require('./AgentLoader.js');
const { AgentCommunicator } = require('./AgentCommunicator.js');
const MessageServiceModule = require('./MessageService.js').default;
const { MessageService } = MessageServiceModule;

const { PusherService } = require('./orchestration/PusherService.js');
const { ConfigurationManager } = require('./core/ConfigurationManager.js');
// Removed unused import: UnifiedTemplateProcessor
import ArtifactManager from './services/ArtifactManager.js';
// Removed unused imports: ElicitationHandler, ShardingManager, ChecklistManager
import WorkflowManagerV2 from './WorkflowManagerV2.js';
const WorkflowManager = WorkflowManagerV2; // Use V2 as the implementation
import logger from '../utils/logger.js';

class BmadOrchestrator {
  constructor(store = null, options = {}) {
    // Orchestration dependencies - these handle external concerns
    this.agentLoader = new AgentLoader();
    this.messageService = new MessageService(options.messageService);
    this.pusherService = new PusherService();
    this.communicator = new AgentCommunicator(null, this.messageService, this.pusherService);
    this.store = store; // Direct store access for Redux events

    this.configurationManager = new ConfigurationManager();
    this.artifactManager = new ArtifactManager(options.gitService);
    // Removed unused services: agentActivationEngine, templateProcessor, elicitationHandler, shardingManager, checklistManager

    this.aiService = options.aiService;
    
    // Core workflow execution - simplified with WorkflowManager
    this.workflowManager = new WorkflowManager({
      aiService: this.aiService,
      communicator: this.communicator,
      pusherService: this.pusherService
    });
    
    // Ensure AI service is passed through
    if (this.aiService) {
      this.workflowManager.aiService = this.aiService;
    }
    
    this.initialized = false;
    this.eventSubscriptions = new Map();
  }

  async initialize() {
    try {
      const modeText = '';
      logger.info(`Initializing BMAD Orchestrator${modeText}...`);
      
      // Initialize core workflow manager and load agents
      await this.workflowManager.initialize();
      await this.configurationManager.loadConfiguration();
      await this.agentLoader.loadAllAgents();
      await this.artifactManager.initialize(this.configurationManager, this.agentLoader);
      
      this.initialized = true;
      logger.info(`BMAD Orchestrator initialized successfully${modeText}`);
      
      // Dispatch initialization event to store (direct dispatch - no wrapper needed)
      this.store?.dispatch({ 
        type: 'bmad/initialized', 
        payload: {
          agents: this.agentLoader.getAllAgentsMetadata(),
          sequences: await this.workflowManager.workflowParser.listAvailableWorkflows()
        }
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
      const dynamicWorkflowExists = await this.workflowManager.workflowParser.workflowExists(requestedSequence);
      
      logger.info(`🔍 [BmadOrchestrator] Checking for dynamic workflow: ${requestedSequence} - ${dynamicWorkflowExists ? 'Found' : 'Not found'}`);

      // Initialize GitHub artifact manager with repository context if provided
      if (options.githubContext || options.teamContext?.githubIntegration?.enabled) {
        const githubConfig = options.githubContext || options.teamContext?.githubIntegration;
        await this.artifactManager.initialize({
          owner: githubConfig.repository.owner,
          name: githubConfig.repository.name,
          branch: githubConfig.targetBranch,
          workflowId: options.workflowId,
          accessToken: githubConfig.accessToken,
          capabilities: githubConfig.capabilities || []
        });
        logger.info(`🐙 ArtifactManager initialized for team-based workflow: ${githubConfig.repository.full_name || githubConfig.repository.owner + '/' + githubConfig.repository.name}`);
      }

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
          // Team context for agent team deployments
          ...(options.teamContext && {
            teamInstanceId: options.teamContext.teamInstanceId,
            teamId: options.teamContext.teamId,
            teamName: options.teamContext.teamName,
            availableAgents: options.teamContext.availableAgents,
            projectContext: options.teamContext.projectContext
          }),
          // GitHub context for agents to access repository information
          ...(options.githubContext && {
            githubRepository: options.githubContext.repository,
            targetBranch: options.githubContext.targetBranch
          }),
          // Enhanced GitHub context from team integration
          ...(options.teamContext?.githubIntegration?.enabled && {
            githubRepository: options.teamContext.githubIntegration.repository,
            targetBranch: options.teamContext.githubIntegration.targetBranch,
            githubCapabilities: options.teamContext.githubIntegration.capabilities
          }),
          // Repository analysis for AI agents
          ...(options.repositoryAnalysis && {
            repositoryAnalysis: options.repositoryAnalysis
          }),
          ...options.context
        },
        metadata: {
          source: 'user_prompt',
          version: '1.0',
          workflowType: dynamicWorkflowExists ? 'dynamic' : 'legacy',
          // Team metadata for agent team deployments
          ...(options.teamContext && {
            team: {
              instanceId: options.teamContext.teamInstanceId,
              teamId: options.teamContext.teamId,
              name: options.teamContext.teamName,
              agentCount: options.teamContext.availableAgents?.length || 0,
              mode: options.teamContext.githubIntegration?.enabled ? 'github-team' : 'standard-team'
            }
          }),
          // GitHub integration metadata
          ...(options.githubContext && {
            github: {
              repositoryUrl: options.githubContext.repository.html_url,
              targetBranch: options.githubContext.targetBranch,
              owner: options.githubContext.repository.owner,
              name: options.githubContext.repository.name
            }
          }),
          // Enhanced GitHub metadata from team integration
          ...(options.teamContext?.githubIntegration?.enabled && {
            github: {
              repositoryUrl: `https://github.com/${options.teamContext.githubIntegration.repository.full_name}`,
              targetBranch: options.teamContext.githubIntegration.targetBranch,
              owner: options.teamContext.githubIntegration.repository.owner,
              name: options.teamContext.githubIntegration.repository.name,
              capabilities: options.teamContext.githubIntegration.capabilities,
              integrationMode: 'team-based'
            }
          }),
          ...options.metadata
        },
      };

      let result;
      
      if (dynamicWorkflowExists) {
        logger.info(`🚀 [BmadOrchestrator] Starting workflow: ${requestedSequence}`);
        result = await this.workflowManager.startWorkflow(userPrompt.trim(), {
          ...options,
          sequence: requestedSequence,
          name: workflowConfig.name,
          description: workflowConfig.description
        });
      } else {
        throw new Error(`Workflow "${requestedSequence}" not found.`);
      }
      
      // Dispatch orchestration event (direct dispatch - no wrapper needed)
      this.store?.dispatch({ 
        type: 'workflow/started', 
        payload: {
          workflowId: result.workflowId,
          config: workflowConfig,
          status: result.status
        }
      });

      return result;

    } catch (error) {
      logger.error('Error starting workflow:', error);
      throw error;
    }
  }

  // Enhanced workflow status with orchestration data
  async getWorkflowStatus(workflowId) {
    const status = await this.workflowManager.getWorkflowStatus(workflowId);
    if (!status) return null;

    // Get messages from AgentCommunicator which is where workflow execution actually stores them
    const messages = this.communicator.getMessageHistory(workflowId) || [];
    const communicationStats = this.communicator.getStatistics(workflowId);

    // Also try to get messages from MessageService as backup
    let allMessages = Array.isArray(messages) ? [...messages] : [];
    try {
      await this.messageService.initializeWorkflow(workflowId);
      const messageServiceMessages = this.messageService.getMessageHistory(workflowId) || [];
      const messageServiceStats = this.messageService.getStatistics(workflowId);
      
      // Merge messages from both sources (prefer AgentCommunicator as it's more up-to-date during execution)
      if (Array.isArray(messageServiceMessages) && messageServiceMessages.length > 0) {
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
            agentCommunicatorMessages: Array.isArray(messages) ? messages.length : 0,
            messageServiceMessages: Array.isArray(messageServiceMessages) ? messageServiceMessages.length : 0,
            ...communicationStats
          }
        },
        agents: this.getWorkflowAgentStatuses(workflowId)
      };
    } catch (error) {
      logger.warn('Error getting MessageService data, using AgentCommunicator only:', error.message);
      
      // Ensure messages is an array before using it
      const safeMessages = Array.isArray(messages) ? messages : [];
      
      return {
        ...status,
        communication: {
          messageCount: safeMessages.length,
          timeline: safeMessages.map(msg => ({
            id: msg.id,
            from: msg.from,
            to: msg.to,
            type: msg.type,
            timestamp: msg.timestamp,
            content: msg.content || msg.summary || ''
          })),
          statistics: {
            totalMessages: safeMessages.length,
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
      const result = await this.workflowManager.pauseWorkflow(workflowId);
      this.store?.dispatch({ type: 'workflow/paused', payload: { workflowId, status: result.status }});
      return result;
    } catch (error) {
      logger.error('Error pausing workflow:', error);
      throw error;
    }
  }

  async resumeWorkflow(workflowId) {
    try {
      const result = await this.workflowManager.resumeWorkflow(workflowId);
      this.store?.dispatch({ type: 'workflow/resumed', payload: { workflowId, status: result.status }});
      return result;
    } catch (error) {
      logger.error('Error resuming workflow:', error);
      throw error;
    }
  }

  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId, userId = null) {
    try {
      logger.info(`🔄 Resuming workflow ${workflowId} with elicitation response`);
    
      // Directly delegate the raw response to the engine. No processing here.
      const result = await this.workflowManager.resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentId, userId);
    
      this.store?.dispatch({ type: 'workflow/elicitationResumed', payload: { workflowId, status: result.status, elicitationResponse }});
      return result;
    } catch (error) {
      logger.error('Error resuming workflow with elicitation:', error);
      throw error;
    }
  }

  async cancelWorkflow(workflowId) {
    try {
      const result = await this.workflowManager.cancelWorkflow(workflowId);
      this.store?.dispatch({ type: 'workflow/cancelled', payload: { workflowId, status: result.status }});
      return result;
    } catch (error) {
      logger.error('Error cancelling workflow:', error);
      throw error;
    }
  }

  // Enhanced active workflows with orchestration data
  getActiveWorkflows() {
    const workflows = this.workflowManager.getActiveWorkflows();
    return workflows.map(workflow => ({
      ...workflow,
      communication: this.communicator.getStatistics(workflow.id)
    }));
  }

  // Simple delegations - no orchestration enhancement needed
  getExecutionHistory(limit = 50) {
    return this.workflowManager.getExecutionHistory(limit);
  }

  async getWorkflowArtifacts(workflowId) {
    return await this.workflowManager.getWorkflowArtifacts(workflowId);
  }

  async getWorkflowCheckpoints(workflowId) {
    return await this.workflowManager.getWorkflowCheckpoints(workflowId);
  }

  async resumeFromRollback(workflowId) {
    if (!this.initialized) {
      throw new Error('BMAD Orchestrator not initialized');
    }

    const result = await this.workflowManager.resumeFromRollback(workflowId);
    this.store?.dispatch({ type: 'workflow/resumedFromRollback', payload: result });
    return result;
  }

  // Agent and Sequence Information - Direct Access
  getAvailableAgents() {
    return this.agentLoader.getAllAgentsMetadata();
  }

  async getWorkflowSequences() {
    return this.workflowManager.workflowParser.listAvailableWorkflows();
  }

  // Event Subscription Management - Orchestration Concern
  subscribeToWorkflow(workflowId, callbacks) {
    const unsubscribeFn = this.communicator.subscribeToWorkflow(workflowId, {
      'message': (data) => {
        callbacks.onMessage?.(data);
        this.store?.dispatch({ type: 'workflow/message', payload: data });
      },
      'agent:activated': (data) => {
        callbacks.onAgentActivated?.(data);
        this.store?.dispatch({ type: 'agent/activated', payload: data });
      },
      'agent:completed': (data) => {
        callbacks.onAgentCompleted?.(data);
        this.store?.dispatch({ type: 'agent/completed', payload: data });
      },
      'agent:communication': (data) => {
        callbacks.onAgentCommunication?.(data);
        this.store?.dispatch({ type: 'agent/communication', payload: data });
      },
      'workflow:error': (data) => {
        callbacks.onError?.(data);
        this.store?.dispatch({ type: 'workflow/error', payload: data });
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
      activeWorkflows: this.workflowManager.activeWorkflows.size,
      totalExecutions: this.workflowManager.executionHistory.size,
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
    this.workflowManager.cleanup();
    this.agentLoader.clearCache();
    
    // MEMORY LEAK FIX: Cleanup message service
    if (this.messageService && this.messageService.cleanupAll) {
      this.messageService.cleanupAll();
    }
    
    this.initialized = false;
    logger.info('BMAD Orchestrator cleanup completed');
  }
}

// Singleton management - Global storage to survive HMR
let orchestratorInstance = null;
let lastCleanupTime = 0;

// MEMORY LEAK FIX: Store singleton in global to survive Hot Module Replacement in development
if (typeof global !== 'undefined') {
  // Server-side (Node.js)
  if (!global.__BMAD_ORCHESTRATOR_INSTANCE__) {
    global.__BMAD_ORCHESTRATOR_INSTANCE__ = null;
    global.__BMAD_LAST_CLEANUP__ = 0;
  }
  orchestratorInstance = global.__BMAD_ORCHESTRATOR_INSTANCE__;
  lastCleanupTime = global.__BMAD_LAST_CLEANUP__;
}

const getOrchestrator = async () => {
  // MEMORY LEAK FIX: Periodic cleanup to prevent memory accumulation
  const now = Date.now();
  const cleanupInterval = 1000 * 60 * 15; // 15 minutes
  
  if (orchestratorInstance && (now - lastCleanupTime) > cleanupInterval) {
    logger.info('🧹 [Orchestrator] Performing periodic memory cleanup...');
    
    // Cleanup message service memory
    if (orchestratorInstance.messageService && orchestratorInstance.messageService.performMemoryManagement) {
      orchestratorInstance.messageService.performMemoryManagement();
    }
    
    lastCleanupTime = now;
    
    // Update global storage
    if (typeof global !== 'undefined') {
      global.__BMAD_LAST_CLEANUP__ = now;
    }
  }

  if (!orchestratorInstance) {
    logger.info('🔧 [Orchestrator] Creating new singleton instance...');
    
    // Dynamically import AIServiceV2 for server-side usage
    let aiService = null;
    try {
      const AIServiceModule = await import('../ai/AIServiceV2.js');
      // Try both default export and named export
      const AIServiceClass = AIServiceModule.default || AIServiceModule.AIServiceV2;
      if (AIServiceClass) {
        aiService = AIServiceClass.getInstance ? AIServiceClass.getInstance() : AIServiceClass;
        logger.info('✅ AIServiceV2 loaded successfully for orchestrator');
      } else {
        throw new Error('AIServiceV2 class not found in module exports');
      }
    } catch (error) {
      logger.warn('Could not load AIServiceV2, running in limited mode:', error.message);
      logger.debug('AIServiceV2 import error details:', error);
    }
    
    // Load GitIntegrationService for GitHub artifact commits
    let gitService = null;
    try {
      const GitIntegrationServiceModule = await import('../integrations/GitIntegrationService.js');
      const GitIntegrationServiceClass = GitIntegrationServiceModule.default || GitIntegrationServiceModule.GitIntegrationService;
      if (GitIntegrationServiceClass) {
        gitService = new GitIntegrationServiceClass();
        logger.info('✅ GitIntegrationService loaded successfully for orchestrator');
      }
    } catch (error) {
      logger.warn('Could not load GitIntegrationService:', error.message);
    }
    
    orchestratorInstance = new BmadOrchestrator(null, { aiService, gitService });
    await orchestratorInstance.initialize();
    
    // Store in global to survive HMR
    if (typeof global !== 'undefined') {
      global.__BMAD_ORCHESTRATOR_INSTANCE__ = orchestratorInstance;
    }
    
    logger.info('✅ [Orchestrator] Singleton instance created and initialized');
  } else {
    logger.info(`🔄 [Orchestrator] Reusing existing singleton instance (initialized: ${orchestratorInstance.initialized})`);
    // Try to update aiService if it wasn't available during initial creation
    if (!orchestratorInstance.aiService) {
      try {
        const AIServiceModule = await import('../ai/AIServiceV2.js');
        const AIServiceClass = AIServiceModule.default || AIServiceModule.AIServiceV2;
        if (AIServiceClass) {
          const aiService = AIServiceClass.getInstance ? AIServiceClass.getInstance() : AIServiceClass;
          if (aiService) {
            orchestratorInstance.aiService = aiService;
            orchestratorInstance.workflowManager.aiService = aiService;
            if (orchestratorInstance.workflowManager.updateAiService) {
              orchestratorInstance.workflowManager.updateAiService(aiService);
            }
            logger.info('✅ AIServiceV2 updated in existing orchestrator instance');
          }
        }
      } catch (error) {
        logger.debug('Failed to update AIServiceV2 in existing orchestrator:', error.message);
      }
    }
  }
  return orchestratorInstance;
};

module.exports = { BmadOrchestrator, getOrchestrator };
