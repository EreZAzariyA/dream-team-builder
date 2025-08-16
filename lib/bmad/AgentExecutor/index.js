/**
 * Agent Executor - Main Orchestrator
 * Coordinates all agent execution components
 */

const { CoreExecutor } = require('./CoreExecutor.js');
const { TemplateDetector } = require('./TemplateDetector.js');
const { TemplateProcessor } = require('./TemplateProcessor.js');
const { ElicitationManager } = require('./ElicitationManager.js');
const { FileManager } = require('./FileManager.js');
const { CacheManager } = require('./CacheManager.js');
const { AIServiceAdapter } = require('./AIServiceAdapter.js');
import logger from '../../utils/logger.js';

const isServer = typeof window === 'undefined';

// Singleton components to prevent memory leaks
let sharedCacheManager = null;
let sharedFileManager = null;
let sharedAiServiceAdapter = null;
let sharedTemplateDetector = null;
let sharedTemplateProcessor = null;
let sharedElicitationManager = null;
let sharedCoreExecutor = null;

class AgentExecutor {
  constructor(agentLoader, aiService, configurationManager = null) {
    this.agentLoader = agentLoader;
    this.configurationManager = configurationManager;
    
    // Initialize singleton components to prevent memory leaks
    if (!sharedCacheManager) {
      sharedCacheManager = new CacheManager();
    }
    this.cacheManager = sharedCacheManager;

    if (!sharedAiServiceAdapter) {
      sharedAiServiceAdapter = new AIServiceAdapter(aiService);
    } else {
      sharedAiServiceAdapter.updateAiService(aiService);
    }
    this.aiServiceAdapter = sharedAiServiceAdapter;

    if (!sharedTemplateDetector) {
      sharedTemplateDetector = new TemplateDetector(this.cacheManager);
    }
    this.templateDetector = sharedTemplateDetector;

    if (!sharedTemplateProcessor) {
      sharedTemplateProcessor = new TemplateProcessor(this.cacheManager);
    }
    this.templateProcessor = sharedTemplateProcessor;

    if (!sharedElicitationManager) {
      sharedElicitationManager = new ElicitationManager(configurationManager);
    }
    this.elicitationManager = sharedElicitationManager;

    if (!sharedFileManager) {
      sharedFileManager = new FileManager();
    }
    this.fileManager = sharedFileManager;

    if (!sharedCoreExecutor) {
      sharedCoreExecutor = new CoreExecutor(
        this.aiServiceAdapter,
        this.templateDetector,
        this.templateProcessor,
        this.elicitationManager,
        this.fileManager,
        this.cacheManager
      );
    }
    this.coreExecutor = sharedCoreExecutor;
    
    this.fileManagerInitialized = false;
  }

  // Method to update aiService after construction
  updateAiService(aiService) {
    this.aiServiceAdapter.updateAiService(aiService);
  }

  // Workflow state management (delegated to cacheManager)
  getWorkflowState(workflowId) {
    return this.cacheManager.getWorkflowState(workflowId);
  }

  updateWorkflowState(workflowId, updates) {
    this.cacheManager.updateWorkflowState(workflowId, updates);
  }

  addAgentOutput(workflowId, agentId, output) {
    this.cacheManager.addAgentOutput(workflowId, agentId, output);
  }

  // Main execution method (delegated to coreExecutor)
  async executeAgent(agent, context, options = {}) {
    logger.info(`🔍 [AGENT EXECUTOR] Starting execution for agent: ${agent?.id}`);
    
    // Initialize FileManager if needed
    if (!this.fileManagerInitialized) {
      await this.fileManager.initialize();
      this.fileManagerInitialized = true;
    }
    
    return await this.coreExecutor.executeAgent(agent, context, options);
  }

  // Cache cleanup (delegated to cacheManager)
  cleanupCaches() {
    this.cacheManager.cleanupCaches();
  }

  // Utility methods for backward compatibility
  shouldSaveAsFile(result, template, context) {
    return this.fileManager.shouldSaveAsFile(result, template, context);
  }

  async saveAgentFile(result, agent, template, context) {
    return await this.fileManager.saveAgentFile(result, agent, template, context);
  }
}

module.exports = { AgentExecutor };