/**
 * GitHub Integration Plugin
 * Provides GitHub repository integration for workflow artifacts and issue management using Octokit
 */

import { Octokit } from 'octokit';
import { BasePlugin } from './plugin-architecture.js';
import logger from '../utils/logger.js';
import { redisService } from '../utils/redis.js';

export class GitHubPlugin extends BasePlugin {
  constructor() {
    super('GitHub Integration', '1.0.0', 'Integrate with GitHub repositories for artifact management and issue tracking');

    this.octokit = null;
    this.baseUrl = 'https://api.github.com';
    this.headers = {}; // Keep for backward compatibility

    // RATE LIMITING & CACHING: Now uses Redis for distributed caching
    this.rateLimitInfo = {
      remaining: 5000,
      reset: Date.now() + 3600000, // Default 1 hour
      limit: 5000
    };
    this.requestQueue = [];
    this.isProcessingQueue = false;

    // Cache TTL settings (in seconds for Redis)
    this.cacheTTL = {
      user: 900,        // 15 minutes - connection tests are expensive
      repositories: 600,  // 10 minutes
      repository: 900,   // 15 minutes
      branches: 600,     // 10 minutes
      commits: 300,      // 5 minutes - commits change frequently
      contents: 900      // 15 minutes
    };

    // Verify Redis is available for caching
    if (!redisService.isAvailable()) {
      logger.warn('⚠️  GitHub Plugin: Redis not configured - API caching disabled, may hit rate limits!');
    }
    
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
    
    // Get token from user's OAuth token only - do not use global tokens
    // This ensures users only see their own repositories, not shared/global ones
    const token = userContext?.githubAccessToken;

    if (!token) {
      throw new Error('GitHub authentication required. Please sign in with GitHub to access your repositories.');
    }
    
    // Initialize Octokit with authentication
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'BMAD-GitHub-Plugin/1.0.0',
      timeZone: 'UTC',
      baseUrl: this.baseUrl
    });
    
    // Set up authentication headers (keep for backward compatibility)
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
    
    // Skip connection test during initialization to avoid rate limits
    // Connection will be tested lazily on first API call
    logger.info('GitHub plugin initialized successfully with Octokit (connection test deferred)');
  }

  /**
   * Test GitHub API connection - ONLY called when actually needed, with Redis caching
   */
  async testConnection() {
    try {
      // Use cached connection test result if available (from Redis)
      const cacheKey = 'github-connection-test';
      const cachedResult = await this.getFromCache(cacheKey, 'user');
      if (cachedResult) {
        logger.debug(`✅ Using cached GitHub connection test for user: ${cachedResult.login}`);
        return cachedResult;
      }

      // Warn about making actual API call
      logger.warn('🔍 Making actual GitHub API connection test - this should be rare!');

      // Only make API call if not cached and absolutely necessary
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      logger.debug(`✅ GitHub API connection test successful for user: ${user.login}`);

      // Cache the result in Redis
      await this.setCache(cacheKey, user, 'user');

      return user;
    } catch (error) {
      if (error.status === 401) {
        throw new Error('GitHub token expired or invalid. Please reconnect your GitHub account.');
      }
      if (error.status === 403 && error.message.includes('rate limit')) {
        // Try to return cached result if rate limited
        const cachedResult = await this.getFromCache('github-connection-test', 'user');
        if (cachedResult) {
          logger.warn('⚠️ Using cached connection test due to rate limit');
          return cachedResult;
        }
        // Don't fail completely - just log the issue
        logger.error('❌ GitHub API rate limited and no cached connection test available');
        return { login: 'rate-limited-user', id: 0 }; // Dummy response to avoid breaking
      }
      throw new Error(`GitHub API test failed: ${error.message}`);
    }
  }

  /**
   * RATE LIMITING & CACHING: Generate cache key for request
   */
  generateCacheKey(endpoint, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${endpoint}?${paramString}`;
  }

  /**
   * Get data from Redis cache if valid
   */
  async getFromCache(cacheKey, type = 'repository') {
    if (!redisService.isAvailable()) {
      return null; // No caching without Redis
    }

    try {
      const fullKey = `github:cache:${cacheKey}`;
      const cachedData = await redisService.get(fullKey);

      if (cachedData) {
        logger.debug(`📦 [GitHub Cache] Cache hit for ${cacheKey}`);
        return cachedData;
      }

      return null;
    } catch (error) {
      logger.error(`GitHub cache read error for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Store data in Redis cache with TTL
   */
  async setCache(cacheKey, data, type = 'repository') {
    if (!redisService.isAvailable()) {
      logger.debug('Redis not available - skipping cache for', cacheKey);
      return; // No caching without Redis
    }

    try {
      const fullKey = `github:cache:${cacheKey}`;
      const ttl = this.cacheTTL[type] || this.cacheTTL.repository;

      await redisService.set(fullKey, data, ttl);
      logger.debug(`💾 [GitHub Cache] Cached data for ${cacheKey} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`GitHub cache write error for ${cacheKey}:`, error);
      // Don't throw - caching is not critical
    }
  }

  /**
   * RATE LIMITING & CACHING: Check if we're approaching rate limits
   */
  shouldRateLimit() {
    // If we have less than 100 requests remaining, start rate limiting
    return this.rateLimitInfo.remaining < 100;
  }

  /**
   * RATE LIMITING & CACHING: Update rate limit info from response headers
   */
  updateRateLimitInfo(headers) {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimitInfo = {
        remaining: parseInt(headers['x-ratelimit-remaining']),
        limit: parseInt(headers['x-ratelimit-limit']),
        reset: parseInt(headers['x-ratelimit-reset']) * 1000 // Convert to milliseconds
      };
      
      if (this.rateLimitInfo.remaining < 50) {
        logger.warn(`⚠️ [GitHub Rate Limit] Low remaining requests: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit}`);
      }
    }
  }

  /**
   * RATE LIMITING & CACHING: Intelligent API request wrapper
   */
  async makeRateLimitedRequest(requestFn, cacheKey, type = 'repository') {
    // Check cache first
    const cachedData = await this.getFromCache(cacheKey, type);
    if (cachedData) {
      return cachedData;
    }

    // Check rate limits
    if (this.shouldRateLimit()) {
      const waitTime = Math.max(0, this.rateLimitInfo.reset - Date.now());
      if (waitTime > 0 && waitTime < 300000) { // Don't wait more than 5 minutes
        logger.warn(`⏳ [GitHub Rate Limit] Waiting ${Math.ceil(waitTime / 1000)}s before request`);
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 30000))); // Max wait 30s
      }
    }

    try {
      const response = await requestFn();

      // Update rate limit info
      this.updateRateLimitInfo(response.headers || {});

      // Cache the result
      await this.setCache(cacheKey, response.data, type);

      return response.data;
    } catch (error) {
      // Handle rate limit errors gracefully
      if (error.status === 403 && error.message.includes('rate limit')) {
        logger.error('🚫 [GitHub Rate Limit] API quota exceeded - returning cached data if available');
        // Try to return stale cache as fallback
        const staleCache = this.cache.get(cacheKey);
        if (staleCache) {
          logger.info('📦 [GitHub Cache] Using stale cache due to rate limit');
          return staleCache.data;
        }
        
        // If no cache available and this was a repositories request, return empty array
        if (type === 'repositories' || cacheKey.includes('repositories')) {
          logger.warn('📦 [GitHub Cache] No cache available for repositories, returning empty array');
          return [];
        }
      }
      throw error;
    }
  }

  /**
   * Make authenticated request with automatic token refresh handling
   * @deprecated Use this.octokit.rest.* methods instead for better error handling and type safety
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
    
    // RATE LIMITING: Use rate-limited request for repository creation
    return await this.makeRateLimitedRequest(
      async () => {
        if (owner) {
          // Create org repository
          return await this.octokit.rest.repos.createInOrg({
            org: owner,
            name,
            description,
            private: isPrivate,
            auto_init: true
          });
        } else {
          // Create user repository
          return await this.octokit.rest.repos.createForAuthenticatedUser({
            name,
            description,
            private: isPrivate,
            auto_init: true
          });
        }
      },
      null, // Don't cache repository creation
      'repositories'
    );
  }

  /**
   * Upload file to repository
   */
  async uploadFile(data) {
    const { owner, repo, path, content, message, branch = 'main' } = data;
    
    // RATE LIMITING: Use rate-limited request for file upload
    return await this.makeRateLimitedRequest(
      async () => {
        // Get current file SHA if it exists (for updates)
        let sha = null;
        try {
          const existingFile = await this.getFile({ owner, repo, path, branch });
          sha = existingFile.sha;
        } catch (error) {
          // File doesn't exist, that's okay for new files
        }
        
        const body = {
          message,
          content: Buffer.from(content).toString('base64'),
          branch
        };
        
        if (sha) {
          body.sha = sha;
        }
        
        return await this.octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
          sha
        });
      },
      null, // Don't cache file uploads
      'contents'
    );
  }

  /**
   * Get file from repository
   */
  async getFile(data) {
    const { owner, repo, path, branch = 'main' } = data;
    
    // RATE LIMITING & CACHING: Use intelligent caching for file content
    const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/contents/${path}`, { branch });
    
    return await this.makeRateLimitedRequest(
      async () => {
        const response = await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch
        });
        
        const file = response.data;
        
        // Decode content if it's base64
        if (file.encoding === 'base64') {
          file.decodedContent = Buffer.from(file.content, 'base64').toString('utf-8');
        }
        
        return file;
      },
      cacheKey,
      'contents'
    );
  }

  /**
   * Get directory contents from repository
   */
  async getDirectory(data) {
    const { owner, repo, path, branch = 'main' } = data;

    // RATE LIMITING & CACHING: Use intelligent caching for directory contents
    const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/contents/${path}`, { branch });
    
    return await this.makeRateLimitedRequest(
      async () => {
        return await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch
        });
      },
      cacheKey,
      'contents'
    );
  }

  /**
   * Get repository contents recursively
   */
  async getRepositoryContents(owner, repo, branch = 'main') {
    try {
      // RATE LIMITING & CACHING: Use intelligent caching for repository contents
      const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/contents`, { branch });
      
      return await this.makeRateLimitedRequest(
        async () => {
          let branchData;
          
          // Try the specified branch first
          try {
            const response = await this.octokit.rest.repos.getBranch({
              owner,
              repo,
              branch
            });
            branchData = response.data;
          } catch (branchError) {
            // If main branch fails, try master
            if (branch === 'main' && branchError.status === 404) {
              logger.info(`Branch 'main' not found, trying 'master' for ${owner}/${repo}`);
              const response = await this.octokit.rest.repos.getBranch({
                owner,
                repo,
                branch: 'master'
              });
              branchData = response.data;
            } else {
              throw branchError;
            }
          }

          const treeSha = branchData.commit.sha;

          // Use the Octokit git.getTree method to get all files recursively
          const treeResponse = await this.octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: true
          });

          // Return just the filtered data, makeRateLimitedRequest will handle response.data
          return {
            data: treeResponse.data.tree.filter(item => item.type === 'blob'), // Only return files, not folders
            headers: treeResponse.headers
          };
        },
        cacheKey,
        'contents'
      );
    } catch (error) {
      logger.error(`Failed to get repository contents for ${owner}/${repo}:`, error);
      throw new Error(`Failed to get repository contents: ${error.message}`);
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner, repo, path, branch = 'main') {
    try {
      // RATE LIMITING & CACHING: Use intelligent caching for file content
      const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/contents/${path}`, { branch });
      
      const response = await this.makeRateLimitedRequest(
        async () => {
          let apiResponse;
          
          // Try the specified branch first
          try {
            apiResponse = await this.octokit.rest.repos.getContent({
              owner,
              repo,
              path,
              ref: branch
            });
          } catch (branchError) {
            // If main branch fails, try master
            if (branch === 'main' && (branchError.status === 404 || branchError.message.includes('No commit found'))) {
              logger.info(`Branch 'main' not found for ${path}, trying 'master'`);
              try {
                apiResponse = await this.octokit.rest.repos.getContent({
                  owner,
                  repo,
                  path,
                  ref: 'master'
                });
              } catch (masterError) {
                logger.error(`Both 'main' and 'master' failed for ${path}: ${masterError.status} - ${masterError.message}`);
                throw masterError;
              }
            } else {
              throw branchError;
            }
          }
          
          return apiResponse;
        },
        cacheKey,
        'contents'
      );

      // makeRateLimitedRequest returns response.data, which is the file object
      const file = response;

      // Handle file vs directory
      if (file.type !== 'file') {
        logger.warn(`Path ${path} is not a file, it's a ${file.type}`);
        return null;
      }

      // Decode base64 content
      if (file.content && file.encoding === 'base64') {
        const content = Buffer.from(file.content, 'base64').toString('utf-8');
        return content;
      }
      
      if (file.content) {
        return file.content;
      }
      
      logger.warn(`No content found in file ${path}`);
      return null;
    } catch (error) {
      logger.error(`Failed to get file content for ${owner}/${repo}/${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Create an issue
   */
  async createIssue(data) {
    const { owner, repo, title, body, labels = [], assignees = [] } = data;
    
    // RATE LIMITING: Use rate-limited request for issue creation
    return await this.makeRateLimitedRequest(
      async () => {
        return await this.octokit.rest.issues.create({
          owner,
          repo,
          title,
          body,
          labels,
          assignees
        });
      },
      null, // Don't cache issue creation
      'issues'
    );
  }

  /**
   * Create a pull request
   */
  async createPullRequest(data) {
    const { owner, repo, title, body, head, base = 'main', draft = false } = data;
    
    // RATE LIMITING: Use rate-limited request for pull request creation
    return await this.makeRateLimitedRequest(
      async () => {
        return await this.octokit.rest.pulls.create({
          owner,
          repo,
          title,
          body,
          head,
          base,
          draft
        });
      },
      null, // Don't cache pull request creation
      'pulls'
    );
  }

  /**
   * Get user repositories
   */
  async getRepositories(data = {}) {
    const { type = 'owner', sort = 'updated', per_page = 30, page = 1 } = data;
    
    // RATE LIMITING & CACHING: Use intelligent caching for repositories
    const cacheKey = this.generateCacheKey('user/repos', { type, sort, per_page, page });
    
    return await this.makeRateLimitedRequest(
      () => {
        // Handle different repository types properly
        if (type === 'all') {
          // For 'all', use the endpoint that returns both owned and collaborated repositories
          return this.octokit.rest.repos.listForAuthenticatedUser({
            type: 'all',  // This includes owner + collaborator + organization_member
            sort,
            per_page,
            page
          });
        } else {
          // For specific types like 'owner' or 'collaborator'
          return this.octokit.rest.repos.listForAuthenticatedUser({
            type,
            sort,
            per_page,
            page
          });
        }
      },
      cacheKey,
      'repositories'
    );
  }

  /**
   * Get repository branches
   */
  async getBranches(data) {
    const { owner, repo, per_page = 30, page = 1 } = data;
    
    // RATE LIMITING & CACHING: Use intelligent caching for branches
    const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/branches`, { per_page, page });
    
    return await this.makeRateLimitedRequest(
      () => this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page,
        page
      }),
      cacheKey,
      'branches'
    );
  }

  /**
   * Create a commit
   */
  async createCommit(data) {
    const { owner, repo, message, tree, parents = [] } = data;
    
    // RATE LIMITING: Use rate-limited request for commit creation
    return await this.makeRateLimitedRequest(
      async () => {
        return await this.octokit.rest.git.createCommit({
          owner,
          repo,
          message,
          tree,
          parents
        });
      },
      null, // Don't cache commit creation
      'commits'
    );
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
      } catch {
        results.push({
          success: false,
          artifact: artifact.filename,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get commit history for a repository
   */
  async getCommitHistory(data) {
    const { owner, repo, branch = 'main', per_page = 30, since, page = 1 } = data;

    try {
      // RATE LIMITING & CACHING: Use intelligent caching for commits
      const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/commits`, { 
        branch, per_page, since, page 
      });

      const commitData = await this.makeRateLimitedRequest(
        async () => {
          const params = {
            owner,
            repo,
            sha: branch,
            per_page,
            page
          };

          if (since) {
            params.since = since;
          }

          let response;
          
          // Try the specified branch first
          try {
            response = await this.octokit.rest.repos.listCommits(params);
          } catch (branchError) {
            // If main branch fails, try master
            if (branch === 'main' && (branchError.status === 404 || branchError.message.includes('Not Found'))) {
              logger.info(`Branch 'main' not found, trying 'master' for ${owner}/${repo}`);
              params.sha = 'master';
              response = await this.octokit.rest.repos.listCommits(params);
            } else {
              throw branchError;
            }
          }

          return response;
        },
        cacheKey,
        'commits'
      );

      const commits = Array.isArray(commitData) ? commitData : commitData || [];
      
      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          login: commit.author?.login,
          avatar_url: commit.author?.avatar_url
        },
        date: commit.commit.author.date,
        stats: commit.stats,
        parents: commit.parents,
        html_url: commit.html_url
      }));
    } catch (error) {
      logger.error(`Failed to get commit history for ${owner}/${repo}:`, error);
      throw new Error(`Failed to get commit history: ${error.message}`);
    }
  }

  /**
   * Get detailed commit information
   */
  async getCommitDetails(data) {
    const { owner, repo, sha } = data;

    try {
      // RATE LIMITING & CACHING: Use intelligent caching for commit details
      const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/commits/${sha}`, {});
      
      const response = await this.makeRateLimitedRequest(
        async () => {
          return await this.octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: sha
          });
        },
        cacheKey,
        'commits'
      );

      return {
        sha: response.data.sha,
        message: response.data.commit.message,
        author: {
          name: response.data.commit.author.name,
          email: response.data.commit.author.email,
          login: response.data.author?.login,
          avatar_url: response.data.author?.avatar_url
        },
        date: response.data.commit.author.date,
        stats: response.data.stats,
        files: response.data.files,
        parents: response.data.parents,
        html_url: response.data.html_url
      };
    } catch (error) {
      logger.error(`Failed to get commit details for ${sha}:`, error);
      throw new Error(`Failed to get commit details: ${error.message}`);
    }
  }

  /**
   * Compare two commits or branches
   */
  async compareCommits(data) {
    const { owner, repo, base, head } = data;

    try {
      // RATE LIMITING & CACHING: Use intelligent caching for commit comparison
      const cacheKey = this.generateCacheKey(`repos/${owner}/${repo}/compare/${base}...${head}`, {});
      
      const response = await this.makeRateLimitedRequest(
        async () => {
          return await this.octokit.rest.repos.compareCommits({
            owner,
            repo,
            base,
            head
          });
        },
        cacheKey,
        'commits'
      );

      return {
        status: response.data.status,
        ahead_by: response.data.ahead_by,
        behind_by: response.data.behind_by,
        total_commits: response.data.total_commits,
        commits: response.data.commits,
        files: response.data.files,
        stats: {
          additions: response.data.files?.reduce((sum, file) => sum + (file.additions || 0), 0) || 0,
          deletions: response.data.files?.reduce((sum, file) => sum + (file.deletions || 0), 0) || 0,
          total: response.data.files?.reduce((sum, file) => sum + (file.changes || 0), 0) || 0
        }
      };
    } catch (error) {
      logger.error(`Failed to compare commits for ${owner}/${repo}:`, error);
      throw new Error(`Failed to compare commits: ${error.message}`);
    }
  }

  /**
   * Get repository network graph data
   */
  async getNetworkGraph(data) {
    const { owner, repo, branch = 'main', per_page = 20 } = data;

    try {
      // Get commits with parent information for graph construction
      const commits = await this.getCommitHistory({ 
        owner, 
        repo, 
        branch, 
        per_page: per_page * 2 // Get more commits for better graph
      });

      // Get all branches
      const branches = await this.getBranches({ owner, repo });

      // Build graph structure
      const nodes = commits.map(commit => ({
        id: commit.sha,
        message: commit.message.split('\n')[0], // First line only
        author: commit.author,
        date: commit.date,
        parents: commit.parents.map(p => p.sha)
      }));

      return {
        nodes,
        branches: branches.map(b => ({
          name: b.name,
          commit: b.commit
        }))
      };
    } catch (error) {
      logger.error(`Failed to get network graph for ${owner}/${repo}:`, error);
      throw new Error(`Failed to get network graph: ${error.message}`);
    }
  }

  /**
   * Get file content from repository
   */
}

export default GitHubPlugin;