import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import { healthMonitor } from '../../../../lib/monitoring/health-monitor.js';
import { alertManager } from '../../../../lib/monitoring/alert-manager.js';
import { withMonitoring } from '../../../../lib/monitoring/api-middleware.js';

async function handler(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '24h';
    
    // Calculate time range
    let since;
    switch (period) {
      case '1h':
        since = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '6h':
        since = new Date(Date.now() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Get current health status
    const healthStatus = await healthMonitor.getHealthStatus();
    
    // Get alert statistics
    const alertStats = await alertManager.getAlertStats(since);
    
    // Export metrics data
    const metricsData = healthMonitor.exportMetrics();
    
    // Calculate performance summaries
    const performanceSummary = calculatePerformanceSummary(metricsData, since);
    
    return NextResponse.json({
      success: true,
      data: {
        period,
        since: since.toISOString(),
        current: {
          status: healthStatus.status,
          timestamp: healthStatus.timestamp,
          database: healthStatus.database,
          system: healthStatus.system,
          isMonitoring: metricsData.isMonitoring
        },
        performance: performanceSummary,
        alerts: alertStats,
        uptime: process.uptime(),
        monitoring: {
          alertThresholds: metricsData.alertThresholds,
          activeMetrics: {
            apiEndpoints: Object.keys(metricsData.apiResponseTimes).length,
            errorEndpoints: Object.keys(metricsData.errorRates).length,
            databaseSamples: Object.keys(metricsData.databaseMetrics).length,
            systemSamples: Object.keys(metricsData.systemMetrics).length
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching monitoring stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring statistics', details: error.message },
      { status: 500 }
    );
  }
}

function calculatePerformanceSummary(metricsData, since) {
  const summary = {
    api: {
      totalEndpoints: 0,
      avgResponseTime: 0,
      slowestEndpoint: null,
      fastestEndpoint: null,
      totalRequests: 0
    },
    errors: {
      totalErrors: 0,
      errorRate: 0,
      topErrorEndpoints: []
    },
    database: {
      avgConnectionTime: 0,
      samples: 0,
      isConnected: false
    },
    system: {
      avgMemoryUsage: 0,
      peakMemoryUsage: 0,
      samples: 0
    }
  };

  // Calculate API metrics
  const apiEndpoints = Object.entries(metricsData.apiResponseTimes);
  summary.api.totalEndpoints = apiEndpoints.length;
  
  let totalResponseTime = 0;
  let totalRequests = 0;
  let slowestTime = 0;
  let fastestTime = Infinity;
  let slowestEndpoint = null;
  let fastestEndpoint = null;

  for (const [endpoint, entries] of apiEndpoints) {
    const recentEntries = entries.filter(entry => new Date(entry.timestamp) >= since);
    totalRequests += recentEntries.length;
    
    if (recentEntries.length > 0) {
      const responseTimes = recentEntries.map(entry => entry.responseTime);
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);
      
      totalResponseTime += avgTime * recentEntries.length;
      
      if (maxTime > slowestTime) {
        slowestTime = maxTime;
        slowestEndpoint = { endpoint, time: maxTime };
      }
      
      if (minTime < fastestTime) {
        fastestTime = minTime;
        fastestEndpoint = { endpoint, time: minTime };
      }
    }
  }

  summary.api.totalRequests = totalRequests;
  summary.api.avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
  summary.api.slowestEndpoint = slowestEndpoint;
  summary.api.fastestEndpoint = fastestTime !== Infinity ? fastestEndpoint : null;

  // Calculate error metrics
  const errorEndpoints = Object.entries(metricsData.errorRates);
  let totalErrors = 0;
  const errorCounts = [];

  for (const [endpoint, entries] of errorEndpoints) {
    const recentEntries = entries.filter(entry => new Date(entry.timestamp) >= since);
    totalErrors += recentEntries.length;
    
    if (recentEntries.length > 0) {
      errorCounts.push({ endpoint, count: recentEntries.length });
    }
  }

  summary.errors.totalErrors = totalErrors;
  summary.errors.errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  summary.errors.topErrorEndpoints = errorCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate database metrics
  const dbEntries = Object.entries(metricsData.databaseMetrics);
  const recentDbEntries = dbEntries.filter(([timestamp]) => new Date(timestamp) >= since);
  
  if (recentDbEntries.length > 0) {
    const connectionTimes = recentDbEntries.map(([, metrics]) => metrics.connectionTime);
    summary.database.avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
    summary.database.samples = recentDbEntries.length;
    summary.database.isConnected = recentDbEntries[recentDbEntries.length - 1][1].isConnected;
  }

  // Calculate system metrics
  const sysEntries = Object.entries(metricsData.systemMetrics);
  const recentSysEntries = sysEntries.filter(([timestamp]) => new Date(timestamp) >= since);
  
  if (recentSysEntries.length > 0) {
    const memoryUsages = recentSysEntries.map(([, metrics]) => metrics.memory.usage);
    summary.system.avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
    summary.system.peakMemoryUsage = Math.max(...memoryUsages);
    summary.system.samples = recentSysEntries.length;
  }

  return summary;
}

export const GET = withMonitoring(handler);