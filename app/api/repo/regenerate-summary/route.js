
/**
 * Repository Analysis API - Regenerate Summary Route
 * Regenerates the AI summary for an existing analysis
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';
import { generateAISummary } from '@/lib/ai/summarizer.js';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    await connectMongoose();

    const body = await request.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ success: false, error: 'Missing required field: analysisId' }, { status: 400 });
    }

    const analysis = await RepoAnalysis.findById(analysisId);

    if (!analysis) {
      return NextResponse.json({ success: false, error: 'Analysis not found' }, { status: 404 });
    }

    if (analysis.userId.toString() !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    logger.info(`Regenerating AI summary for analysis: ${analysisId}`);

    const result = await generateAISummary(analysis, analysis.fileIndex, analysis.metrics, session.user.id);

    if (result.success) {
      // Save successful summary
      analysis.summary = result.content;
      analysis.updatedAt = new Date();
      await analysis.save();

      logger.info(`Successfully regenerated AI summary for analysis: ${analysisId}`);
      return NextResponse.json({
        success: true,
        summary: result.content,
        type: result.type,
        provider: result.provider
      });
    } else {
      // Don't save failed summary, just return error
      logger.error(`AI summary generation failed for analysis: ${analysisId}, error: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error,
        message: 'Failed to generate AI summary'
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('Failed to regenerate AI summary:', error);
    return NextResponse.json({ success: false, error: 'Failed to regenerate AI summary' }, { status: 500 });
  }
}
