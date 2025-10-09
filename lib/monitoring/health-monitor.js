/**
 * System Health Monitor
 * Tracks database performance, API response times, error rates, and system metrics
 */

import { connectMongoose } from '../database/mongodb.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { redisService } from '../utils/redis.js';

export class HealthMonitor {
  constructor() {
    // Redis keys for metrics storage
    // API response times: health:api:response:{endpoint} (list with TTL)
    // Error rates: health:errors:{endpoint} (list with TTL)
    // Database metrics: health:database:metrics (list with TTL)
    // System metrics: health:system:metrics (list with TTL)

    this.alertThresholds = {
      apiResponseTime: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      databaseConnectionTime: 1000, // 1 second
      memoryUsage: 0.95, // 95% (increased from 85% for development)
      cpuUsage: 0.80 // 80%
    };
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.alertCallbacks = [];

    // Check Redis availability
    if (!redisService.isAvailable()) {
      logger.warn('⚠️  HealthMonitor: Redis not configured - health monitoring will be limited');
    }
  }

  /**
   * Start monitoring system health
   */
  startMonitoring(intervalMs = 300000) { // Default: 5 minutes (reduced from 1 minute)
    if (this.isMonitoring) {
      logger.info('Health monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info(`Starting health monitoring with ${intervalMs}ms interval`);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
      } catch (error) {
        logger.error('Error during health monitoring:', error);
      }
    }, intervalMs);

