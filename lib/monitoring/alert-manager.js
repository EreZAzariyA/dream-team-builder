/**
 * Alert Manager
 * Handles system alerts, notifications, and escalation policies
 */

import SystemAlert from '../database/models/SystemAlert.js';
import { connectMongoose } from '../database/mongodb.js';
import logger from '../utils/logger.js';

export class AlertManager {
  constructor() {
    this.alertHandlers = new Map();
    this.notificationChannels = [];
    this.escalationRules = [];
  }

  /**
   * Initialize alert manager
   */
  async initialize() {
    await connectMongoose();
    
    // Register default alert handlers
    this.registerAlertHandler('database', this.handleDatabaseAlert.bind(this));
    this.registerAlertHandler('system', this.handleSystemAlert.bind(this));
    this.registerAlertHandler('api', this.handleApiAlert.bind(this));
    this.registerAlertHandler('errors', this.handleErrorAlert.bind(this));
    
    logger.info('Alert Manager initialized');
  }

  /**
   * Register an alert handler for a specific category
   */
  registerAlertHandler(category, handler) {
    this.alertHandlers.set(category, handler);
  }

  /**
   * Add notification channel
   */
  addNotificationChannel(channel) {
    this.notificationChannels.push(channel);
  }

  /**
   * Process alerts and store in database
   */
  async processAlerts(alerts, healthStatus) {
    const processedAlerts = [];
    
    for (const alert of alerts) {
      try {
        // Store alert in database
        const savedAlert = await SystemAlert.createAlert(
          alert.type,
          alert.category,
          alert.message,
          {
            healthStatus: healthStatus,
            metadata: alert.metadata || {}
          }
        );
        
        // Process alert with specific handler
        const handler = this.alertHandlers.get(alert.category);
        if (handler) {
          await handler(alert, healthStatus);
        }
        
        // Send notifications
        await this.sendNotifications(alert, savedAlert);
        
        processedAlerts.push(savedAlert);
      } catch (error) {
        logger.error('Error processing alert:', error);
      }
    }
    
    return processedAlerts;
  }

  /**
   * Handle database alerts
   */
  async handleDatabaseAlert(alert) {
    logger.info(`[DATABASE ALERT] ${alert.type.toUpperCase()}: ${alert.message}`);
    
    if (alert.type === 'critical') {
      // Critical database issues might need immediate attention
      logger.error('CRITICAL DATABASE ISSUE - Immediate attention required!');
      
      // You could implement automatic recovery procedures here
      // For example: attempt to reconnect, restart services, etc.
    }
  }

  /**
   * Handle system alerts
   */
  async handleSystemAlert(alert, healthStatus) {
    logger.info(`[SYSTEM ALERT] ${alert.type.toUpperCase()}: ${alert.message}`);
    
    if (alert.message.includes('memory usage') && healthStatus.system) {
      const memoryUsage = (healthStatus.system.memory.usage * 100).toFixed(1);
      logger.warn(`High memory usage detected: ${memoryUsage}%`);
      
      // Could trigger garbage collection or memory cleanup
      if (global.gc) {
        logger.info('Triggering garbage collection...');
        global.gc();
      }
    }
  }

  /**
   * Handle API alerts
   */
  async handleApiAlert(alert) {
    logger.info(`[API ALERT] ${alert.type.toUpperCase()}: ${alert.message}`);
    
    // Extract endpoint from alert message
    const endpointMatch = alert.message.match(/on (.+?):/);
    const endpoint = endpointMatch ? endpointMatch[1] : 'unknown';
    
    // Could implement automatic scaling or load balancing here
    logger.warn(`Performance degradation on endpoint: ${endpoint}`);
  }

  /**
   * Handle error alerts
   */
  async handleErrorAlert(alert) {
    logger.info(`[ERROR ALERT] ${alert.type.toUpperCase()}: ${alert.message}`);
    
    if (alert.type === 'critical') {
      // High error rates might indicate a serious issue
      logger.error('CRITICAL ERROR RATE - Service may be degraded!');
      
      // Could implement circuit breaker patterns or service isolation
    }
  }

