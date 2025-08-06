/**
 * System Health Monitor
 * Tracks database performance, API response times, error rates, and system metrics
 */

import { connectMongoose } from '../database/mongodb.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export class HealthMonitor {
  constructor() {
    this.metrics = {
      apiResponseTimes: new Map(),
      errorRates: new Map(),
      databaseMetrics: new Map(),
      systemMetrics: new Map()
    };
    this.alertThresholds = {
      apiResponseTime: 5000, // 5 seconds
      errorRate: 0.05, // 5%
      databaseConnectionTime: 1000, // 1 second
      memoryUsage: 0.85, // 85%
      cpuUsage: 0.80 // 80%
    };
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.alertCallbacks = [];
  }

  /**
   * Start monitoring system health
   */
  startMonitoring(intervalMs = 60000) { // Default: 1 minute
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
    const timestamp = new Date();
    
    // Collect database metrics
    const dbMetrics = await this.collectDatabaseMetrics();
    this.metrics.databaseMetrics.set(timestamp, dbMetrics);

    // Collect system metrics
    const sysMetrics = await this.collectSystemMetrics();
    this.metrics.systemMetrics.set(timestamp, sysMetrics);

    // Clean up old metrics (keep last 24 hours)
    this.cleanupOldMetrics();
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
  recordApiResponseTime(endpoint, method, responseTime, statusCode) {
    const key = `${method.toUpperCase()} ${endpoint}`;
    const timestamp = new Date();
    
    if (!this.metrics.apiResponseTimes.has(key)) {
      this.metrics.apiResponseTimes.set(key, []);
    }
    
    this.metrics.apiResponseTimes.get(key).push({
      timestamp,
      responseTime,
      statusCode
    });

    // Keep only last 1000 entries per endpoint
    const entries = this.metrics.apiResponseTimes.get(key);
    if (entries.length > 1000) {
      entries.splice(0, entries.length - 1000);
    }
  }

  /**
   * Record error occurrence
   */
  recordError(endpoint, method, errorType, errorMessage) {
    const key = `${method.toUpperCase()} ${endpoint}`;
    const timestamp = new Date();
    
    if (!this.metrics.errorRates.has(key)) {
      this.metrics.errorRates.set(key, []);
    }
    
    this.metrics.errorRates.get(key).push({
      timestamp,
      errorType,
      errorMessage
    });

    // Keep only last 1000 entries per endpoint
    const entries = this.metrics.errorRates.get(key);
    if (entries.length > 1000) {
      entries.splice(0, entries.length - 1000);
    }
  }

  /**
   * Get current health status
   */
  async getHealthStatus() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get latest metrics
    const latestDbMetrics = Array.from(this.metrics.databaseMetrics.entries())
      .sort(([a], [b]) => b - a)[0]?.[1];
    
    const latestSysMetrics = Array.from(this.metrics.systemMetrics.entries())
      .sort(([a], [b]) => b - a)[0]?.[1];

    // Calculate API response time averages
    const apiMetrics = this.calculateApiMetrics(lastHour);
    
    // Calculate error rates
    const errorMetrics = this.calculateErrorMetrics(lastHour);

    // Determine overall health
    const healthStatus = this.determineHealthStatus(latestDbMetrics, latestSysMetrics, apiMetrics, errorMetrics);

    return {
      status: healthStatus,
      timestamp: now,
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
  calculateApiMetrics(since) {
    const apiMetrics = {};
    
    for (const [endpoint, entries] of this.metrics.apiResponseTimes.entries()) {
      const recentEntries = entries.filter(entry => entry.timestamp >= since);
      
      if (recentEntries.length > 0) {
        const responseTimes = recentEntries.map(entry => entry.responseTime);
        const statusCodes = recentEntries.reduce((acc, entry) => {
          acc[Math.floor(entry.statusCode / 100) * 100] = (acc[Math.floor(entry.statusCode / 100) * 100] || 0) + 1;
          return acc;
        }, {});

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
  calculateErrorMetrics(since) {
    const errorMetrics = {};
    
    for (const [endpoint, entries] of this.metrics.errorRates.entries()) {
      const recentErrors = entries.filter(entry => entry.timestamp >= since);
      
      if (recentErrors.length > 0) {
        const errorTypes = recentErrors.reduce((acc, entry) => {
          acc[entry.errorType] = (acc[entry.errorType] || 0) + 1;
          return acc;
        }, {});

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
  cleanupOldMetrics() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean database metrics
    for (const [timestamp] of this.metrics.databaseMetrics.entries()) {
      if (timestamp < cutoffTime) {
        this.metrics.databaseMetrics.delete(timestamp);
      }
    }
    
    // Clean system metrics
    for (const [timestamp] of this.metrics.systemMetrics.entries()) {
      if (timestamp < cutoffTime) {
        this.metrics.systemMetrics.delete(timestamp);
      }
    }
    
    // Clean API response times
    for (const [endpoint, entries] of this.metrics.apiResponseTimes.entries()) {
      const recentEntries = entries.filter(entry => entry.timestamp >= cutoffTime);
      this.metrics.apiResponseTimes.set(endpoint, recentEntries);
    }
    
    // Clean error metrics  
    for (const [endpoint, entries] of this.metrics.errorRates.entries()) {
      const recentEntries = entries.filter(entry => entry.timestamp >= cutoffTime);
      this.metrics.errorRates.set(endpoint, recentEntries);
    }
  }

  /**
   * Export metrics data
   */
  exportMetrics() {
    return {
      apiResponseTimes: Object.fromEntries(this.metrics.apiResponseTimes),
      errorRates: Object.fromEntries(this.metrics.errorRates),
      databaseMetrics: Object.fromEntries(this.metrics.databaseMetrics),
      systemMetrics: Object.fromEntries(this.metrics.systemMetrics),
      alertThresholds: this.alertThresholds,
      isMonitoring: this.isMonitoring
    };
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

export default HealthMonitor;