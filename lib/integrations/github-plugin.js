/**
 * GitHub Integration Plugin
 * Provides GitHub repository integration for workflow artifacts and issue management
 */

import { BasePlugin } from './plugin-architecture.js';

export class GitHubPlugin extends BasePlugin {
  constructor() {
    super('GitHub Integration', '1.0.0', 'Integrate with GitHub repositories for artifact management and issue tracking');
    
    this.baseUrl = 'https://api.github.com';
    this.headers = {};
    
    // Register available actions
    this.registerAction('createRepository', this.createRepository);
    this.registerAction('uploadFile', this.uploadFile);
    this.registerAction('createIssue', this.createIssue);
    this.registerAction('createPullRequest', this.createPullRequest);
    this.registerAction('getRepositories', this.getRepositories);
    this.registerAction('getBranches', this.getBranches);
    this.registerAction('createCommit', this.createCommit);
  }

  async initialize(config, userContext = null) {
    await super.initialize(config);
    
    // Get token from multiple sources in priority order:
    // 1. User's OAuth token (preferred for authenticated users)
    // 2. Config token (for specific integrations)
    // 3. Environment variable (fallback for development)
    const token = userContext?.githubAccessToken || 
                  this.config.token || 
                  process.env.GITHUB_TOKEN;
    
    if (!token) {
      throw new Error('GitHub authentication required. Please sign in with GitHub or configure a token.');
    }
    
    // Set up authentication headers
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
    
    // Test the connection
    try {
      await this.testConnection();
      console.log('GitHub plugin initialized successfully');
    } catch (error) {
      throw new Error(`GitHub plugin initialization failed: ${error.message}`);
    }
  }

  /**
   * Test GitHub API connection
   */
  async testConnection() {
    const response = await fetch(`${this.baseUrl}/user`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('GitHub token expired or invalid. Please reconnect your GitHub account.');
      }
      throw new Error(`GitHub API test failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Make authenticated request with automatic token refresh handling
   */
  async makeAuthenticatedRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers
      }
    });

    // Handle token expiration
    if (response.status === 401) {
      throw new Error('GITHUB_TOKEN_EXPIRED');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response;
  }

  /**
   * Create a new repository
   */
  async createRepository(data) {
    const { name, description, private: isPrivate = false, owner } = data;
    
    const url = owner ? `${this.baseUrl}/orgs/${owner}/repos` : `${this.baseUrl}/user/repos`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create repository: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Upload file to repository
   */
  async uploadFile(data) {
    const { owner, repo, path, content, message, branch = 'main' } = data;
    
    // Get current file SHA if it exists (for updates)
    let sha = null;
    try {
      const existingFile = await this.getFile({ owner, repo, path, branch });
      sha = existingFile.sha;
    } catch (error) {
      // File doesn't exist, that's okay for new files
    }
    
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch
    };
    
    if (sha) {
      body.sha = sha;
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload file: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Get file from repository
   */
  async getFile(data) {
    const { owner, repo, path, branch = 'main' } = data;
    
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    
    const response = await fetch(url, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get file: ${error.message}`);
    }
    
    const file = await response.json();
    
    // Decode content if it's base64
    if (file.encoding === 'base64') {
      file.decodedContent = Buffer.from(file.content, 'base64').toString('utf-8');
    }
    
    return file;
  }

  /**
   * Create an issue
   */
  async createIssue(data) {
    const { owner, repo, title, body, labels = [], assignees = [] } = data;
    
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        title,
        body,
        labels,
        assignees
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create issue: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Create a pull request
   */
  async createPullRequest(data) {
    const { owner, repo, title, body, head, base = 'main', draft = false } = data;
    
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        title,
        body,
        head,
        base,
        draft
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Get user repositories
   */
  async getRepositories(data = {}) {
    const { type = 'owner', sort = 'updated', per_page = 30 } = data;
    
    const url = `${this.baseUrl}/user/repos?type=${type}&sort=${sort}&per_page=${per_page}`;
    
    const response = await this.makeAuthenticatedRequest(url);
    return await response.json();
  }

  /**
   * Get repository branches
   */
  async getBranches(data) {
    const { owner, repo } = data;
    
    const url = `${this.baseUrl}/repos/${owner}/${repo}/branches`;
    
    const response = await fetch(url, {
      headers: this.headers
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get branches: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Create a commit
   */
  async createCommit(data) {
    const { owner, repo, message, tree, parents = [] } = data;
    
    const url = `${this.baseUrl}/repos/${owner}/${repo}/git/commits`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        message,
        tree,
        parents
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create commit: ${error.message}`);
    }
    
    return await response.json();
  }

  /**
   * Upload workflow artifacts to GitHub
   */
  async uploadWorkflowArtifacts(workflowId, artifacts, options = {}) {
    const { owner, repo, branch = 'main', basePath = 'workflow-artifacts' } = options;
    
    if (!owner || !repo) {
      throw new Error('GitHub repository owner and name are required');
    }
    
    const results = [];
    
    for (const artifact of artifacts) {
      try {
        const filePath = `${basePath}/${workflowId}/${artifact.filename}`;
        const message = `Add workflow artifact: ${artifact.filename} (Workflow: ${workflowId})`;
        
        const result = await this.uploadFile({
          owner,
          repo,
          path: filePath,
          content: artifact.content,
          message,
          branch
        });
        
        results.push({
          success: true,
          artifact: artifact.filename,
          url: result.content.html_url
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

export default GitHubPlugin;