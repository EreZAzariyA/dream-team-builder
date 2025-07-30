
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth/config.js';
import WorkflowTemplate from '../../../lib/database/models/WorkflowTemplate.js';
import { connectMongoose } from '../../../lib/database/mongodb.js';

export async function GET(request, { params }) {
  try {
    await connectMongoose();
    const { id } = params;
    const template = await WorkflowTemplate.findById(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Error fetching workflow template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow template', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();
    const { id } = params;
    const body = await request.json();
    const { name, description, sequence } = body;

    const updatedTemplate = await WorkflowTemplate.findByIdAndUpdate(
      id,
      { name, description, sequence, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedTemplate });
  } catch (error) {
    console.error('Error updating workflow template:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow template', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();
    const { id } = params;

    const deletedTemplate = await WorkflowTemplate.findByIdAndDelete(id);

    if (!deletedTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow template:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow template', details: error.message },
      { status: 500 }
    );
  }
}
