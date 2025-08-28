/**
 * Repository File API
 * Get individual file content from GitHub
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import logger from '@/lib/utils/logger.js';

/**
 * POST /api/repo/file
 * Get file content from repository
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
    const { owner, name, path, ref = 'main' } = body;

    // Validate required fields
    if (!owner || !name || !path) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: owner, name, path'
      }, { status: 400 });
    }

    // Initialize Git service
    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    try {
      // Get file content
      const content = await gitService.githubPlugin.getFileContent(
        owner, 
        name, 
        path, 
        ref
      );

      // Check if content is too large (1MB limit for display)
      if (content && content.length > 1024 * 1024) {
        return NextResponse.json({
          success: false,
          error: 'File too large to display',
          size: content.length
        }, { status: 413 });
      }

      return NextResponse.json({
        success: true,
        content,
        path,
        size: content ? content.length : 0
      });

    } catch (gitError) {
      // Handle specific GitHub API errors
      if (gitError.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'File not found'
        }, { status: 404 });
      }

      if (gitError.status === 403) {
        return NextResponse.json({
          success: false,
          error: 'Access denied to repository'
        }, { status: 403 });
      }

      throw gitError;
    }

  } catch (error) {
    logger.error('File content error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get file content',
      details: error.message
    }, { status: 500 });
  }
}