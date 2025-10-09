/**
 * Git Integration Service
 * Provides comprehensive git operations for workflow-driven development
 * Built on top of existing GitHub plugin with enhanced workflow capabilities
 */

import { GitHubPlugin } from './github-plugin.js';
import logger from '../utils/logger.js';

// Note: GitHubPlugin now has its own Redis-based cache for API responses
// No need for instance caching here - each request creates a new instance
// The actual API response caching is handled by GitHubPlugin using Redis

export class GitIntegrationService {
  constructor(userContext = null) {
    this.userContext = userContext;
    this.githubPlugin = new GitHubPlugin();
    this.initialized = false;
    logger.debug(`🆕 Creating GitHubPlugin for user`);
  }

  /**
   * Initialize the service with user credentials
   */
  async initialize(config = {}) {
    try {
      if (!this.initialized) {
        // Initialize the plugin (no longer calls testConnection automatically)
        // API response caching is handled by GitHubPlugin via Redis
        await this.githubPlugin.initialize(config, this.userContext);
        this.initialized = true;

        logger.info('🔧 Git Integration Service initialized (API caching via Redis)');
      } else {
        logger.debug('🔧 Git Integration Service already initialized');
      }
      return true;
    } catch (error) {
      logger.error('❌ Git Integration Service initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a new feature branch for a workflow
   */
  async createWorkflowBranch(params) {
    this.ensureInitialized();
    
    const { 
      owner, 
      repo, 
      workflowId, 
      workflowType = 'feature',
      baseBranch = 'main' 
    } = params;

    const branchName = this.generateBranchName(workflowType, workflowId);
    
    try {
      // Get base branch reference
      const baseRef = await this.getBranchRef(owner, repo, baseBranch);
      
      // Create new branch
      const newBranch = await this.createBranch(owner, repo, branchName, baseRef.sha);
      
      logger.info(`🌿 Created workflow branch: ${branchName}`);
      
      return {
        branchName,
        branchRef: newBranch,
        url: `https://github.com/${owner}/${repo}/tree/${branchName}`
      };
    } catch (error) {
      logger.error(`❌ Failed to create workflow branch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Commit workflow changes to branch
   */
  async commitWorkflowChanges(params) {
    this.ensureInitialized();
    
    const {
      owner,
      repo,
      branchName,
      changes, // Array of { path, content, operation: 'add'|'modify'|'delete' }
      message,
      workflowId
    } = params;

    try {
      // Get current branch tree
      const branchRef = await this.getBranchRef(owner, repo, branchName);
      const currentTree = await this.getTree(owner, repo, branchRef.sha);
      
      // Create new tree with changes
      const newTree = await this.createTreeWithChanges(
        owner, 
        repo, 
        currentTree.sha, 
        changes
      );
      
      // Create commit
      const commit = await this.githubPlugin.createCommit({
        owner,
        repo,
        message: message || `Update from workflow ${workflowId}`,
        tree: newTree.sha,
        parents: [branchRef.sha]
      });

      // Update branch reference
      await this.updateBranchRef(owner, repo, branchName, commit.sha);
      
      logger.info(`📝 Committed ${changes.length} changes to ${branchName}`);
      
      return {
        commitSha: commit.sha,
        commitUrl: commit.html_url,
        filesChanged: changes.length
      };
    } catch (error) {
      logger.error(`❌ Failed to commit workflow changes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create pull request from workflow branch
   */
  async createWorkflowPullRequest(params) {
    this.ensureInitialized();
    
    const {
      owner,
      repo,
      branchName,
      targetBranch = 'main',
      workflowId,
      workflowSummary,
      artifacts = []
    } = params;

    const title = `Workflow: ${workflowId}`;
    const body = this.generatePRDescription(workflowId, workflowSummary, artifacts);

    try {
      const pullRequest = await this.githubPlugin.createPullRequest({
        owner,
        repo,
        title,
        body,
        head: branchName,
        base: targetBranch,
        draft: false
      });

      logger.info(`🔄 Created pull request: #${pullRequest.number}`);
      
      return {
        prNumber: pullRequest.number,
        prUrl: pullRequest.html_url,
        prId: pullRequest.id
      };
    } catch (error) {
      logger.error(`❌ Failed to create pull request: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup repository for workflow-driven development
   */
  async setupWorkflowRepository(params) {
    this.ensureInitialized();
    
    const {
      name,
      description,
      private: isPrivate = false,
      owner,
      template = 'basic'
    } = params;

    try {
      // Create repository
      const repo = await this.githubPlugin.createRepository({
        name,
        description,
        private: isPrivate,
        owner
      });

      // Setup initial structure based on template
      const repoData = repo.data || repo; // Extract data from the GitHub API response
      await this.setupRepositoryStructure(owner || repoData.owner.login, name, template);
      
      logger.info(`🚀 Repository setup complete: ${repoData.html_url}`);
      
      return {
        repository: repoData, // Return full repository data from GitHub API
        repoUrl: repoData.html_url,
        cloneUrl: repoData.clone_url,
        sshUrl: repoData.ssh_url
      };
    } catch (error) {
      logger.error(`❌ Failed to setup repository: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get repository information for workflow context
   */
  async getRepositoryContext(owner, repo) {
    this.ensureInitialized();
    
    try {
      const [repoInfo, branches, releases] = await Promise.all([
        this.getRepositoryInfo(owner, repo),
        this.githubPlugin.getBranches({ owner, repo }),
        this.getRecentReleases(owner, repo).catch(() => [])
      ]);

      return {
        repository: repoInfo,
        branches: branches.map(b => ({
          name: b.name,
          sha: b.commit.sha,
          protected: b.protected || false
        })),
        releases: releases.slice(0, 5) // Last 5 releases
      };
    } catch (error) {
      logger.error(`❌ Failed to get repository context: ${error.message}`);
      throw error;
    }
  }

  // ========== PRIVATE HELPER METHODS ==========

  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Git Integration Service not initialized. Call initialize() first.');
    }
  }

  generateBranchName(workflowType, workflowId) {
    const sanitizedId = workflowId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${workflowType}/${sanitizedId}-${timestamp}`;
  }

  generatePRDescription(workflowId, summary, artifacts) {
    let description = `## Workflow Summary\n\n**Workflow ID:** ${workflowId}\n\n`;
    
    if (summary) {
      description += `**Description:** ${summary}\n\n`;
    }

    if (artifacts.length > 0) {
      description += `## Generated Artifacts\n\n`;
      artifacts.forEach(artifact => {
        description += `- **${artifact.type}**: ${artifact.name}\n`;
        if (artifact.description) {
          description += `  - ${artifact.description}\n`;
        }
      });
      description += '\n';
    }

    description += `## Review Notes\n\n`;
    description += `This pull request was generated by the BMAD AI development workflow.\n`;
    description += `Please review the generated code and artifacts before merging.\n\n`;
    description += `---\n*Generated by BMAD AI Development Team* 🤖`;

    return description;
  }

  async getBranchRef(owner, repo, branchName) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url);
    const data = await response.json();
    return data.object;
  }

  async createBranch(owner, repo, branchName, sha) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/refs`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha
      })
    });
    return await response.json();
  }

  async getTree(owner, repo, sha) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url);
    return await response.json();
  }

  async createTreeWithChanges(owner, repo, baseSha, changes) {
    const tree = changes.map(change => ({
      path: change.path,
      mode: change.mode || '100644',
      type: 'blob',
      content: change.content
    }));

    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseSha,
        tree
      })
    });
    return await response.json();
  }

  async updateBranchRef(owner, repo, branchName, sha) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ sha })
    });
    return await response.json();
  }

  async getRepositoryInfo(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url);
    return await response.json();
  }

  async getRecentReleases(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;
    const response = await this.githubPlugin.makeAuthenticatedRequest(url);
    return await response.json();
  }

  async setupRepositoryStructure(owner, repo, template) {
    const structures = {
      basic: [
        { path: 'README.md', content: this.generateReadme(repo) },
        { path: '.gitignore', content: this.generateGitignore() },
        { path: 'docs/README.md', content: '# Documentation\n\nGenerated by BMAD workflows.' }
      ],
      fullstack: [
        { path: 'README.md', content: this.generateReadme(repo) },
        { path: '.gitignore', content: this.generateGitignore() },
        { path: 'docs/README.md', content: '# Documentation' },
        { path: 'src/README.md', content: '# Source Code' },
        { path: 'tests/README.md', content: '# Tests' },
        { path: 'package.json', content: this.generatePackageJson(repo) }
      ]
    };

    const files = structures[template] || structures.basic;
    
    for (const file of files) {
      await this.githubPlugin.uploadFile({
        owner,
        repo,
        path: file.path,
        content: file.content,
        message: `Initialize ${file.path}`
      });
    }
  }

  generateReadme(repoName) {
    return `# ${repoName}

Generated by BMAD AI Development Team

## Overview

This repository was created and managed by AI agents working collaboratively on development tasks.

## Structure

- \`docs/\` - Project documentation
- \`src/\` - Source code
- \`tests/\` - Test files

## Development

This project follows workflow-driven development practices with AI agent collaboration.
`;
  }

  generateGitignore() {
    return `# Dependencies
node_modules/
*.log
npm-debug.log*

# Build outputs
dist/
build/
*.tgz

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
`;
  }

  generatePackageJson(repoName) {
    return JSON.stringify({
      name: repoName.toLowerCase(),
      version: "1.0.0",
      description: "Generated by BMAD AI Development Team",
      main: "src/index.js",
      scripts: {
        test: "echo \"Tests managed by AI agents\" && exit 0",
        build: "echo \"Build process managed by AI agents\" && exit 0"
      },
      keywords: ["bmad", "ai-generated"],
      author: "BMAD AI Development Team"
    }, null, 2);
  }
}

export default GitIntegrationService;