import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';

/**
 * POST /api/repo/bulk-status
 * Get analysis status for multiple repositories
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const { repositories } = await request.json();
    
    if (!repositories || !Array.isArray(repositories)) {
      return NextResponse.json({ error: 'Invalid repositories array' }, { status: 400 });
    }

    // Create query to find analyses for these repositories
    const repoQueries = repositories.map(repo => ({
      $or: [
        { repositoryId: repo.id?.toString() },
        { owner: repo.owner?.login, name: repo.name, userId: session.user.id }
      ]
    }));

    // Find all analyses for these repositories
    const analyses = await RepoAnalysis.find({
      $or: repoQueries,
      userId: session.user.id
    }).select('repositoryId owner name status createdAt updatedAt metrics.fileCount metrics.totalLines metrics.languageCount')
      .sort({ createdAt: -1 });

    // Create status map
    const statusMap = {};
    const recentlyAnalyzed = [];

    for (const analysis of analyses) {
      const key = analysis.repositoryId || `${analysis.owner}/${analysis.name}`;
      
      if (!statusMap[key]) {
        statusMap[key] = {
          status: analysis.status,
          analysisId: analysis._id.toString(),
          analyzedAt: analysis.updatedAt || analysis.createdAt,
          metrics: analysis.metrics ? {
            fileCount: analysis.metrics.fileCount,
            totalLines: analysis.metrics.totalLines,
            languageCount: analysis.metrics.languageCount
          } : null
        };

        // Add to recently analyzed if completed and within 7 days
        if (analysis.status === 'completed') {
          const daysSinceAnalysis = (Date.now() - new Date(analysis.updatedAt || analysis.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceAnalysis <= 7) {
            recentlyAnalyzed.push({
              repositoryId: analysis.repositoryId,
              owner: analysis.owner,
              name: analysis.name,
              fullName: `${analysis.owner}/${analysis.name}`,
              analyzedAt: analysis.updatedAt || analysis.createdAt,
              metrics: statusMap[key].metrics
            });
          }
        }
      }
    }

    // Sort recently analyzed by date (most recent first)
    recentlyAnalyzed.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));

    return NextResponse.json({
      success: true,
      statusMap,
      recentlyAnalyzed: recentlyAnalyzed.slice(0, 10) // Limit to 10 most recent
    });

  } catch (error) {
    console.error('Bulk status check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check repository status'
    }, { status: 500 });
  }
}