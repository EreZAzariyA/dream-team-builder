/**
 * API endpoint for downloading all workflow artifacts as a zip
 * GET: Download zip file containing all artifacts
 */

import { NextResponse } from 'next/server';
import { BmadOrchestrator } from '../../../../../../lib/bmad/index.js';
import logger from '../../../../../../lib/utils/logger.js';
const archiver = require('archiver');


export async function GET(request, { params }) {
  try {
    const { workflowId } = await params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    const bmad = new BmadOrchestrator();
    await bmad.initialize();
    const artifactManager = bmad.artifactManager;

    // Get artifacts for the workflow
    const artifacts = await artifactManager.getWorkflowArtifacts(workflowId);
    
    if (!artifacts || artifacts.length === 0) {
      return NextResponse.json(
        { error: 'No artifacts found for this workflow' },
        { status: 404 }
      );
    }

    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Add all artifacts to the zip
    for (const artifact of artifacts) {
      try {
        const content = await artifactManager.getArtifactContent(workflowId, artifact.filename);
        if (content) {
          archive.append(content, { name: artifact.filename });
        }
      } catch (error) {
        logger.warn(`Failed to add artifact ${artifact.filename} to zip:`, error);
      }
    }

    // Finalize the archive
    archive.finalize();

    // Convert archive to buffer
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    
    return new Promise((resolve) => {
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        resolve(new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${workflowId}-artifacts.zip"`,
            'Content-Length': buffer.length.toString(),
          },
        }));
      });
    });

  } catch (error) {
    logger.error('Error creating zip download:', error);
    return NextResponse.json(
      { error: 'Failed to create download', details: error.message },
      { status: 500 }
    );
  }
}