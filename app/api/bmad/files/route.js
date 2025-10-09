import { NextResponse } from 'next/server';

/**
 * DEPRECATED: BMAD File Management API
 * This API has been deprecated as part of the GitHub-first architecture migration.
 * All artifact management now goes through ArtifactManager and direct GitHub integration.
 * 
 * @deprecated Use ArtifactManager instead
 */

function createDeprecatedResponse() {
  return NextResponse.json({
    success: false,
    error: 'API_DEPRECATED',
    message: 'This file management API has been deprecated. Use ArtifactManager for artifact management.',
    migration: 'All artifacts are now managed in-memory during workflow execution and committed directly to GitHub repositories.'
  }, { status: 410 }); // 410 Gone
}

export async function POST(request) {
  return createDeprecatedResponse();
}

export async function GET(request) {
  return createDeprecatedResponse();
}

export async function DELETE(request) {
  return createDeprecatedResponse();
}

/**
 * OPTIONS handler for API documentation
 */
export async function OPTIONS() {
  return NextResponse.json({
    service: 'BMAD File Management API (DEPRECATED)',
    version: '1.0.0',
    status: 'DEPRECATED',
    deprecatedSince: '2025-08-21',
    description: 'This API has been deprecated in favor of ArtifactManager',
    
    migration: {
      from: 'FileManager + S3/Local storage',
      to: 'ArtifactManager + Direct GitHub commits',
      reason: 'Simplified architecture with GitHub-first approach'
    },

    newApproach: {
      artifactStorage: 'In-memory during workflow execution',
      finalCommit: 'Direct to target GitHub repository',
      benefits: ['No S3 dependency', 'Simplified architecture', 'Direct repository integration']
    }
  });
}