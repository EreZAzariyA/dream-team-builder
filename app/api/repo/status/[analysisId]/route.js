/**
 * Repository Analysis API - Analysis ID Status Route
 * GET /api/repo/status/[analysisId] - Get specific analysis status by ID
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/repo/status/[analysisId]
 * Get analysis status and results by analysis ID
 */
export async function GET(request, { params }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    await connectMongoose();

    const { analysisId } = await params;

    if (!analysisId) {
      return NextResponse.json({
        success: false,
        error: 'Analysis ID is required'
      }, { status: 400 });
    }

    // Find analysis by ID
    const analysis = await RepoAnalysis.findById(analysisId);

    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found'
      }, { status: 404 });
    }

    // Check if user owns this analysis
    if (analysis.userId.toString() !== session.user.id) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Auto-repair corrupted analysis records (same logic as main status route)
    if (analysis.status !== 'completed' && 
        analysis.summary && 
        analysis.metrics && 
        analysis.metrics.fileCount > 0 &&
        analysis.summary.trim().length > 50) {
      logger.warn(`Fixing corrupted analysis record ${analysis._id}: has substantial data but status is ${analysis.status}`);
      analysis.status = 'completed';
      await analysis.save();
    }

    // Return analysis data (only include complete data if analysis is finished)
    const isCompleted = analysis.status === 'completed';
    
    return NextResponse.json({
      success: true,
      analysis: {
        id: analysis._id,
        repositoryId: analysis.repositoryId,
        owner: analysis.owner,
        name: analysis.name,
        fullName: analysis.fullName,
        branch: analysis.branch,
        status: analysis.status,
        // Only include complete analysis results if status is 'completed'
        summary: isCompleted ? analysis.summary : null,
        metrics: isCompleted ? analysis.metrics : null,
        fileIndex: isCompleted ? analysis.fileIndex : null,
        analyzedAt: analysis.analyzedAt,
        duration: isCompleted ? analysis.duration : null,
        error: analysis.error,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    });

  } catch (error) {
    logger.error('Analysis status check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get analysis status',
      details: error.message
    }, { status: 500 });
  }
}