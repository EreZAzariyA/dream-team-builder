/**
 * Plugin Architecture for Third-Party Integrations
 * Provides a flexible framework for integrating external services
 */

import logger from "../utils/logger.js";

export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  /**
   * Register a new plugin
   */
  registerPlugin(pluginId, plugin) {
    if (this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is already registered`);
    }

    // Validate plugin structure
    if (!plugin.name || !plugin.version || !plugin.initialize) {
      throw new Error(`Plugin ${pluginId} is missing required properties`);
    }

    this.plugins.set(pluginId, plugin);
    logger.info(`Plugin registered: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Initialize all registered plugins
   */
  async initializePlugins(config = {}) {
    const results = [];
    
    for (const [pluginId, plugin] of this.plugins) {
      try {
        const pluginConfig = config[pluginId] || {};
        await plugin.initialize(pluginConfig);
        results.push({ pluginId, status: 'initialized', error: null });
        logger.info(`Plugin initialized: ${plugin.name}`);
      } catch (error) {
        results.push({ pluginId, status: 'error', error: error.message });
        console.error(`Error initializing plugin ${pluginId}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.entries()).map(([id, plugin]) => ({
      id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      status: plugin.status || 'unknown'
    }));
  }

  /**
   * Register a hook for plugin events
   */
  registerHook(event, callback) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push(callback);
  }

  /**
   * Trigger a hook event
   */
  async triggerHook(event, data) {
    const callbacks = this.hooks.get(event) || [];
    const results = [];
    
    for (const callback of callbacks) {
      try {
        const result = await callback(data);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Execute plugin action
   */
  async executePluginAction(pluginId, action, data) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.actions || !plugin.actions[action]) {
      throw new Error(`Action ${action} not found in plugin ${pluginId}`);
    }

    try {
      return await plugin.actions[action](data);
    } catch (error) {
      console.error(`Error executing ${action} on plugin ${pluginId}:`, error);
      throw error;
    }
  }
}

/**
 * Base Plugin Class
 */
export class BasePlugin {
  constructor(name, version, description) {
    this.name = name;
    this.version = version;
    this.description = description;
    this.status = 'inactive';
    this.config = {};
    this.actions = {};
  }

  /**
   * Initialize the plugin
   */
  async initialize(config) {
    this.config = { ...this.config, ...config };
    this.status = 'active';
  }

  /**
   * Shutdown the plugin
   */
  async shutdown() {
    this.status = 'inactive';
  }

  /**
   * Register an action
   */
  registerAction(name, handler) {
    this.actions[name] = handler.bind(this);
  }

  /**
   * Validate required configuration
   */
  validateConfig(requiredKeys) {
    const missing = requiredKeys.filter(key => !this.config[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }
}

// Global plugin manager instance
export const pluginManager = new PluginManager();

export default pluginManager;