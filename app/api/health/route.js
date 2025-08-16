import { NextResponse } from 'next/server';
import { checkDatabaseHealth, getConnectionState } from '../../../lib/database/mongodb.js';
import { healthMonitor } from '../../../lib/monitoring/health-monitor.js';
import logger from '../../../lib/utils/logger.js';
import { withDatabase } from '../../../lib/api/middleware.js';

async function healthHandler() {
  try {
    // Get enhanced health status from health monitor
    const healthStatus = await healthMonitor.getHealthStatus();
    
    // Get legacy database health for compatibility
    const dbHealth = await checkDatabaseHealth();
    const connectionState = getConnectionState();
    
    // Determine overall status
    const isHealthy = healthStatus.status === 'healthy' && 
                     dbHealth.status === 'healthy' &&
                     connectionState.mongoose.readyState === 1;
    
    const enhancedHealthData = {
      status: isHealthy ? 'healthy' : healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // Enhanced monitoring data
      monitoring: {
        database: healthStatus.database,
        system: healthStatus.system,
        api: healthStatus.api,
        errors: healthStatus.errors,
        alerts: healthStatus.alerts
      },
      
      // Legacy compatibility data
      services: {
        database: dbHealth,
        connections: connectionState,
      },
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    };
    
    // Return appropriate HTTP status based on health
    let httpStatus = 200;
    if (healthStatus.status === 'warning') {
      httpStatus = 200; // Still OK, but with warnings
    } else if (healthStatus.status === 'critical' || !isHealthy) {
      httpStatus = 503; // Service unavailable
    }
    
    return NextResponse.json({
      success: true,
      data: enhancedHealthData,
      message: 'Health check completed'
    }, { status: httpStatus });
    
  } catch (error) {
    logger.error('Health check error:', error);
    
    return NextResponse.json({
      success: false,
      status: 'critical',
      error: 'Health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}

// Export the wrapped handler
export const GET = withDatabase(healthHandler);

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get system health status
 *     description: Retrieves the current health status of various system components, including database, API, and general system metrics.
 *     tags:
 *       - Monitoring
 *     responses:
 *       200:
 *         description: System is healthy or has warnings.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, warning, critical]
 *                       description: Overall health status.
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: Time of the health check.
 *                     uptime:
 *                       type: number
 *                       description: System uptime in seconds.
 *                     version:
 *                       type: string
 *                       description: Application version.
 *                     environment:
 *                       type: string
 *                       description: Current environment (e.g., development, production).
 *                     monitoring:
 *                       type: object
 *                       description: Detailed monitoring data for various services.
 *                     services:
 *                       type: object
 *                       description: Legacy service health data.
 *                     memory:
 *                       type: object
 *                       description: Memory usage statistics.
 *                     nodeVersion:
 *                       type: string
 *                       description: Node.js version.
 *       503:
 *         description: Service unavailable or critical issues detected.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: string
 *                   example: critical
 *                 error:
 *                   type: string
 *                   example: Health check failed
 *                 details:
 *                   type: string
 *                   description: Detailed error message.
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
