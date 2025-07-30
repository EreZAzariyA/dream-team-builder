import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import Integration from '../../../../../lib/database/models/Integration.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import { pluginManager } from '../../../../../lib/integrations/plugin-architecture.js';
import GitHubPlugin from '../../../../../lib/integrations/github-plugin.js';
import SlackPlugin from '../../../../../lib/integrations/slack-plugin.js';
import JiraPlugin from '../../../../../lib/integrations/jira-plugin.js';

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

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const { action, data } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Get the integration
    const integration = await Integration.findOne({
      _id: params.id,
      userId: session.user.id,
      isActive: true
    });

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found or inactive' }, { status: 404 });
    }

    // Get and initialize the plugin
    const pluginTemplate = pluginManager.getPlugin(integration.pluginId);
    if (!pluginTemplate) {
      return NextResponse.json(
        { error: `Plugin ${integration.pluginId} not found` },
        { status: 500 }
      );
    }

    // Create a new instance of the plugin with the integration's config
    const plugin = new pluginTemplate.constructor();
    await plugin.initialize(integration.config);

    // Execute the action
    const result = await pluginManager.executePluginAction(integration.pluginId, action, data);

    // Update last used timestamp
    integration.lastUsed = new Date();
    await integration.save();

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error executing integration action:', error);
    return NextResponse.json(
      { error: 'Failed to execute integration action', details: error.message },
      { status: 500 }
    );
  }
}