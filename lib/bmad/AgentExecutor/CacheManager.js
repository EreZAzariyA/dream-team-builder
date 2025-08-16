/**
 * Cache Manager
 * Handles all caching operations and memory management
 */

import logger from '../../utils/logger.js';

class CacheManager {
  constructor() {
    this.taskCache = new Map();
    this.templateCache = new Map();
    this.checklistCache = new Map();
    this.promptCache = new Map();
    this.stateManager = new Map();
    this.MAX_CACHE_SIZE = 100;
  }

  // Workflow state management
  getWorkflowState(workflowId) {
    return this.stateManager.get(workflowId) || {
      completedOutputs: [],
      currentStep: 1,
      dependenciesMet: true,
      sharedData: {},
      corrections: [],
      notes: []
    };
  }

  updateWorkflowState(workflowId, updates) {
    const currentState = this.getWorkflowState(workflowId);
    this.stateManager.set(workflowId, { ...currentState, ...updates });
  }

  addAgentOutput(workflowId, agentId, output) {
    const state = this.getWorkflowState(workflowId);
    state.completedOutputs.push({
      agentId,
      output,
      timestamp: new Date().toISOString(),
      validated: false
    });
    this.updateWorkflowState(workflowId, state);
  }

  // Template cache operations
  getTemplate(key) {
    return this.templateCache.get(key);
  }

  setTemplate(key, value) {
    this.templateCache.set(key, value);
  }

  // Task cache operations
  getTask(key) {
    return this.taskCache.get(key);
  }

  setTask(key, value) {
    this.taskCache.set(key, value);
  }

  // Checklist cache operations
  getChecklist(key) {
    return this.checklistCache.get(key);
  }

  setChecklist(key, value) {
    this.checklistCache.set(key, value);
  }

  // Prompt cache operations
  getPrompt(key) {
    return this.promptCache.get(key);
  }

  setPrompt(key, value) {
    this.promptCache.set(key, value);
  }

  /**
   * Cache cleanup mechanism to prevent memory leaks
   * Should be called periodically or after processing batches
   */
  cleanupCaches() {
    this._cleanupCache(this.taskCache, 'Task');
    this._cleanupCache(this.templateCache, 'Template');
    this._cleanupCache(this.checklistCache, 'Checklist');
    this._cleanupCache(this.promptCache, 'Prompt');
    this._cleanupCache(this.stateManager, 'State manager');
  }

  _cleanupCache(cache, name) {
    if (cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries());
      const toKeep = entries.slice(-this.MAX_CACHE_SIZE / 2);
      cache.clear();
      toKeep.forEach(([key, value]) => cache.set(key, value));
      logger.info(`🧹 [CACHE CLEANUP] ${name} cache cleaned: ${entries.length} → ${toKeep.length}`);
    }
  }

  // Get cache statistics
  getCacheStats() {
    return {
      taskCache: this.taskCache.size,
      templateCache: this.templateCache.size,
      checklistCache: this.checklistCache.size,
      promptCache: this.promptCache.size,
      stateManager: this.stateManager.size,
      total: this.taskCache.size + this.templateCache.size + 
             this.checklistCache.size + this.promptCache.size + this.stateManager.size
    };
  }
}

module.exports = { CacheManager };