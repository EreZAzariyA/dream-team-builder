/**
 * BMAD Configuration Manager
 * 
 * Loads and validates core-config.yaml and provides system-wide configuration.
 * This is a critical system dependency - nothing works without proper configuration.
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { validateFilePath } = require('../../utils/fileValidator');
import logger from '../../utils/logger.js';

class ConfigurationManager {
  constructor() {
    this.config = null;
    this.configPath = null;
    this.isLoaded = false;
    this.defaultConfig = this.getDefaultConfiguration();
  }

  /**
   * Load configuration from core-config.yaml
   * System halts if this file is missing (as per BMAD spec)
   */
  async loadConfiguration(projectRoot = null) {
    const rootPath = projectRoot || process.cwd();
    this.configPath = path.join(rootPath, '.bmad-core', 'core-config.yaml');

    try {
      logger.info(`🔧 [CONFIG] Loading configuration from: ${this.configPath}`);
      
      // Validate file path for security
      validateFilePath(this.configPath);
      
      // Check if config file exists
      await fs.access(this.configPath, fs.constants.F_OK);
      
      // Load and parse YAML
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const rawConfig = yaml.load(configContent);
      
      // Validate and merge with defaults
      this.config = this.validateAndMergeConfig(rawConfig);
      this.isLoaded = true;
      
      logger.info(`✅ [CONFIG] Configuration loaded successfully`);
      logger.info(`🔧 [CONFIG] PRD Location: ${this.config.prd.prdFile}`);
      logger.info(`🔧 [CONFIG] Architecture Location: ${this.config.architecture.architectureFile}`);
      logger.info(`🔧 [CONFIG] Story Location: ${this.config.devStoryLocation}`);
      logger.info(`🔧 [CONFIG] Markdown Exploder: ${this.config.markdownExploder}`);
      
      return this.config;

    } catch (error) {
      logger.error(`❌ [CONFIG] Failed to load configuration from ${this.configPath}:`, error.message);
      
      if (error.code === 'ENOENT') {
        throw new Error(`CRITICAL: core-config.yaml not found at ${this.configPath}. System cannot function without configuration.`);
      } else if (error.name === 'YAMLException') {
        throw new Error(`CRITICAL: Invalid YAML in core-config.yaml: ${error.message}`);
      } else {
        throw new Error(`CRITICAL: Failed to load configuration: ${error.message}`);
      }
    }
  }

  /**
   * Get default configuration structure
   * Based on analysis of BMAD documentation
   */
  getDefaultConfiguration() {
    return {
      markdownExploder: true,
      prd: {
        prdFile: 'docs/prd.md',
        prdVersion: 'v4',
        prdSharded: true,
        prdShardedLocation: 'docs/prd',
        epicFilePattern: 'epic-{n}*.md'
      },
      architecture: {
        architectureFile: 'docs/architecture.md',
        architectureVersion: 'v4',
        architectureSharded: true,
        architectureShardedLocation: 'docs/architecture'
      },
      devLoadAlwaysFiles: [
        'docs/architecture/coding-standards.md',
        'docs/architecture/tech-stack.md',
        'docs/architecture/source-tree.md'
      ],
      devDebugLog: '.ai/debug-log.md',
      devStoryLocation: 'docs/stories',
      slashPrefix: 'BMad',
      // Additional system defaults
      bmadCore: {
        agentsPath: '.bmad-core/agents',
        tasksPath: '.bmad-core/tasks',
        templatesPath: '.bmad-core/templates',
        workflowsPath: '.bmad-core/workflows',
        checklistsPath: '.bmad-core/checklists',
        dataPath: '.bmad-core/data'
      },
      system: {
        contextOptimization: true,
        freshChatForPhases: ['SM', 'Dev', 'QA'],
        commandPrefix: '*',
        elicitationOptions: 9,
        mandatoryElicitationFormat: true
      }
    };
  }

  /**
   * Validate configuration and merge with defaults
   */
  validateAndMergeConfig(userConfig) {
    if (!userConfig || typeof userConfig !== 'object') {
      throw new Error('Configuration must be a valid object');
    }

    // Deep merge user config with defaults
    const mergedConfig = this.deepMerge(this.defaultConfig, userConfig);
    
    // Validate required fields
    this.validateRequiredFields(mergedConfig);
    
    // Validate file paths
    this.validateConfigPaths(mergedConfig);
    
    return mergedConfig;
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Validate required configuration fields
   */
  validateRequiredFields(config) {
    const requiredPaths = [
      'prd.prdFile',
      'architecture.architectureFile',
      'devStoryLocation',
      'slashPrefix'
    ];

    for (const path of requiredPaths) {
      const value = this.getNestedValue(config, path);
      if (!value) {
        throw new Error(`Required configuration field missing: ${path}`);
      }
    }
  }

  /**
   * Validate configuration file paths
   */
  validateConfigPaths(config) {
    // Validate that specified paths use forward slashes (BMAD convention)
    const pathFields = [
      config.prd.prdFile,
      config.architecture.architectureFile,
      config.devStoryLocation,
      config.devDebugLog,
      ...config.devLoadAlwaysFiles
    ];

    for (const filePath of pathFields) {
      if (filePath && filePath.includes('\\')) {
        logger.warn(`⚠️ [CONFIG] Path uses backslashes, consider using forward slashes: ${filePath}`);
      }
    }
  }

  /**
   * Get nested configuration value
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get configuration value with fallback
   */
  get(path, fallback = null) {
    if (!this.isLoaded) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.');
    }
    
    const value = this.getNestedValue(this.config, path);
    return value !== undefined ? value : fallback;
  }

  /**
   * Get absolute path for configured file
   */
  getAbsolutePath(relativePath, projectRoot = null) {
    const rootPath = projectRoot || process.cwd();
    return path.resolve(rootPath, relativePath);
  }

  /**
   * Get BMAD core directory paths
   */
  getBmadCorePaths(projectRoot = null) {
    const rootPath = projectRoot || process.cwd();
    const bmadCore = this.get('bmadCore');
    
    return {
      agents: path.resolve(rootPath, bmadCore.agentsPath),
      tasks: path.resolve(rootPath, bmadCore.tasksPath),
      templates: path.resolve(rootPath, bmadCore.templatesPath),
      workflows: path.resolve(rootPath, bmadCore.workflowsPath),
      checklists: path.resolve(rootPath, bmadCore.checklistsPath),
      data: path.resolve(rootPath, bmadCore.dataPath)
    };
  }

  /**
   * Check if document sharding is enabled
   */
  isShardingEnabled(documentType) {
    switch (documentType) {
      case 'prd':
        return this.get('prd.prdSharded', false);
      case 'architecture':
        return this.get('architecture.architectureSharded', false);
      default:
        return this.get('markdownExploder', false);
    }
  }

  /**
   * Get sharded document location
   */
  getShardedLocation(documentType, projectRoot = null) {
    const rootPath = projectRoot || process.cwd();
    let shardedPath;

    switch (documentType) {
      case 'prd':
        shardedPath = this.get('prd.prdShardedLocation');
        break;
      case 'architecture':
        shardedPath = this.get('architecture.architectureShardedLocation');
        break;
      default:
        return null;
    }

    return shardedPath ? path.resolve(rootPath, shardedPath) : null;
  }

  /**
   * Get dev agent always-load files
   */
  getDevAlwaysFiles(projectRoot = null) {
    const rootPath = projectRoot || process.cwd();
    const files = this.get('devLoadAlwaysFiles', []);
    return files.map(file => path.resolve(rootPath, file));
  }

  /**
   * Validate system state
   */
  validateSystem() {
    if (!this.isLoaded) {
      return { valid: false, error: 'Configuration not loaded' };
    }

    const issues = [];
    
    // Check if BMAD core directories exist
    const paths = this.getBmadCorePaths();
    for (const [type, dirPath] of Object.entries(paths)) {
      try {
        require('fs').accessSync(dirPath, require('fs').constants.F_OK);
      } catch (error) {
        issues.push(`BMAD core directory missing: ${type} at ${dirPath}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues: issues,
      config: this.config
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth() {
    const validation = this.validateSystem();
    
    return {
      configurationLoaded: this.isLoaded,
      configurationValid: validation.valid,
      configurationPath: this.configPath,
      issues: validation.issues || [],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { ConfigurationManager };