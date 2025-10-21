/**
 * Repository Analysis API - Status Route
 * Get analysis status and results
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/repo/status?id={analysisId}
 * GET /api/repo/status?owner={owner}&name={name}
 * Get analysis status and results
 */
import { redisService } from '@/lib/utils/redis';

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
    const analysisId = searchParams.get('id');
    const owner = searchParams.get('owner');
    const name = searchParams.get('name');

    // --- START of Caching Logic (GET) ---
    // Only apply caching when looking up by owner/name
    if (owner && name) {
      const redisKey = `analysis:status:${owner}:${name}`;
      try {
        const cachedData = await redisService.get(redisKey);
        if (cachedData) {
          logger.info(`CACHE HIT for ${redisKey}`);
          // The cached data is the final API response body, so we can return it directly
          return NextResponse.json(cachedData);
        }
        logger.info(`CACHE MISS for ${redisKey}. Fetching from DB.`);
      } catch (redisError) {
        logger.error(`Redis GET error for key ${redisKey}:`, redisError);
        // Don't block request if Redis fails, just log and proceed to DB
      }
    }
    // --- END of Caching Logic (GET) ---

    await connectMongoose();
    let analysis = null;

    if (analysisId) {
      // Find by analysis ID
      analysis = await RepoAnalysis.findById(analysisId);
    } else if (owner && name) {
      // Find by repository owner/name (get most recent)
      analysis = await RepoAnalysis.findOne({
        owner,
        name,
        userId: session.user.id
      }).sort({ createdAt: -1 }); // Get most recent analysis
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either analysis ID or owner+name parameters are required'
      }, { status: 400 });
    }

    if (!analysis) {
      return NextResponse.json({
        success: true,
        analysis: null,
        message: 'No analysis found for this repository'
      });
    }

    // Check if user owns this analysis
    if (analysis.userId.toString() !== session.user.id) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Only auto-repair if we have substantial data (not just empty objects)
    if (analysis.status !== 'completed' && 
        analysis.summary && 
        analysis.metrics && 
        analysis.metrics.fileCount > 0 &&
        analysis.summary.trim().length > 50) {
      logger.warn(`Fixing corrupted analysis record ${analysis._id}: has substantial data but status is ${analysis.status}`);
      analysis.status = 'completed';
      await analysis.save();
    }

    // This is the final object we want to return AND cache
    const isCompleted = analysis.status === 'completed';
    const responsePayload = {
      success: true,
      analysis: {
        id: analysis._id,
        repositoryId: analysis.repositoryId,
        owner: analysis.owner,
        name: analysis.name,
        fullName: analysis.fullName,
        branch: analysis.branch,
        status: analysis.status,
        summary: isCompleted ? analysis.summary : null,
        metrics: isCompleted ? analysis.metrics : null,
        fileIndex: isCompleted ? analysis.fileIndex : null,
        analyzedAt: analysis.analyzedAt,
        duration: isCompleted ? analysis.duration : null,
        error: analysis.error,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    };

    // --- START of Caching Logic (SET) ---
    // Only cache if we looked up by owner/name and the result is final (completed or failed)
    if (owner && name && (analysis.status === 'completed' || analysis.status === 'failed')) {
      const redisKey = `analysis:status:${owner}:${name}`;
      const CACHE_TTL_SECONDS = 300; // 5 minutes
      try {
        // Cache the entire successful response payload
        await redisService.set(redisKey, responsePayload, CACHE_TTL_SECONDS);
        logger.info(`SET CACHE for ${redisKey}`);
      } catch (redisError) {
        logger.error(`Redis SET error for key ${redisKey}:`, redisError);
      }
    }
    // --- END of Caching Logic (SET) ---

    return NextResponse.json(responsePayload);

  } catch (error) {
    logger.error('Status check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get analysis status',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/repo/status/list
 * Get user's recent analyses
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

    await connectMongoose();

    const body = await request.json();
    const { limit = 20, repositoryId } = body;

    let query = { userId: session.user.id };
    
    // Filter by repository if specified
    if (repositoryId) {
      query.repositoryId = repositoryId;
    }

    // Get user's analyses
    const analyses = await RepoAnalysis.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-fileIndex'); // Don't include full file index

    // Get analysis stats
    const stats = await RepoAnalysis.getAnalysisStats(session.user.id);

    return NextResponse.json({
      success: true,
      analyses: analyses.map(analysis => ({
        id: analysis._id,
        repositoryId: analysis.repositoryId,
        owner: analysis.owner,
        name: analysis.name,
        fullName: analysis.fullName,
        branch: analysis.branch,
        status: analysis.status,
        analyzedAt: analysis.analyzedAt,
        duration: analysis.duration,
        metrics: analysis.metrics ? {
          fileCount: analysis.metrics.fileCount,
          totalLines: analysis.metrics.totalLines,
          languageCount: analysis.metrics.languageCount,
          totalSize: analysis.metrics.totalSize
        } : null,
        error: analysis.error,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      })),
      stats
    });

  } catch (error) {
    logger.error('Analysis list error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get analyses',
      details: error.message
    }, { status: 500 });
  }
}