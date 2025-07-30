import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth/config.js';
import Integration from '../../../lib/database/models/Integration.js';
import { connectMongoose } from '../../../lib/database/mongodb.js';
import { pluginManager } from '../../../lib/integrations/plugin-architecture.js';
import GitHubPlugin from '../../../lib/integrations/github-plugin.js';
import SlackPlugin from '../../../lib/integrations/slack-plugin.js';
import JiraPlugin from '../../../lib/integrations/jira-plugin.js';

// Initialize plugins
if (!pluginManager.getPlugin('github')) {
  pluginManager.registerPlugin('github', new GitHubPlugin());
}
if (!pluginManager.getPlugin('slack')) {
  pluginManager.registerPlugin('slack', new SlackPlugin());
}
if (!pluginManager.getPlugin('jira')) {
  pluginManager.registerPlugin('jira', new JiraPlugin());
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    // Get user's integrations
    const integrations = await Integration.find({ userId: session.user.id });

    // Get available plugins
    const availablePlugins = pluginManager.getAllPlugins();

    return NextResponse.json({
      success: true,
      data: {
        integrations,
        availablePlugins
      }
    });
  } catch (error) {
    console.error('Error fetching integrations:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch integrations', details: error.message, stack: error.stack },
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

    const { pluginId, name, config } = await request.json();

    if (!pluginId || !name || !config) {
      return NextResponse.json(
        { error: 'Plugin ID, name, and config are required' },
        { status: 400 }
      );
    }

    // Validate plugin exists
    const plugin = pluginManager.getPlugin(pluginId);
    if (!plugin) {
      return NextResponse.json(
        { error: `Plugin ${pluginId} not found` },
        { status: 400 }
      );
    }

    // Test the integration configuration
    try {
      const testPlugin = new plugin.constructor();
      await testPlugin.initialize(config);
    } catch (error) {
      return NextResponse.json(
        { error: 'Integration configuration test failed', details: error.message },
        { status: 400 }
      );
    }

    // Check if integration already exists
    const existingIntegration = await Integration.findOne({
      userId: session.user.id,
      pluginId,
      name
    });

    if (existingIntegration) {
      return NextResponse.json(
        { error: 'Integration with this name already exists' },
        { status: 400 }
      );
    }

    // Create new integration
    const integration = new Integration({
      userId: session.user.id,
      pluginId,
      name,
      config
    });

    await integration.save();

    return NextResponse.json({
      success: true,
      data: integration
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating integration:', error);
    return NextResponse.json(
      { error: 'Failed to create integration', details: error.message },
      { status: 500 }
    );
  }
}