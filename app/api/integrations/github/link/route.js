import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { User } from '@/lib/database/models/index.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/integrations/github/link
 * Initiate GitHub OAuth for account linking using device flow or personal access token
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Must be signed in to link GitHub integration'
      }, { status: 401 });
    }

    // For now, return instructions for personal access token
    // In production, you might want to implement GitHub Apps or OAuth Apps
    return NextResponse.json({
      success: true,
      message: 'GitHub integration linking',
      instructions: {
        step1: 'Go to GitHub Settings > Developer settings > Personal access tokens',
        step2: 'Generate a new token with repo, read:user, user:email scopes',
        step3: 'Copy the token and paste it in the form below'
      }
    });

  } catch (error) {
    logger.error('GitHub integration initiation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initiate GitHub integration',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/integrations/github/link
 * Link GitHub account using personal access token
 */
export async function POST(request) {
  try {
    // Must be authenticated to link integrations
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required to link GitHub integration'
      }, { status: 401 });
    }

    const { accessToken } = await request.json();
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'GitHub access token required'
      }, { status: 400 });
    }

    await connectMongoose();

    // Find the current user
    const currentUser = await User.findById(session.user.id);
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Current user not found'
      }, { status: 404 });
    }

    // Test the token and get GitHub user info using Octokit
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({
      auth: accessToken,
    });

    let githubUser;
    try {
      const response = await octokit.rest.users.getAuthenticated();
      githubUser = response.data;
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid GitHub access token',
        details: error.message
      }, { status: 400 });
    }

    // Check if this GitHub account is already linked to another user
    const existingGitHubUser = await User.findOne({ 
      githubId: githubUser.id.toString(),
      _id: { $ne: currentUser._id }
    });

    if (existingGitHubUser) {
      return NextResponse.json({
        success: false,
        error: 'GitHub account already linked to another user'
      }, { status: 400 });
    }

    // Update current user with GitHub information
    currentUser.githubId = githubUser.id.toString();
    currentUser.githubAccessToken = accessToken;
    
    // Update avatar if user doesn't have one
    if (!currentUser.profile.avatar && githubUser.avatar_url) {
      currentUser.profile.avatar = githubUser.avatar_url;
    }

    await currentUser.save();

    logger.info(`🔗 GitHub integration linked to user: ${currentUser.email} (GitHub: ${githubUser.login})`);

    return NextResponse.json({
      success: true,
      message: 'GitHub integration linked successfully',
      user: {
        id: currentUser._id.toString(),
        email: currentUser.email,
        githubId: currentUser.githubId,
        githubLogin: githubUser.login,
        hasGitHubAccess: true
      }
    });

  } catch (error) {
    logger.error('Link GitHub integration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to link GitHub integration',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations/github/link  
 * Unlink GitHub account
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    await connectMongoose();

    const currentUser = await User.findById(session.user.id);
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: 'Current user not found'
      }, { status: 404 });
    }

    // Remove GitHub integration
    currentUser.githubId = null;
    currentUser.githubAccessToken = null;
    await currentUser.save();

    logger.info(`🔗 GitHub integration unlinked from user: ${currentUser.email}`);

    return NextResponse.json({
      success: true,
      message: 'GitHub integration unlinked successfully'
    });

  } catch (error) {
    logger.error('Unlink GitHub integration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to unlink GitHub integration',
      details: error.message
    }, { status: 500 });
  }
}