    // Initial metrics collection
    this.collectMetrics();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Health monitoring stopped');
  }

  /**
   * Collect all system metrics
   */
  async collectMetrics() {
    if (!redisService.isAvailable()) {
      logger.warn('HealthMonitor: Redis not available - skipping metrics collection');
      return;
    }

    const timestamp = Date.now();

    // Emergency memory management - clear all metrics if memory usage > 95%
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;

    if (memoryUsagePercent > 0.95) {
      logger.warn('🚨 Emergency memory management: Clearing all metrics due to high memory usage', {
        memoryUsage: `${(memoryUsagePercent * 100).toFixed(1)}%`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      });

      // Use the dedicated clearMetrics method
      await this.clearMetrics();

      return; // Skip normal collection this cycle
    }

    // Collect database metrics
    const dbMetrics = await this.collectDatabaseMetrics();
    const existingDbMetrics = (await redisService.get('health:database:metrics')) || [];
    existingDbMetrics.push({ timestamp, ...dbMetrics });
    await redisService.set('health:database:metrics', existingDbMetrics, 7200);

    // Collect system metrics
    const sysMetrics = await this.collectSystemMetrics();
    const existingSysMetrics = (await redisService.get('health:system:metrics')) || [];
    existingSysMetrics.push({ timestamp, ...sysMetrics });
    await redisService.set('health:system:metrics', existingSysMetrics, 7200);

    // Clean up old metrics (keep last 2 hours)
    await this.cleanupOldMetrics();
  }

  /**
   * Collect database performance metrics
   */
  async collectDatabaseMetrics() {
    const startTime = Date.now();
    let connectionTime = 0;
    let isConnected = false;
    let collectionsCount = 0;
    let documentsCount = 0;
    let indexCount = 0;

    try {
      // Test database connection
      await connectMongoose();
      connectionTime = Date.now() - startTime;
      isConnected = mongoose.connection.readyState === 1;

      if (isConnected) {
        // Get database statistics
        const db = mongoose.connection.db;
        const stats = await db.stats();
        
        collectionsCount = stats.collections || 0;
        documentsCount = stats.objects || 0;
        indexCount = stats.indexes || 0;
      }
    } catch (error) {
      logger.error('Error getting database metrics:', error);
      logger.error('Error connecting to database:', error);
      return {
        connectionTime: Date.now() - startTime,
        isConnected: false,
        collectionsCount: 0,
        documentsCount: 0,
        indexCount: 0,
        connectionState: mongoose.connection.readyState
      };
    }

    return {
      connectionTime,
      isConnected,
      collectionsCount,
      documentsCount,
      indexCount,
      connectionState: mongoose.connection.readyState
    };
  }

  /**
   * Collect system performance metrics
   */
  async collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        usage: memUsage.heapUsed / memUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        usage: (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds
      },
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform
    };
  }

  /**
   * Record API response time
   */
  async recordApiResponseTime(endpoint, method, responseTime, statusCode) {
    if (!redisService.isAvailable()) {
      return;
    }

    const key = `health:api:response:${method.toUpperCase()}:${endpoint}`;
    const timestamp = Date.now();

    // Get existing entries, add new one, keep last 100
    const entries = (await redisService.get(key)) || [];
    entries.push({
      timestamp,
      responseTime,
      statusCode
    });

    // Keep only last 100 entries
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }

    await redisService.set(key, entries, 7200);
  }

  /**
   * Record error occurrence
   */
  async recordError(endpoint, method, errorType, errorMessage) {
    if (!redisService.isAvailable()) {
      return;
    }

    const key = `health:errors:${method.toUpperCase()}:${endpoint}`;
    const timestamp = Date.now();

    // Get existing entries, add new one, keep last 100
    const entries = (await redisService.get(key)) || [];
    entries.push({
      timestamp,
      errorType,
      errorMessage
    });

    // Keep only last 100 entries
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }

    await redisService.set(key, entries, 7200);

    // Temporary logging to debug high memory usage
    if (errorMessage.includes('Unauthorized')) {
      logger.error(`Unauthorized error recorded for endpoint: ${endpoint}, method: ${method}`);
    }
  }

  /**
   * Get current health status
   */
  async getHealthStatus() {
    if (!redisService.isAvailable()) {
      logger.warn('HealthMonitor: Redis not available - returning limited health status');
      return {
        status: 'unknown',
        timestamp: new Date(),
        database: null,
        system: null,
        api: {},
        errors: {},
        alerts: []
      };
    }

    const now = Date.now();
    const lastHour = now - 60 * 60 * 1000;

    // Get latest database metrics from Redis
    const dbMetricsData = await redisService.get('health:database:metrics');
    let latestDbMetrics = null;
    if (dbMetricsData && Array.isArray(dbMetricsData)) {
      // Get the most recent entry
      latestDbMetrics = dbMetricsData
        .filter(m => m.timestamp >= lastHour)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
    }

    // Get latest system metrics from Redis
    const sysMetricsData = await redisService.get('health:system:metrics');
    let latestSysMetrics = null;
    if (sysMetricsData && Array.isArray(sysMetricsData)) {
      // Get the most recent entry
      latestSysMetrics = sysMetricsData
        .filter(m => m.timestamp >= lastHour)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
    }

    // If no metrics exist yet, collect them immediately
    if (!latestDbMetrics || !latestSysMetrics) {
      logger.info('No metrics found, collecting immediately for health status');
      try {
        if (!latestDbMetrics) {
          const dbMetrics = await this.collectDatabaseMetrics();
          latestDbMetrics = { timestamp: now, ...dbMetrics };
          const existingDbMetrics = (await redisService.get('health:database:metrics')) || [];
          existingDbMetrics.push(latestDbMetrics);
          await redisService.set('health:database:metrics', existingDbMetrics, 7200);
        }

        if (!latestSysMetrics) {
          const sysMetrics = await this.collectSystemMetrics();
          latestSysMetrics = { timestamp: now, ...sysMetrics };
          const existingSysMetrics = (await redisService.get('health:system:metrics')) || [];
          existingSysMetrics.push(latestSysMetrics);
          await redisService.set('health:system:metrics', existingSysMetrics, 7200);
        }
      } catch (error) {
        logger.error('Error collecting immediate metrics:', error);
      }
    }

    // Calculate API response time averages
    const apiMetrics = await this.calculateApiMetrics(lastHour);

    // Calculate error rates
    const errorMetrics = await this.calculateErrorMetrics(lastHour);

    // Determine overall health
    const healthStatus = this.determineHealthStatus(latestDbMetrics, latestSysMetrics, apiMetrics, errorMetrics);

    return {
      status: healthStatus,
      timestamp: new Date(now),
      database: latestDbMetrics,
      system: latestSysMetrics,
      api: apiMetrics,
      errors: errorMetrics,
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Calculate API metrics for a time period
   */
  async calculateApiMetrics(since) {
    if (!redisService.isAvailable()) {
      return {};
    }

    const apiMetrics = {};

    // Get all API response time keys
    const keys = await redisService.keys('health:api:response:*');

    for (const key of keys) {
      const entries = await redisService.get(key);
      if (!entries || !Array.isArray(entries)) continue;

      // Filter entries since the given timestamp
      const recentEntries = entries.filter(entry => entry.timestamp >= since);

      if (recentEntries.length > 0) {
        const responseTimes = recentEntries.map(entry => entry.responseTime);
        const statusCodes = recentEntries.reduce((acc, entry) => {
          acc[Math.floor(entry.statusCode / 100) * 100] = (acc[Math.floor(entry.statusCode / 100) * 100] || 0) + 1;
          return acc;
        }, {});

        // Extract endpoint name from key (health:api:response:METHOD:endpoint)
        const endpoint = key.replace('health:api:response:', '');

        apiMetrics[endpoint] = {
          requestCount: recentEntries.length,
          avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          minResponseTime: Math.min(...responseTimes),
          maxResponseTime: Math.max(...responseTimes),
          statusCodes
        };
      }
    }

    return apiMetrics;
  }

  /**
   * Calculate error metrics for a time period
   */
  async calculateErrorMetrics(since) {
    if (!redisService.isAvailable()) {
      return {};
    }

    const errorMetrics = {};

    // Get all error keys
    const keys = await redisService.keys('health:errors:*');

    for (const key of keys) {
      const entries = await redisService.get(key);
      if (!entries || !Array.isArray(entries)) continue;

      // Filter entries since the given timestamp
      const recentErrors = entries.filter(entry => entry.timestamp >= since);

      if (recentErrors.length > 0) {
        const errorTypes = recentErrors.reduce((acc, entry) => {
          acc[entry.errorType] = (acc[entry.errorType] || 0) + 1;
          return acc;
        }, {});

        // Extract endpoint name from key (health:errors:METHOD:endpoint)
        const endpoint = key.replace('health:errors:', '');

        errorMetrics[endpoint] = {
          errorCount: recentErrors.length,
          errorTypes,
          latestError: recentErrors[recentErrors.length - 1]
        };
      }
    }

    return errorMetrics;
  }

  /**
   * Determine overall health status
   */
  determineHealthStatus(dbMetrics, sysMetrics, apiMetrics, errorMetrics) {
    const issues = [];
    
    // Check database health
    if (dbMetrics) {
      if (!dbMetrics.isConnected) {
        issues.push('Database disconnected');
      } else if (dbMetrics.connectionTime > this.alertThresholds.databaseConnectionTime) {
        issues.push('Database connection slow');
      }
    }
    
    // Check system health
    if (sysMetrics) {
      if (sysMetrics.memory.usage > this.alertThresholds.memoryUsage) {
        issues.push('High memory usage');
      }
    }
    
    // Check API health
    for (const [endpoint, metrics] of Object.entries(apiMetrics)) {
      if (metrics.avgResponseTime > this.alertThresholds.apiResponseTime) {
        issues.push(`Slow API response: ${endpoint}`);
      }
    }
    
    // Check error rates
    for (const [endpoint, metrics] of Object.entries(errorMetrics)) {
      const apiRequestCount = apiMetrics[endpoint]?.requestCount || 0;
      if (apiRequestCount > 0) {
        const errorRate = metrics.errorCount / apiRequestCount;
        if (errorRate > this.alertThresholds.errorRate) {
          issues.push(`High error rate: ${endpoint}`);
        }
      }
    }
    
    if (issues.length === 0) return 'healthy';
    if (issues.length <= 2) return 'warning';
    return 'critical';
  }

  /**
   * Check for alerts and trigger callbacks
   */
  async checkAlerts() {
    const healthStatus = await this.getHealthStatus();
    const alerts = [];
    
    // Database alerts
    if (healthStatus.database) {
      if (!healthStatus.database.isConnected) {
        alerts.push({
          type: 'critical',
          category: 'database',
          message: 'Database connection lost',
          timestamp: new Date()
        });
      } else if (healthStatus.database.connectionTime > this.alertThresholds.databaseConnectionTime) {
        alerts.push({
          type: 'warning',
          category: 'database',
          message: `Database connection slow: ${healthStatus.database.connectionTime}ms`,
          timestamp: new Date()
        });
      }
    }
    
    // System alerts
    if (healthStatus.system) {
      if (healthStatus.system.memory.usage > this.alertThresholds.memoryUsage) {
        alerts.push({
          type: 'warning',
          category: 'system',
          message: `High memory usage: ${(healthStatus.system.memory.usage * 100).toFixed(1)}%`,
          timestamp: new Date()
        });
      }
    }
    
    // API alerts
    for (const [endpoint, metrics] of Object.entries(healthStatus.api)) {
      if (metrics.avgResponseTime > this.alertThresholds.apiResponseTime) {
        alerts.push({
          type: 'warning',
          category: 'api',
          message: `Slow API response on ${endpoint}: ${metrics.avgResponseTime.toFixed(0)}ms`,
          timestamp: new Date()
        });
      }
    }
    
    // Error rate alerts
    for (const [endpoint, errorMetrics] of Object.entries(healthStatus.errors)) {
      const apiMetrics = healthStatus.api[endpoint];
      if (apiMetrics) {
        const errorRate = errorMetrics.errorCount / apiMetrics.requestCount;
        if (errorRate > this.alertThresholds.errorRate) {
          alerts.push({
            type: 'critical',
            category: 'errors',
            message: `High error rate on ${endpoint}: ${(errorRate * 100).toFixed(1)}%`,
            timestamp: new Date()
          });
        }
      }
    }
    
    // Trigger alert callbacks
    if (alerts.length > 0) {
      for (const callback of this.alertCallbacks) {
        try {
          await callback(alerts, healthStatus);
        } catch (error) {
          logger.error('Error in alert callback:', error);
        }
      }
    }
  }

  /**
   * Add alert callback
   */
  addAlertCallback(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    // This would typically be stored in a database or cache
    // For now, return empty array as alerts are handled by callbacks
    return [];
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics() {
    if (!redisService.isAvailable()) {
      return;
    }

    const cutoffTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

    // Clean database metrics
    const dbMetrics = await redisService.get('health:database:metrics');
    if (dbMetrics && Array.isArray(dbMetrics)) {
      const recentMetrics = dbMetrics.filter(m => m.timestamp >= cutoffTime);
      if (recentMetrics.length < dbMetrics.length) {
        await redisService.set('health:database:metrics', recentMetrics, 7200);
      }
    }

    // Clean system metrics
    const sysMetrics = await redisService.get('health:system:metrics');
    if (sysMetrics && Array.isArray(sysMetrics)) {
      const recentMetrics = sysMetrics.filter(m => m.timestamp >= cutoffTime);
      if (recentMetrics.length < sysMetrics.length) {
        await redisService.set('health:system:metrics', recentMetrics, 7200);
      }
    }

    // Clean API response times
    const apiKeys = await redisService.keys('health:api:response:*');
    for (const key of apiKeys) {
      const entries = await redisService.get(key);
      if (entries && Array.isArray(entries)) {
        const recentEntries = entries.filter(entry => entry.timestamp >= cutoffTime);
        if (recentEntries.length === 0) {
          await redisService.del(key);
        } else if (recentEntries.length < entries.length) {
          await redisService.set(key, recentEntries, 7200);
        }
      }
    }

    // Clean error metrics
    const errorKeys = await redisService.keys('health:errors:*');
    for (const key of errorKeys) {
      const entries = await redisService.get(key);
      if (entries && Array.isArray(entries)) {
        const recentEntries = entries.filter(entry => entry.timestamp >= cutoffTime);
        if (recentEntries.length === 0) {
          await redisService.del(key);
        } else if (recentEntries.length < entries.length) {
          await redisService.set(key, recentEntries, 7200);
        }
      }
    }
  }

  /**
   * Clear all metrics data (emergency memory management)
   */
  async clearMetrics() {
    if (!redisService.isAvailable()) {
      logger.warn('HealthMonitor: Redis not available - cannot clear metrics');
      return;
    }

    // Delete all health monitoring keys
    const allKeys = await redisService.keys('health:*');
    for (const key of allKeys) {
      await redisService.del(key);
    }

    logger.info('All monitoring metrics cleared from Redis');
  }

  /**
   * Export metrics data
   */
  async exportMetrics() {
    if (!redisService.isAvailable()) {
      return {
        apiResponseTimes: {},
        errorRates: {},
        databaseMetrics: {},
        systemMetrics: {},
        alertThresholds: this.alertThresholds,
        isMonitoring: this.isMonitoring
      };
    }

    const exported = {
      apiResponseTimes: {},
      errorRates: {},
      databaseMetrics: [],
      systemMetrics: [],
      alertThresholds: this.alertThresholds,
      isMonitoring: this.isMonitoring
    };

    // Export API response times
    const apiKeys = await redisService.keys('health:api:response:*');
    for (const key of apiKeys) {
      const endpoint = key.replace('health:api:response:', '');
      exported.apiResponseTimes[endpoint] = await redisService.get(key) || [];
    }

    // Export error rates
    const errorKeys = await redisService.keys('health:errors:*');
    for (const key of errorKeys) {
      const endpoint = key.replace('health:errors:', '');
      exported.errorRates[endpoint] = await redisService.get(key) || [];
    }

    // Export database metrics
    exported.databaseMetrics = await redisService.get('health:database:metrics') || [];

    // Export system metrics
    exported.systemMetrics = await redisService.get('health:system:metrics') || [];

    return exported;
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

export default HealthMonitor;