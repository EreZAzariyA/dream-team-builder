import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth/config.js';
import Integration from '../../../../../lib/database/models/Integration.js';
import { User } from '../../../../../lib/database/models/index.js';
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
    const resolvedParams = await params;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Get the integration
    const integration = await Integration.findOne({
      _id: resolvedParams.id,
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

    // Get user context for OAuth tokens
    const user = await User.findById(session.user.id);
    const userContext = {
      githubAccessToken: user?.githubAccessToken,
      googleId: user?.googleId,
      githubId: user?.githubId
    };

    // Create a new instance of the plugin with the integration's config
    const plugin = new pluginTemplate.constructor();
    await plugin.initialize(integration.config, userContext);

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
    console.error('Error executing integration action:', error?.message || JSON.stringify(error));
    
    // Check for token expiration specifically
    if (error.message === 'GITHUB_TOKEN_EXPIRED') {
      return NextResponse.json(
        { 
          error: 'GitHub token expired', 
          details: 'Your GitHub OAuth token has expired. Please reconnect your GitHub account.',
          type: 'token_expired',
          suggestion: 'Go to integrations page and reconnect your GitHub account.',
          action: 'reconnect_github'
        },
        { status: 401 }
      );
    }
    
    // Check for other authentication errors
    if (error.message.includes('Requires authentication') || 
        error.message.includes('authentication') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('401')) {
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: error.message,
          type: 'authentication_error',
          suggestion: 'Please check your integration configuration and ensure valid credentials are provided.'
        },
        { status: 401 }
      );
    }
    
    // Check for configuration errors
    if (error.message.includes('configuration') || 
        error.message.includes('config')) {
      return NextResponse.json(
        { 
          error: 'Configuration error', 
          details: error.message,
          type: 'configuration_error',
          suggestion: 'Please verify your integration settings and try again.'
        },
        { status: 400 }
      );
    }
    
    // Generic error response
    return NextResponse.json(
      { 
        error: 'Failed to execute integration action', 
        details: error.message,
        type: 'execution_error'
      },
      { status: 500 }
    );
  }
}