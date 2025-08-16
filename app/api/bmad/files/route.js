import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { FileManager } from '@/lib/bmad/AgentExecutor/FileManager.js';
const fileManager = new FileManager();

/**
 * BMAD File Management API
 * Handles file operations for agent-generated content
 * 
 * POST /api/bmad/files - Upload/write file
 * GET /api/bmad/files?path=... - Download/read file  
 * DELETE /api/bmad/files?path=... - Delete file
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
      agentId, 
      filename, 
      content, 
      context,
      chatSessionId = null,
      team = null,
      workflowId = null
    } = await request.json();

    // Validate required fields
    if (!agentId || !filename || !content || !context) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, filename, content, context'
      }, { status: 400 });
    }

    // Validate context
    if (context !== 'agents-chat' && context !== 'agent-teams') {
      return NextResponse.json({
        success: false,
        error: 'Context must be "agents-chat" or "agent-teams"'
      }, { status: 400 });
    }

    // Validate agent-teams requirements
    if (context === 'agent-teams' && (!team || !workflowId)) {
      return NextResponse.json({
        success: false,
        error: 'team and workflowId are required for agent-teams context'
      }, { status: 400 });
    }

    // Create file context
    let fileContext;
    if (context === 'agents-chat') {
      fileContext = fileManager.contexts.agentChat(
        session.user.id,
        agentId,
        filename,
        chatSessionId
      );
    } else {
      fileContext = fileManager.contexts.agentTeam(
        session.user.id,
        agentId,
        filename,
        team,
        workflowId
      );
    }

    // Initialize file manager if needed
    await fileManager.initialize();

    // Write file
    const result = await fileManager.writeAgentFile(fileContext, content);

    return NextResponse.json({
      success: true,
      file: result,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('❌ File upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'File upload failed',
      message: error.message
    }, { status: 500 });
  }
}

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
    const agentId = searchParams.get('agentId');
    const filename = searchParams.get('filename');
    const context = searchParams.get('context');
    const chatSessionId = searchParams.get('chatSessionId');
    const team = searchParams.get('team');
    const workflowId = searchParams.get('workflowId');
    const action = searchParams.get('action') || 'read';

    // Validate required fields for read
    if (action === 'read' && (!agentId || !filename || !context)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, filename, context'
      }, { status: 400 });
    }

    // Create file context
    let fileContext;
    if (context === 'agents-chat') {
      if (action === 'list') {
        fileContext = fileManager.contexts.agentChat(session.user.id, agentId, '');
      } else {
        fileContext = fileManager.contexts.agentChat(session.user.id, agentId, filename, chatSessionId);
      }
    } else if (context === 'agent-teams') {
      if (!team || !workflowId) {
        return NextResponse.json({
          success: false,
          error: 'team and workflowId are required for agent-teams context'
        }, { status: 400 });
      }
      
      if (action === 'list') {
        fileContext = fileManager.contexts.agentTeam(session.user.id, agentId, '', team, workflowId);
      } else {
        fileContext = fileManager.contexts.agentTeam(session.user.id, agentId, filename, team, workflowId);
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Context must be "agents-chat" or "agent-teams"'
      }, { status: 400 });
    }

    // Initialize file manager if needed
    await fileManager.initialize();

    if (action === 'list') {
      // List files
      const files = await fileManager.listAgentFiles(fileContext);
      return NextResponse.json({
        success: true,
        files,
        count: files.length
      });
    } else {
      // Read file
      const content = await fileManager.readAgentFile(fileContext);
      
      // Return content with appropriate headers
      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `inline; filename="${filename}"`,
        },
      });
    }

  } catch (error) {
    console.error('❌ File read error:', error);
    return NextResponse.json({
      success: false,
      error: 'File read failed',
      message: error.message
    }, { status: 500 });
  }
}

export async function DELETE(request) {
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
    const agentId = searchParams.get('agentId');
    const filename = searchParams.get('filename');
    const context = searchParams.get('context');
    const chatSessionId = searchParams.get('chatSessionId');
    const team = searchParams.get('team');
    const workflowId = searchParams.get('workflowId');

    // Validate required fields
    if (!agentId || !filename || !context) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, filename, context'
      }, { status: 400 });
    }

    // Create file context
    let fileContext;
    if (context === 'agents-chat') {
      fileContext = fileManager.contexts.agentChat(session.user.id, agentId, filename, chatSessionId);
    } else if (context === 'agent-teams') {
      if (!team || !workflowId) {
        return NextResponse.json({
          success: false,
          error: 'team and workflowId are required for agent-teams context'
        }, { status: 400 });
      }
      fileContext = fileManager.contexts.agentTeam(session.user.id, agentId, filename, team, workflowId);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Context must be "agents-chat" or "agent-teams"'
      }, { status: 400 });
    }

    // Initialize file manager if needed
    await fileManager.initialize();

    // Delete file
    await fileManager.deleteAgentFile(fileContext);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ File delete error:', error);
    return NextResponse.json({
      success: false,
      error: 'File delete failed',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * GET handler for API documentation
 */
export async function OPTIONS() {
  return NextResponse.json({
    service: 'BMAD File Management API',
    version: '1.0.0',
    description: 'Handles agent-generated file storage with S3 support',
    
    endpoints: {
      'POST /api/bmad/files': 'Upload/write agent-generated file',
      'GET /api/bmad/files': 'Download/read agent-generated file or list files',
      'DELETE /api/bmad/files': 'Delete agent-generated file'
    },

    fileStructure: {
      'agents-chat': 'userId/agents-chat/agentId/filename.md',
      'agent-teams': 'userId/agent-teams/team/workflowId/agentId/filename.md'
    },

    storage: {
      production: 'AWS S3',
      development: 'Local filesystem (fallback)'
    }
  });
}