import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import { alertManager } from '../../../../../lib/monitoring/alert-manager.js';
import { withMonitoring } from '../../../../../lib/monitoring/api-middleware.js';

async function patchHandler(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    const resolvedParams = await params;

    if (action === 'resolve') {
      const resolvedAlert = await alertManager.resolveAlert(resolvedParams.id, session.user.id);
      
      return NextResponse.json({
        success: true,
        data: resolvedAlert,
        message: 'Alert resolved successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: resolve' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating alert:', error);
    
    if (error.message === 'Alert not found') {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update alert', details: error.message },
      { status: 500 }
    );
  }
}

export const PATCH = withMonitoring(patchHandler);