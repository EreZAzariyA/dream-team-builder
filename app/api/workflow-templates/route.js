
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth/config.js';
import WorkflowTemplate from '../../../lib/database/models/WorkflowTemplate.js';
import { connectMongoose } from '../../../lib/database/mongodb.js';

export async function GET(request) {
  try {
    await connectMongoose();
    const templates = await WorkflowTemplate.find({});
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    console.error('Error fetching workflow templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow templates', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();
    const body = await request.json();
    const { name, description, sequence } = body;

    if (!name || !sequence || sequence.length === 0) {
      return NextResponse.json(
        { error: 'Name and sequence are required' },
        { status: 400 }
      );
    }

    const newTemplate = new WorkflowTemplate({
      name,
      description,
      sequence,
      createdBy: session.user.id,
    });

    await newTemplate.save();
    return NextResponse.json({ success: true, data: newTemplate }, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow template:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow template', details: error.message },
      { status: 500 }
    );
  }
}
