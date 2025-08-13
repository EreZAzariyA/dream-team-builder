import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import Workflow from '../../../../lib/database/models/Workflow.js';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    // Get all workflows in database
    const allWorkflows = await Workflow.find({})
      .select('workflowId title _id userId status createdAt')
      .sort({ createdAt: -1 })
      .limit(20);

    // Get count
    const totalCount = await Workflow.countDocuments();

    return NextResponse.json({
      success: true,
      totalWorkflows: totalCount,
      workflows: allWorkflows.map(w => ({
        id: w._id,
        workflowId: w.workflowId,
        title: w.title,
        userId: w.userId,
        status: w.status,
        createdAt: w.createdAt
      }))
    });

  } catch (error) {
    console.error('Database debug error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}