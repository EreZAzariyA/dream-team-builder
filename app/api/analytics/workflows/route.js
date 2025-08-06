
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import WorkflowAnalytics from '../../../../lib/database/models/WorkflowAnalytics.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const analytics = await WorkflowAnalytics.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgDuration: { $avg: "$duration" },
        },
      },
    ]);

    const totalWorkflows = await WorkflowAnalytics.countDocuments();

    const stats = {
      totalWorkflows,
      byStatus: analytics,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching workflow analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow analytics', details: error.message },
      { status: 500 }
    );
  }
}
