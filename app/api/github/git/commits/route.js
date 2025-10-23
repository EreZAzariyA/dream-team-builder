/**
 * GitHub Git Commits API
 * Provides commit history and details for repositories (with caching)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import logger from '@/lib/utils/logger.js';
import { redisService } from '@/lib/utils/redis.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';

/**
 * GET /api/github/git/commits
 * Get commit history for a repository (with caching)
 */
export async function GET(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || 'main';
    const per_page = parseInt(searchParams.get('per_page') || '30');
    const since = searchParams.get('since');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Validate required parameters
    if (!owner || !repo) {
      return NextResponse.json({
        success: false,
        error: 'Repository owner and name are required'
      }, { status: 400 });
    }

    await connectMongoose();

    const redisKey = `git:commits:${owner}:${repo}:${branch}`;

    // Check Redis cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cachedData = await redisService.get(redisKey);
        if (cachedData) {
          logger.info(`✅ GIT CACHE HIT: ${redisKey}`);
          return NextResponse.json({
            success: true,
            data: cachedData,
            cached: true,
            source: 'redis'
          });
        }
        logger.info(`⚠️ GIT CACHE MISS: ${redisKey}`);
      } catch (redisError) {
        logger.error(`Redis GET error for ${redisKey}:`, redisError);
      }

      // Check DB cache (if git history exists and not too old)
      const analysis = await RepoAnalysis.findOne({
        owner,
        name: repo,
        userId: session.user.id
      }).sort({ createdAt: -1 });

      if (analysis?.gitHistory && analysis.gitHistory.fetchedAt) {
        const gitAge = Date.now() - new Date(analysis.gitHistory.fetchedAt).getTime();
        const maxAge = 6 * 60 * 60 * 1000; // 6 hours

        if (gitAge < maxAge && analysis.gitHistory.defaultBranch === branch) {
          logger.info(`✅ GIT DB CACHE HIT (${Math.round(gitAge / 1000 / 60)} minutes old)`);

          const responseData = {
            commits: analysis.gitHistory.commits,
            branches: analysis.gitHistory.branches || [],
            repository: `${owner}/${repo}`,
            branch: analysis.gitHistory.defaultBranch,
            defaultBranch: analysis.gitHistory.defaultBranch,
            count: analysis.gitHistory.commits.length
          };

          // Warm up Redis cache
          try {
            await redisService.set(redisKey, responseData, 1800); // 30 min TTL
            logger.info(`📦 Cached git history to Redis: ${redisKey}`);
          } catch (redisError) {
            logger.error(`Redis SET error for ${redisKey}:`, redisError);
          }

          return NextResponse.json({
            success: true,
            data: responseData,
            cached: true,
            source: 'database'
          });
        } else if (gitAge >= maxAge) {
          logger.info(`⏰ Git history is stale (${Math.round(gitAge / 1000 / 60 / 60)} hours old), refreshing...`);
        }
      }
    } else {
      logger.info(`🔄 Force refresh requested for git history: ${redisKey}`);
    }

    // Fetch fresh git history
    logger.info(`🔄 Fetching fresh git history from GitHub for ${owner}/${repo}`);
    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    // Fetch commits and branches in parallel
    const [commits, repoInfo] = await Promise.all([
      gitService.githubPlugin.getCommitHistory({
        owner,
        repo,
        branch,
        per_page,
        since
      }),
      gitService.githubPlugin.octokit.rest.repos.get({ owner, repo }).catch(() => null)
    ]);

    // Get branches
    let branches = [];
    try {
      const branchesData = await gitService.githubPlugin.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 10
      });
      branches = branchesData.data.map(b => ({
        name: b.name,
        protected: b.protected,
        sha: b.commit.sha
      }));
    } catch (error) {
      logger.warn(`Failed to fetch branches for ${owner}/${repo}:`, error.message);
    }

    const responseData = {
      commits,
      branches,
      repository: `${owner}/${repo}`,
      branch,
      defaultBranch: repoInfo?.data?.default_branch || branch,
      count: commits.length
    };

    // Save to database (find or create analysis)
    let analysis = await RepoAnalysis.findOne({
      owner,
      name: repo,
      userId: session.user.id
    }).sort({ createdAt: -1 });

    if (analysis) {
      analysis.gitHistory = {
        commits: commits.slice(0, 50), // Store last 50 commits
        branches: branches,
        defaultBranch: responseData.defaultBranch,
        fetchedAt: new Date(),
        totalCommits: commits.length,
        contributors: extractContributors(commits),
        version: '1.0'
      };
      await analysis.save();
      logger.info(`💾 Saved git history to database for ${owner}/${repo}`);
    }

    // Cache in Redis (30 min TTL)
    try {
      await redisService.set(redisKey, responseData, 1800);
      logger.info(`📦 Cached git history to Redis: ${redisKey} (TTL: 30 min)`);
    } catch (redisError) {
      logger.error(`Redis SET error for ${redisKey}:`, redisError);
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
      source: 'github'
    });

  } catch (error) {
    logger.error('Get commits error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch commits',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Extract unique contributors from commits
 */
function extractContributors(commits) {
  const contributorMap = new Map();

  commits.forEach(commit => {
    const author = commit.commit?.author?.name || commit.author?.login || 'Unknown';
    const email = commit.commit?.author?.email || '';
    const avatar = commit.author?.avatar_url || '';

    if (!contributorMap.has(author)) {
      contributorMap.set(author, {
        name: author,
        email,
        avatar,
        commits: 0
      });
    }

    contributorMap.get(author).commits++;
  });

  return Array.from(contributorMap.values())
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10); // Top 10 contributors
}

/**
 * POST /api/github/git/commits
 * Get detailed commit information
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { owner, repo, sha, action = 'details' } = body;

    // Validate required parameters
    if (!owner || !repo) {
      return NextResponse.json({
        success: false,
        error: 'Repository owner and name are required'
      }, { status: 400 });
    }

    // Initialize Git service
    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    let result;

    switch (action) {
      case 'details':
        if (!sha) {
          return NextResponse.json({
            success: false,
            error: 'Commit SHA is required for details'
          }, { status: 400 });
        }
        result = await gitService.githubPlugin.getCommitDetails({ owner, repo, sha });
        break;

      case 'compare':
        const { base, head } = body;
        if (!base || !head) {
          return NextResponse.json({
            success: false,
            error: 'Base and head references are required for comparison'
          }, { status: 400 });
        }
        result = await gitService.githubPlugin.compareCommits({ owner, repo, base, head });
        break;

      case 'network':
        const { branch = 'main', per_page = 20 } = body;
        result = await gitService.githubPlugin.getNetworkGraph({ owner, repo, branch, per_page });
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: details, compare, or network'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Commit operation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform commit operation',
      details: error.message
    }, { status: 500 });
  }
}