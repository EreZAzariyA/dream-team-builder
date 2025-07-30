/**
 * Slack Integration Plugin
 * Provides Slack messaging integration for workflow notifications and team communication
 */

import { BasePlugin } from './plugin-architecture.js';

export class SlackPlugin extends BasePlugin {
  constructor() {
    super('Slack Integration', '1.0.0', 'Send notifications and messages to Slack channels');
    
    this.baseUrl = 'https://slack.com/api';
    this.headers = {};
    
    // Register available actions
    this.registerAction('sendMessage', this.sendMessage);
    this.registerAction('sendWorkflowNotification', this.sendWorkflowNotification);
    this.registerAction('createChannel', this.createChannel);
    this.registerAction('inviteToChannel', this.inviteToChannel);
    this.registerAction('uploadFile', this.uploadFile);
    this.registerAction('getChannels', this.getChannels);
    this.registerAction('getUsers', this.getUsers);
  }

  async initialize(config) {
    await super.initialize(config);
    
    // Validate required configuration
    this.validateConfig(['botToken']);
    
    // Set up authentication headers
    this.headers = {
      'Authorization': `Bearer ${this.config.botToken}`,
      'Content-Type': 'application/json'
    };
    
    // Test the connection
    try {
      await this.testConnection();
      console.log('Slack plugin initialized successfully');
    } catch (error) {
      throw new Error(`Slack plugin initialization failed: ${error.message}`);
    }
  }

  /**
   * Test Slack API connection
   */
  async testConnection() {
    const response = await fetch(`${this.baseUrl}/auth.test`, {
      headers: this.headers
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Slack API test failed: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Send a message to a Slack channel or user
   */
  async sendMessage(data) {
    const { channel, text, blocks, attachments, thread_ts } = data;
    
    const payload = {
      channel,
      text,
      ...(blocks && { blocks }),
      ...(attachments && { attachments }),
      ...(thread_ts && { thread_ts })
    };
    
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Failed to send message: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Send workflow notification with rich formatting
   */
  async sendWorkflowNotification(data) {
    const { 
      channel, 
      workflowId, 
      workflowName, 
      status, 
      duration, 
      artifactCount, 
      userPrompt,
      errorMessage 
    } = data;
    
    // Determine color based on status
    const colorMap = {
      'COMPLETED': 'good',
      'ERROR': 'danger',
      'CANCELLED': 'warning',
      'RUNNING': '#2196F3'
    };
    
    const color = colorMap[status] || '#808080';
    
    // Build status emoji
    const statusEmoji = {
      'COMPLETED': '✅',
      'ERROR': '❌',
      'CANCELLED': '⚠️',
      'RUNNING': '🔄'
    };
    
    const emoji = statusEmoji[status] || '📋';
    
    // Format duration
    const formatDuration = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) return `${hours}h ${minutes % 60}m`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    };
    
    // Build attachment
    const attachment = {
      color,
      title: `${emoji} Workflow ${status.toLowerCase()}`,
      fields: [
        {
          title: 'Workflow Name',
          value: workflowName,
          short: true
        },
        {
          title: 'Workflow ID',
          value: `\`${workflowId}\``,
          short: true
        }
      ],
      footer: 'BMAD Workflow System',
      ts: Math.floor(Date.now() / 1000)
    };
    
    // Add duration if available
    if (duration) {
      attachment.fields.push({
        title: 'Duration',
        value: formatDuration(duration),
        short: true
      });
    }
    
    // Add artifact count if available
    if (artifactCount !== undefined) {
      attachment.fields.push({
        title: 'Artifacts Generated',
        value: artifactCount.toString(),
        short: true
      });
    }
    
    // Add user prompt if available
    if (userPrompt) {
      attachment.fields.push({
        title: 'Initial Prompt',
        value: userPrompt.length > 100 ? `${userPrompt.substring(0, 100)}...` : userPrompt,
        short: false
      });
    }
    
    // Add error message if available
    if (errorMessage) {
      attachment.fields.push({
        title: 'Error Details',
        value: `\`\`\`${errorMessage}\`\`\``,
        short: false
      });
    }
    
    return await this.sendMessage({
      channel,
      text: `Workflow ${status.toLowerCase()}: ${workflowName}`,
      attachments: [attachment]
    });
  }

  /**
   * Create a new channel
   */
  async createChannel(data) {
    const { name, is_private = false } = data;
    
    const response = await fetch(`${this.baseUrl}/conversations.create`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name,
        is_private
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Failed to create channel: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Invite users to a channel
   */
  async inviteToChannel(data) {
    const { channel, users } = data;
    
    const response = await fetch(`${this.baseUrl}/conversations.invite`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        channel,
        users: Array.isArray(users) ? users.join(',') : users
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Failed to invite users: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Upload a file to Slack
   */
  async uploadFile(data) {
    const { channels, content, filename, title, initial_comment } = data;
    
    const formData = new FormData();
    formData.append('channels', Array.isArray(channels) ? channels.join(',') : channels);
    formData.append('content', content);
    formData.append('filename', filename);
    
    if (title) formData.append('title', title);
    if (initial_comment) formData.append('initial_comment', initial_comment);
    
    const response = await fetch(`${this.baseUrl}/files.upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.headers.Authorization
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Failed to upload file: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Get list of channels
   */
  async getChannels(data = {}) {
    const { types = 'public_channel,private_channel', limit = 100 } = data;
    
    const response = await fetch(`${this.baseUrl}/conversations.list?types=${types}&limit=${limit}`, {
      headers: this.headers
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Failed to get channels: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Get list of users
   */
  async getUsers(data = {}) {
    const { limit = 100 } = data;
    
    const response = await fetch(`${this.baseUrl}/users.list?limit=${limit}`, {
      headers: this.headers
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Failed to get users: ${result.error}`);
    }
    
    return result;
  }

  /**
   * Send workflow artifacts as files
   */
  async sendWorkflowArtifacts(workflowId, artifacts, options = {}) {
    const { channel, workflowName } = options;
    
    if (!channel) {
      throw new Error('Slack channel is required');
    }
    
    const results = [];
    
    for (const artifact of artifacts) {
      try {
        const result = await this.uploadFile({
          channels: channel,
          content: artifact.content,
          filename: artifact.filename,
          title: `${workflowName} - ${artifact.filename}`,
          initial_comment: `Workflow artifact from ${workflowName} (ID: ${workflowId})`
        });
        
        results.push({
          success: true,
          artifact: artifact.filename,
          fileId: result.file.id
        });
      } catch (error) {
        results.push({
          success: false,
          artifact: artifact.filename,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

export default SlackPlugin;