/**
 * Monitoring System Initialization
 * Sets up health monitoring, alert management, and notification channels
 */

import { healthMonitor } from './health-monitor.js';
import { alertManager, ConsoleNotificationChannel } from './alert-manager.js';
import logger from '../utils/logger.js';

// Use global flag to prevent re-initialization across hot reloads
const MONITORING_KEY = '__DREAM_TEAM_MONITORING_INITIALIZED__';

function getIsInitialized() {
  return typeof global !== 'undefined' ? global[MONITORING_KEY] : false;
}

function setIsInitialized(value) {
  if (typeof global !== 'undefined') {
    global[MONITORING_KEY] = value;
  }
}

let cleanupInterval = null;

/**
 * Initialize the complete monitoring system
 */
export async function initializeMonitoring(config = {}) {
  if (getIsInitialized()) {
    // Silent return - this is expected behavior in serverless environments
    // No need to log every time a route checks if monitoring is initialized
    return;
  }

  try {
    logger.info('Initializing monitoring system...');

    // Initialize alert manager
    await alertManager.initialize();

    // Add notification channels
    const consoleChannel = new ConsoleNotificationChannel();
    alertManager.addNotificationChannel(consoleChannel);

    // Register health monitor alert callback
    healthMonitor.addAlertCallback(async (alerts, healthStatus) => {
      await alertManager.processAlerts(alerts, healthStatus);
    });

    // Configure monitoring intervals (increased from 1 minute to 5 minutes)
    const monitoringInterval = config.monitoringInterval || 300000; // 5 minutes default
    
    // Start health monitoring
    healthMonitor.startMonitoring(monitoringInterval);

    // Set up cleanup intervals
    setupCleanupTasks(config);

    setIsInitialized(true);
    logger.info('Monitoring system initialized successfully');

    // Log initial health status
    const initialHealth = await healthMonitor.getHealthStatus();
    logger.info(`Initial system status: ${initialHealth.status || JSON.stringify(initialHealth)}`);

  } catch (error) {
    console.error('Failed to initialize monitoring system:', error);
    throw error;
  }
}

/**
 * Setup cleanup tasks for old data
 */
function setupCleanupTasks(config) {
  const cleanupIntervalMs = config.cleanupInterval || 24 * 60 * 60 * 1000; // 24 hours default
  const alertRetentionDays = config.alertRetentionDays || 30;

  // Clear existing interval if it exists
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(async () => {
    try {
      logger.info('Running monitoring cleanup tasks...');
      
      // Clean up old metrics (handled automatically by health monitor)
      logger.info('Cleaned up old metrics data');
      
      // Clean up old resolved alerts
      const deletedCount = await alertManager.cleanupOldAlerts(alertRetentionDays);
      logger.info(`Cleaned up ${deletedCount} old resolved alerts`);
      
    } catch (error) {
      console.error('Error during cleanup tasks:', error);
    }
  }, cleanupIntervalMs);
}

/**
 * Shutdown monitoring system gracefully
 */
export function shutdownMonitoring() {
  if (!getIsInitialized()) {
    return;
  }

  logger.info('Shutting down monitoring system...');
  
  try {
    // Stop health monitoring
    healthMonitor.stopMonitoring();
    
    // Clear cleanup interval
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    
    setIsInitialized(false);
    logger.info('Monitoring system shut down successfully');
  } catch (error) {
    console.error('Error during monitoring shutdown:', error);
  }
}

/**
 * Get monitoring system status
 */
export function getMonitoringStatus() {
  return {
    initialized: getIsInitialized(),
    healthMonitorActive: healthMonitor.isMonitoring,
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform
  };
}

// Removed auto-initialization on module load to prevent re-initialization
// Monitoring is now initialized manually in database middleware

export default { initializeMonitoring, shutdownMonitoring, getMonitoringStatus };