import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { alertManager } from '../../../../../lib/monitoring/alert-manager.js';
import { withMonitoring } from '../../../../../lib/monitoring/api-middleware.js';
import logger from '../../../../../lib/utils/logger.js';

async function patchHandler(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { alertIds, action } = await request.json();

    if (action !== 'resolve') {
      return NextResponse.json(
        { error: 'Invalid action. Only "resolve" is supported for bulk operations' },
        { status: 400 }
      );
    }

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { error: 'alertIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Limit bulk operations to prevent performance issues
    if (alertIds.length > 50) {
      return NextResponse.json(
        { error: 'Cannot resolve more than 50 alerts at once' },
        { status: 400 }
      );
    }

    logger.info(`Bulk resolving ${alertIds.length} alerts for user ${session.user.id}`);

    // Resolve alerts in parallel with concurrency limit
    const concurrencyLimit = 5; // Process 5 alerts at a time
    const resolvedAlerts = [];
    const failedAlerts = [];

    for (let i = 0; i < alertIds.length; i += concurrencyLimit) {
      const batch = alertIds.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (alertId) => {
        try {
          const resolvedAlert = await alertManager.resolveAlert(alertId, session.user.id);
          return { success: true, alertId, data: resolvedAlert };
        } catch (error) {
          logger.error(`Failed to resolve alert ${alertId}:`, error);
          return { success: false, alertId, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(result => {
        if (result.success) {
          resolvedAlerts.push(result);
        } else {
          failedAlerts.push(result);
        }
      });
    }

    const response = {
      success: true,
      message: `Bulk resolution completed: ${resolvedAlerts.length} resolved, ${failedAlerts.length} failed`,
      resolved: resolvedAlerts.length,
      failed: failedAlerts.length,
      results: {
        resolved: resolvedAlerts,
        failed: failedAlerts
      }
    };

    logger.info(`Bulk resolution completed: ${resolvedAlerts.length}/${alertIds.length} alerts resolved successfully`);

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error in bulk alert resolution:', error);
    
    return NextResponse.json(
      { error: 'Failed to bulk resolve alerts', details: error.message },
      { status: 500 }
    );
  }
}

export const PATCH = withMonitoring(patchHandler);