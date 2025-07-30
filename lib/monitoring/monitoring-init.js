/**
 * Monitoring System Initialization
 * Sets up health monitoring, alert management, and notification channels
 */

import { healthMonitor } from './health-monitor.js';
import { alertManager, ConsoleNotificationChannel } from './alert-manager.js';

let isInitialized = false;

/**
 * Initialize the complete monitoring system
 */
export async function initializeMonitoring(config = {}) {
  if (isInitialized) {
    console.log('Monitoring system already initialized');
    return;
  }

  try {
    console.log('Initializing monitoring system...');

    // Initialize alert manager
    await alertManager.initialize();

    // Add notification channels
    const consoleChannel = new ConsoleNotificationChannel();
    alertManager.addNotificationChannel(consoleChannel);

    // Register health monitor alert callback
    healthMonitor.addAlertCallback(async (alerts, healthStatus) => {
      await alertManager.processAlerts(alerts, healthStatus);
    });

    // Configure monitoring intervals
    const monitoringInterval = config.monitoringInterval || 60000; // 1 minute default
    
    // Start health monitoring
    healthMonitor.startMonitoring(monitoringInterval);

    // Set up cleanup intervals
    setupCleanupTasks(config);

    isInitialized = true;
    console.log('Monitoring system initialized successfully');

    // Log initial health status
    const initialHealth = await healthMonitor.getHealthStatus();
    console.log(`Initial system status: ${initialHealth.status}`);

  } catch (error) {
    console.error('Failed to initialize monitoring system:', error);
    throw error;
  }
}

/**
 * Setup cleanup tasks for old data
 */
function setupCleanupTasks(config) {
  const cleanupInterval = config.cleanupInterval || 24 * 60 * 60 * 1000; // 24 hours default
  const alertRetentionDays = config.alertRetentionDays || 30;

  setInterval(async () => {
    try {
      console.log('Running monitoring cleanup tasks...');
      
      // Clean up old metrics (handled automatically by health monitor)
      console.log('Cleaned up old metrics data');
      
      // Clean up old resolved alerts
      const deletedCount = await alertManager.cleanupOldAlerts(alertRetentionDays);
      console.log(`Cleaned up ${deletedCount} old resolved alerts`);
      
    } catch (error) {
      console.error('Error during cleanup tasks:', error);
    }
  }, cleanupInterval);
}

/**
 * Shutdown monitoring system gracefully
 */
export function shutdownMonitoring() {
  if (!isInitialized) {
    return;
  }

  console.log('Shutting down monitoring system...');
  
  try {
    // Stop health monitoring
    healthMonitor.stopMonitoring();
    
    isInitialized = false;
    console.log('Monitoring system shut down successfully');
  } catch (error) {
    console.error('Error during monitoring shutdown:', error);
  }
}

/**
 * Get monitoring system status
 */
export function getMonitoringStatus() {
  return {
    initialized: isInitialized,
    healthMonitorActive: healthMonitor.isMonitoring,
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform
  };
}

// Initialize monitoring on module load in production
if (process.env.NODE_ENV === 'production') {
  initializeMonitoring().catch(error => {
    console.error('Failed to auto-initialize monitoring:', error);
  });
}

export default { initializeMonitoring, shutdownMonitoring, getMonitoringStatus };