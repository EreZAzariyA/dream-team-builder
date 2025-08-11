/**
 * API endpoint for downloading individual workflow artifacts
 * GET: Download specific artifact file
 */

import { NextResponse } from 'next/server';
const { ArtifactManager } = require('../../../../../../lib/bmad/ArtifactManager');
const path = require('path');

export async function GET(request, { params }) {
  try {
    const { workflowId, filename } = await params;
    
    if (!workflowId || !filename) {
      return NextResponse.json(
        { error: 'Workflow ID and filename are required' },
        { status: 400 }
      );
    }

    const bmad = await getOrchestrator();
    const artifactManager = bmad.artifactManager;

    // Get the specific artifact content
    const content = await artifactManager.getArtifactContent(workflowId, filename);
    
    if (!content) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml'
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
      },
    });

  } catch (error) {
    logger.error('Error downloading artifact:', error);
    return NextResponse.json(
      { error: 'Failed to download artifact', details: error.message },
      { status: 500 }
    );
  }
}