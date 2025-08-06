import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import { alertManager } from '../../../../lib/monitoring/alert-manager.js';
import { withMonitoring } from '../../../../lib/monitoring/api-middleware.js';

async function getHandler(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const type = url.searchParams.get('type');
    const resolved = url.searchParams.get('resolved');
    const limit = parseInt(url.searchParams.get('limit')) || 50;

    let alerts;
    
    if (type === 'critical') {
      alerts = await alertManager.getCriticalAlerts();
    } else if (category) {
      alerts = await alertManager.getAlertsByCategory(category, limit);
    } else {
      alerts = await alertManager.getActiveAlerts();
    }

    // Filter by resolved status if specified
    if (resolved !== null) {
      const isResolved = resolved === 'true';
      alerts = alerts.filter(alert => alert.isResolved === isResolved);
    }

    return NextResponse.json({
      success: true,
      data: alerts.slice(0, limit)
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts', details: error.message },
      { status: 500 }
    );
  }
}

async function postHandler(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, category, message, details } = await request.json();

    if (!type || !category || !message) {
      return NextResponse.json(
        { error: 'Type, category, and message are required' },
        { status: 400 }
      );
    }

    // Create manual alert
    const alert = await alertManager.processAlerts([{
      type,
      category,
      message,
      timestamp: new Date(),
      metadata: { 
        createdBy: session.user.id,
        manual: true,
        ...details 
      }
    }], {});

    return NextResponse.json({
      success: true,
      data: alert[0]
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert', details: error.message },
      { status: 500 }
    );
  }
}

export const GET = withMonitoring(getHandler);
export const POST = withMonitoring(postHandler);