/**
 * GitHub File Operations Proxy API
 * Handles file operations on GitHub repositories for BMAD agent execution
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import logger from '@/lib/utils/logger.js';

/**
 * POST /api/github/files
 * Perform file operations on GitHub repository
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

    const {
      repositoryId,
      owner,
      repo,
      operation, // 'read', 'write', 'list', 'commit'
      path,
      content,
      message,
      branch = 'main',
      encoding = 'utf-8'
    } = await request.json();

    // Validate required fields
    if (!owner || !repo || !operation) {
      return NextResponse.json({
        success: false,
        error: 'Repository owner, name, and operation are required',
        usage: 'Send { owner: "username", repo: "repo-name", operation: "read|write|list|commit", ... }'
      }, { status: 400 });
    }

    // Initialize Git Integration Service
    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    let result;

    switch (operation) {
      case 'read':
        if (!path) {
          return NextResponse.json({
            success: false,
            error: 'File path is required for read operation'
          }, { status: 400 });
        }

        try {
          const fileData = await gitService.githubPlugin.makeAuthenticatedRequest(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
          );
          const file = await fileData.json();
          
          if (file.type !== 'file') {
            throw new Error('Path is not a file');
          }

          const decodedContent = Buffer.from(file.content, 'base64').toString(encoding);
          
          result = {
            path: file.path,
            content: decodedContent,
            size: file.size,
            sha: file.sha,
            encoding: encoding
          };
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: 'File not found or access denied',
            message: error.message
          }, { status: 404 });
        }
        break;

      case 'write':
        if (!path || content === undefined) {
          return NextResponse.json({
            success: false,
            error: 'File path and content are required for write operation'
          }, { status: 400 });
        }

        try {
          const writeResult = await gitService.githubPlugin.uploadFile({
            owner,
            repo,
            path,
            content,
            message: message || `Update ${path} via BMAD workflow`,
            branch
          });

          result = {
            path,
            sha: writeResult.content?.sha,
            commit: {
              sha: writeResult.commit?.sha,
              url: writeResult.commit?.html_url
            },
            operation: 'write'
          };
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: 'Failed to write file',
            message: error.message
          }, { status: 500 });
        }
        break;

      case 'list':
        const listPath = path || '';
        
        try {
          const dirData = await gitService.githubPlugin.makeAuthenticatedRequest(
            `https://api.github.com/repos/${owner}/${repo}/contents/${listPath}?ref=${branch}`
          );
          const contents = await dirData.json();
          
          if (!Array.isArray(contents)) {
            // Single file response
            result = {
              type: 'file',
              contents: [contents]
            };
          } else {
            // Directory listing
            result = {
              type: 'directory',
              path: listPath,
              contents: contents.map(item => ({
                name: item.name,
                path: item.path,
                type: item.type,
                size: item.size,
                sha: item.sha
              }))
            };
          }
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: 'Failed to list directory contents',
            message: error.message
          }, { status: 404 });
        }
        break;

      case 'commit':
        if (!message) {
          return NextResponse.json({
            success: false,
            error: 'Commit message is required for commit operation'
          }, { status: 400 });
        }

        // For batch commit operations - this would handle multiple file changes
        // For now, return method not implemented as complex batch commits
        // are better handled through the GitIntegrationService workflow methods
        return NextResponse.json({
          success: false,
          error: 'Batch commit operation not implemented',
          suggestion: 'Use individual write operations or workflow-level commit methods'
        }, { status: 501 });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`,
          availableOperations: ['read', 'write', 'list', 'commit']
        }, { status: 400 });
    }

    logger.info(`✅ GitHub file operation completed: ${operation} on ${owner}/${repo}/${path || ''}`);

    return NextResponse.json({
      success: true,
      operation,
      repository: `${owner}/${repo}`,
      branch,
      ...result
    });

  } catch (error) {
    logger.error('GitHub file operations API error:', error);
    return NextResponse.json({
      success: false,
      error: 'File operation failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * GET handler for API documentation
 */
export async function GET() {
  return NextResponse.json({
    service: 'GitHub File Operations Proxy API',
    version: '1.0.0',
    description: 'Proxy file operations on GitHub repositories for BMAD agents',
    
    operations: {
      read: {
        description: 'Read file contents from repository',
        required: ['owner', 'repo', 'path'],
        optional: ['branch', 'encoding']
      },
      write: {
        description: 'Write/update file in repository',
        required: ['owner', 'repo', 'path', 'content'],
        optional: ['message', 'branch']
      },
      list: {
        description: 'List directory contents',
        required: ['owner', 'repo'],
        optional: ['path', 'branch']
      },
      commit: {
        description: 'Batch commit multiple changes (not implemented)',
        status: 'planned'
      }
    },

    usage: {
      'POST /api/github/files': {
        body: {
          owner: 'string - GitHub repository owner',
          repo: 'string - GitHub repository name',
          operation: 'string - read|write|list|commit',
          path: 'string - File path (required for read/write)',
          content: 'string - File content (required for write)',
          message: 'string - Commit message (optional for write)',
          branch: 'string - Target branch (default: main)',
          encoding: 'string - Content encoding (default: utf-8)'
        }
      }
    },

    features: [
      'Read files from any accessible GitHub repository',
      'Write/update files with automatic commit messages',
      'List directory contents and file metadata',
      'Support for custom branches and encoding',
      'Automatic authentication via user GitHub tokens'
    ],

    notes: [
      'All operations require GitHub repository access permissions',
      'Write operations create immediate commits to the repository',
      'File content is automatically encoded/decoded for GitHub API',
      'Large files (>1MB) may require special handling'
    ]
  });
}