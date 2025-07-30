/**
 * JIRA Integration Plugin
 * Provides JIRA issue management integration for workflow tracking and project management
 */

import { BasePlugin } from './plugin-architecture.js';

export class JiraPlugin extends BasePlugin {
  constructor() {
    super('JIRA Integration', '1.0.0', 'Integrate with JIRA for issue tracking and project management');
    
    this.baseUrl = '';
    this.headers = {};
    
    // Register available actions
    this.registerAction('createIssue', this.createIssue);
    this.registerAction('updateIssue', this.updateIssue);
    this.registerAction('getIssue', this.getIssue);
    this.registerAction('searchIssues', this.searchIssues);
    this.registerAction('addComment', this.addComment);
    this.registerAction('transitionIssue', this.transitionIssue);
    this.registerAction('getProjects', this.getProjects);
    this.registerAction('getIssueTypes', this.getIssueTypes);
    this.registerAction('createWorkflowIssue', this.createWorkflowIssue);
  }

  async initialize(config) {
    await super.initialize(config);
    
    // Validate required configuration
    this.validateConfig(['domain', 'email', 'apiToken']);
    
    // Set up base URL and authentication
    this.baseUrl = `https://${this.config.domain}.atlassian.net/rest/api/3`;
    
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    this.headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    // Test the connection
    try {
      await this.testConnection();
      console.log('JIRA plugin initialized successfully');
    } catch (error) {
      throw new Error(`JIRA plugin initialization failed: ${error.message}`);
    }
  }

  /**
   * Test JIRA API connection
   */
  async testConnection() {
    const response = await fetch(`${this.baseUrl}/myself`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`JIRA API test failed: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Create a new issue
   */
  async createIssue(data) {
    const { 
      projectKey, 
      issueType, 
      summary, 
      description, 
      priority = 'Medium',
      assignee,
      labels = [],
      components = []
    } = data;
    
    const issueData = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description
                }
              ]
            }
          ]
        },
        priority: { name: priority }
      }
    };
    
    // Add assignee if provided
    if (assignee) {
      issueData.fields.assignee = { emailAddress: assignee };
    }
    
    // Add labels if provided
    if (labels.length > 0) {
      issueData.fields.labels = labels;
    }
    
    // Add components if provided
    if (components.length > 0) {
      issueData.fields.components = components.map(name => ({ name }));
    }
    
    const response = await fetch(`${this.baseUrl}/issue`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(issueData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create issue: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Update an existing issue
   */
  async updateIssue(data) {
    const { issueKey, fields } = data;
    
    const updateData = { fields };
    
    const response = await fetch(`${this.baseUrl}/issue/${issueKey}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update issue: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return { success: true };
  }

  /**
   * Get issue details
   */
  async getIssue(data) {
    const { issueKey, expand = 'names,schema,operations,editmeta,changelog,renderedFields' } = data;
    
    const response = await fetch(`${this.baseUrl}/issue/${issueKey}?expand=${expand}`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get issue: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(data) {
    const { jql, startAt = 0, maxResults = 50, fields = [] } = data;
    
    const searchData = {
      jql,
      startAt,
      maxResults,
      ...(fields.length > 0 && { fields })
    };
    
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(searchData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to search issues: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Add comment to an issue
   */
  async addComment(data) {
    const { issueKey, comment } = data;
    
    const commentData = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: comment
              }
            ]
          }
        ]
      }
    };
    
    const response = await fetch(`${this.baseUrl}/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(commentData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to add comment: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Transition an issue to a different status
   */
  async transitionIssue(data) {
    const { issueKey, transitionId, comment } = data;
    
    const transitionData = {
      transition: { id: transitionId }
    };
    
    // Add comment if provided
    if (comment) {
      transitionData.update = {
        comment: [
          {
            add: {
              body: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: comment }]
                  }
                ]
              }
            }
          }
        ]
      };
    }
    
    const response = await fetch(`${this.baseUrl}/issue/${issueKey}/transitions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(transitionData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to transition issue: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return { success: true };
  }

  /**
   * Get all projects
   */
  async getProjects() {
    const response = await fetch(`${this.baseUrl}/project`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get projects: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(data) {
    const { projectKey } = data;
    
    const response = await fetch(`${this.baseUrl}/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get issue types: ${error.errorMessages?.[0] || response.statusText}`);
    }
    
    const result = await response.json();
    const project = result.projects[0];
    return project ? project.issuetypes : [];
  }

  /**
   * Create a workflow-related issue with rich details
   */
  async createWorkflowIssue(workflowData) {
    const {
      workflowId,
      workflowName,
      status,
      userPrompt,
      artifactCount,
      duration,
      errors = [],
      projectKey,
      issueType = 'Task'
    } = workflowData;
    
    // Determine issue priority and summary based on workflow status
    let priority = 'Medium';
    let summary = '';
    let description = '';
    
    if (status === 'COMPLETED') {
      summary = `✅ Workflow Completed: ${workflowName}`;
      description = `Workflow "${workflowName}" has completed successfully.\n\n`;
      description += `**Workflow Details:**\n`;
      description += `- Workflow ID: ${workflowId}\n`;
      description += `- Initial Prompt: ${userPrompt}\n`;
      description += `- Duration: ${duration ? this.formatDuration(duration) : 'N/A'}\n`;
      description += `- Artifacts Generated: ${artifactCount || 0}\n`;
    } else if (status === 'ERROR') {
      priority = 'High';
      summary = `❌ Workflow Failed: ${workflowName}`;
      description = `Workflow "${workflowName}" has failed with errors.\n\n`;
      description += `**Workflow Details:**\n`;
      description += `- Workflow ID: ${workflowId}\n`;
      description += `- Initial Prompt: ${userPrompt}\n`;
      description += `- Duration: ${duration ? this.formatDuration(duration) : 'N/A'}\n\n`;
      
      if (errors.length > 0) {
        description += `**Errors:**\n`;
        errors.forEach((error, index) => {
          description += `${index + 1}. ${error.error} (Step: ${error.step})\n`;
        });
      }
    } else if (status === 'CANCELLED') {
      priority = 'Low';
      summary = `⚠️ Workflow Cancelled: ${workflowName}`;
      description = `Workflow "${workflowName}" was cancelled.\n\n`;
      description += `**Workflow Details:**\n`;
      description += `- Workflow ID: ${workflowId}\n`;
      description += `- Initial Prompt: ${userPrompt}\n`;
      description += `- Duration: ${duration ? this.formatDuration(duration) : 'N/A'}\n`;
    }
    
    return await this.createIssue({
      projectKey,
      issueType,
      summary,
      description,
      priority,
      labels: ['bmad-workflow', `workflow-${status.toLowerCase()}`]
    });
  }

  /**
   * Format duration from milliseconds to human readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export default JiraPlugin;