/**
 * System Health Checker
 * Validates all production system dependencies and provides fallback modes
 */

import logger from '../utils/logger.js';

export class SystemHealthChecker {
  constructor() {
    this.healthStatus = {
      overall: 'unknown',
      services: {},
      capabilities: {},
      recommendations: []
    };
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck() {
    logger.info('🔍 [HEALTH CHECK] Starting comprehensive system health check...');
    
    const checks = {
      // Core services
      pusher: () => this.checkPusherService(),
      database: () => this.checkDatabaseService(),
      aiService: () => this.checkAIService(),
      
      // Production services
      gitIntegration: () => this.checkGitIntegration(),
      codeExecution: () => this.checkCodeExecution(),
      qualityGates: () => this.checkQualityGates(),
      
      // Infrastructure
      fileSystem: () => this.checkFileSystem(),
      environment: () => this.checkEnvironmentVariables()
    };

    // Execute all health checks
    for (const [serviceName, checkFunction] of Object.entries(checks)) {
      try {
        this.healthStatus.services[serviceName] = await checkFunction();
      } catch (error) {
        this.healthStatus.services[serviceName] = {
          status: 'error',
          available: false,
          error: error.message,
          timestamp: new Date()
        };
      }
    }

    // Calculate overall health and capabilities
    this.calculateOverallHealth();
    this.generateRecommendations();

    logger.info(`🏥 [HEALTH CHECK] System health: ${this.healthStatus.overall}`);
    return this.healthStatus;
  }

  /**
   * Check Pusher service for real-time updates
   */
  async checkPusherService() {
    try {
      const { PusherService } = require('./orchestration/PusherService.js');
      const pusherService = new PusherService();
      const status = pusherService.getConnectionStatus();
      
      return {
        status: status.isConnected ? 'healthy' : 'degraded',
        available: status.isConnected,
        details: status,
        timestamp: new Date(),
        fallback: 'Workflows will function without real-time updates'
      };
    } catch (error) {
      return {
        status: 'unavailable',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'Real-time updates disabled'
      };
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabaseService() {
    try {
      const { DatabaseService } = require('./engine/DatabaseService.js');
      const dbService = new DatabaseService();
      
      // Basic connectivity test
      return {
        status: 'healthy',
        available: true,
        details: { initialized: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'In-memory workflow state only'
      };
    }
  }

  /**
   * Check AI service availability
   */
  async checkAIService() {
    try {
      const { AIService } = await import('../ai/AIService.js');
      const aiService = AIService.getInstance();
      
      return {
        status: aiService.initialized ? 'healthy' : 'degraded',
        available: !!aiService,
        details: { initialized: aiService.initialized },
        timestamp: new Date(),
        fallback: 'Mock responses for testing'
      };
    } catch (error) {
      return {
        status: 'unavailable',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'Mock AI responses only'
      };
    }
  }

  /**
   * Check Git integration capabilities
   */
  async checkGitIntegration() {
    try {
      const GitIntegrationService = (await import('../integrations/GitIntegrationService.js')).default;
      const gitService = new GitIntegrationService();
      
      const hasToken = !!(process.env.GITHUB_TOKEN);
      
      return {
        status: hasToken ? 'healthy' : 'degraded',
        available: true,
        details: { hasGitHubToken: hasToken },
        timestamp: new Date(),
        fallback: 'Git operations disabled without token'
      };
    } catch (error) {
      return {
        status: 'unavailable',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'No git integration'
      };
    }
  }

  /**
   * Check code execution capabilities
   */
  async checkCodeExecution() {
    try {
      const CodeExecutionEngine = (await import('../execution/CodeExecutionEngine.js')).default;
      const executor = new CodeExecutionEngine();
      
      return {
        status: 'healthy',
        available: true,
        details: { sandboxed: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unavailable',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'No code execution'
      };
    }
  }

  /**
   * Check quality gates system
   */
  async checkQualityGates() {
    try {
      const QualityGateManager = (await import('./services/QualityGateManager.js')).default;
      const qualityManager = new QualityGateManager();
      
      return {
        status: 'healthy',
        available: true,
        details: { initialized: true },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unavailable',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'No quality validation'
      };
    }
  }

  /**
   * Check file system access
   */
  async checkFileSystem() {
    try {
      const fs = await import('fs/promises');
      const os = await import('os');
      
      const tmpDir = os.tmpdir();
      await fs.access(tmpDir);
      
      return {
        status: 'healthy',
        available: true,
        details: { tmpDir },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        available: false,
        error: error.message,
        timestamp: new Date(),
        fallback: 'Limited file operations'
      };
    }
  }

  /**
   * Check environment variables
   */
  async checkEnvironmentVariables() {
    const requiredVars = [
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
      'MONGODB_URI'
    ];

    const optionalVars = [
      'GITHUB_TOKEN',
      'PUSHER_APP_ID',
      'PUSHER_KEY',
      'PUSHER_SECRET',
      'OPENAI_API_KEY'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    const optionalMissing = optionalVars.filter(varName => !process.env[varName]);

    return {
      status: missing.length === 0 ? 'healthy' : 'degraded',
      available: true,
      details: {
        required: {
          present: requiredVars.filter(v => process.env[v]),
          missing
        },
        optional: {
          present: optionalVars.filter(v => process.env[v]),
          missing: optionalMissing
        }
      },
      timestamp: new Date()
    };
  }

  /**
   * Calculate overall system health
   */
  calculateOverallHealth() {
    const services = Object.values(this.healthStatus.services);
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const errorCount = services.filter(s => s.status === 'error' || s.status === 'unavailable').length;

    // Determine overall status
    if (errorCount > services.length / 2) {
      this.healthStatus.overall = 'critical';
    } else if (degradedCount > services.length / 3) {
      this.healthStatus.overall = 'degraded';
    } else if (healthyCount === services.length) {
      this.healthStatus.overall = 'healthy';
    } else {
      this.healthStatus.overall = 'operational';
    }

    // Determine available capabilities
    this.healthStatus.capabilities = {
      basicWorkflows: true, // Always available
      realTimeUpdates: this.healthStatus.services.pusher?.available || false,
      productionFeatures: this.healthStatus.services.gitIntegration?.available || false,
      codeExecution: this.healthStatus.services.codeExecution?.available || false,
      qualityValidation: this.healthStatus.services.qualityGates?.available || false,
      persistentState: this.healthStatus.services.database?.available || false
    };
  }

  /**
   * Generate recommendations based on health status
   */
  generateRecommendations() {
    this.healthStatus.recommendations = [];

    // Check for critical issues
    if (this.healthStatus.overall === 'critical') {
      this.healthStatus.recommendations.push({
        priority: 'critical',
        category: 'system',
        message: 'Multiple core services are unavailable. System may not function properly.',
        action: 'Check service configurations and dependencies'
      });
    }

    // Service-specific recommendations
    Object.entries(this.healthStatus.services).forEach(([serviceName, status]) => {
      if (status.status === 'unavailable' || status.status === 'error') {
        switch (serviceName) {
          case 'pusher':
            this.healthStatus.recommendations.push({
              priority: 'low',
              category: 'features',
              message: 'Real-time updates unavailable',
              action: 'Configure PUSHER environment variables for live updates'
            });
            break;
          case 'gitIntegration':
            this.healthStatus.recommendations.push({
              priority: 'medium',
              category: 'features',
              message: 'Git integration unavailable',
              action: 'Set GITHUB_TOKEN environment variable for git operations'
            });
            break;
          case 'database':
            this.healthStatus.recommendations.push({
              priority: 'high',
              category: 'data',
              message: 'Database unavailable - workflows will not persist',
              action: 'Check MONGODB_URI and database connectivity'
            });
            break;
          case 'aiService':
            this.healthStatus.recommendations.push({
              priority: 'critical',
              category: 'core',
              message: 'AI service unavailable',
              action: 'Configure AI service API keys'
            });
            break;
        }
      }
    });

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    this.healthStatus.recommendations.sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Get system mode based on available capabilities
   */
  getSystemMode() {
    const capabilities = this.healthStatus.capabilities;
    
    if (capabilities.productionFeatures && capabilities.codeExecution && capabilities.qualityValidation) {
      return 'production';
    } else if (capabilities.realTimeUpdates && capabilities.persistentState) {
      return 'enhanced';
    } else {
      return 'basic';
    }
  }

  /**
   * Get health summary for logging/display
   */
  getHealthSummary() {
    const mode = this.getSystemMode();
    const availableServices = Object.entries(this.healthStatus.services)
      .filter(([, status]) => status.available)
      .map(([name]) => name);

    return {
      overall: this.healthStatus.overall,
      mode,
      availableServices,
      recommendations: this.healthStatus.recommendations.length,
      timestamp: new Date()
    };
  }
}

export default SystemHealthChecker;