  /**
   * Send notifications through configured channels
   */
  async sendNotifications(alert, savedAlert) {
    const notification = {
      id: savedAlert._id,
      type: alert.type,
      category: alert.category,
      message: alert.message,
      timestamp: alert.timestamp || new Date(),
      details: savedAlert.details
    };
    
    for (const channel of this.notificationChannels) {
      try {
        await channel.send(notification);
      } catch (error) {
        logger.error(`Error sending notification via ${channel.name}:`, error);
      }
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts() {
    await connectMongoose();
    return await SystemAlert.getActiveAlerts();
  }

  /**
   * Get alerts by category
   */
  async getAlertsByCategory(category, limit = 50) {
    await connectMongoose();
    return await SystemAlert.getAlertsByCategory(category, limit);
  }

  /**
   * Get critical alerts
   */
  async getCriticalAlerts() {
    await connectMongoose();
    return await SystemAlert.getCriticalAlerts();
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId, userId = null) {
    await connectMongoose();
    const alert = await SystemAlert.findById(alertId);
    if (alert) {
      await alert.resolve(userId);
      logger.info(`Alert ${alertId} resolved by ${userId || 'system'}`);
      return alert;
    }
    throw new Error('Alert not found');
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(since = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    await connectMongoose();
    
    const stats = await SystemAlert.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          count: { $sum: 1 },
          resolved: { $sum: { $cond: ['$isResolved', 1, 0] } }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          types: {
            $push: {
              type: '$_id.type',
              count: '$count',
              resolved: '$resolved'
            }
          },
          total: { $sum: '$count' },
          totalResolved: { $sum: '$resolved' }
        }
      }
    ]);
    
    const totalAlerts = await SystemAlert.countDocuments({ createdAt: { $gte: since } });
    const resolvedAlerts = await SystemAlert.countDocuments({ 
      createdAt: { $gte: since }, 
      isResolved: true 
    });
    
    return {
      total: totalAlerts,
      resolved: resolvedAlerts,
      pending: totalAlerts - resolvedAlerts,
      resolutionRate: totalAlerts > 0 ? (resolvedAlerts / totalAlerts) : 0,
      byCategory: stats
    };
  }

  /**
   * Clean up old resolved alerts
   */
  async cleanupOldAlerts(olderThanDays = 30) {
    await connectMongoose();
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    const result = await SystemAlert.deleteMany({
      isResolved: true,
      resolvedAt: { $lt: cutoffDate }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old resolved alerts`);
    return result.deletedCount;
  }
}

/**
 * Notification Channel Interface
 */
export class NotificationChannel {
  constructor(name) {
    this.name = name;
  }
  
  async send(notification) {
    throw new Error('send method must be implemented by subclass');
  }
}

/**
 * Console Notification Channel
 */
export class ConsoleNotificationChannel extends NotificationChannel {
  constructor() {
    super('console');
  }
  
  async send(notification) {
    const timestamp = notification.timestamp.toISOString();
    const type = notification.type.toUpperCase();
    const category = notification.category.toUpperCase();
    
    logger.info(`[${timestamp}] ${type} ${category}: ${notification.message}`);
    
    if (notification.details) {
      logger.info(`Details: ${JSON.stringify(notification.details, null, 2)}`);
    }
  }
}

/**
 * Email Notification Channel (placeholder - would need actual email service)
 */
export class EmailNotificationChannel extends NotificationChannel {
  constructor(emailConfig) {
    super('email');
    this.config = emailConfig;
  }
  
  async send(notification) {
    // Placeholder for email sending logic
    logger.info(`[EMAIL] Would send alert to ${this.config.recipients}: ${notification.message}`);
  }
}

// Global alert manager instance
export const alertManager = new AlertManager();

export default AlertManager;