import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import Integration from '../../../../lib/database/models/Integration.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import { pluginManager } from '../../../../lib/integrations/plugin-architecture.js';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const integration = await Integration.findOne({
      _id: params.id,
      userId: session.user.id
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: integration
    });
  } catch (error) {
    console.error('Error fetching integration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration', details: error.message },
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

    const { name, config, isActive } = await request.json();

    const integration = await Integration.findOne({
      _id: params.id,
      userId: session.user.id
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Test the updated configuration if config is provided
    if (config) {
      try {
        const plugin = pluginManager.getPlugin(integration.pluginId);
        if (plugin) {
          const testPlugin = new plugin.constructor();
          await testPlugin.initialize(config);
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Integration configuration test failed', details: error.message },
          { status: 400 }
        );
      }
    }

    // Update integration
    if (name) integration.name = name;
    if (config) integration.config = config;
    if (typeof isActive === 'boolean') integration.isActive = isActive;

    await integration.save();

    return NextResponse.json({
      success: true,
      data: integration
    });
  } catch (error) {
    console.error('Error updating integration:', error);
    return NextResponse.json(
      { error: 'Failed to update integration', details: error.message },
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

    const integration = await Integration.findOneAndDelete({
      _id: params.id,
      userId: session.user.id
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting integration:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration', details: error.message },
      { status: 500 }
    );
  }
}