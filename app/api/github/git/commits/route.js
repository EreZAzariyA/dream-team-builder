/**
 * GitHub Git Commits API
 * Provides commit history and details for repositories
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/github/git/commits
 * Get commit history for a repository
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

    // Get commit history
    const commits = await gitService.githubPlugin.getCommitHistory({
      owner,
      repo,
      branch,
      per_page,
      since
    });

    return NextResponse.json({
      success: true,
      data: {
        commits,
        repository: `${owner}/${repo}`,
        branch,
        count: commits.length
      }
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