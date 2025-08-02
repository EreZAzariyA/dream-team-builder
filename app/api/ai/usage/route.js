/**
 * AI Service Usage Tracking API
 * Provides user-specific usage statistics and cost tracking
 */

import { NextResponse } from 'next/server';
import { compose, withMethods, withAuth, withErrorHandling } from '../../../../lib/api/middleware.js';
import { aiService } from '../../../../lib/ai/AIService.js';

/**
 * GET /api/ai/usage
 * Get usage statistics for the authenticated user
 */
async function GET(req) {
  try {
    const userId = req.user.id;
    const userStats = aiService.getUserUsageStats(userId);
    const globalStats = aiService.usageTracker.getGlobalStats();
    
    return NextResponse.json({
      user: {
        id: userId,
        stats: userStats || {
          requests: 0,
          tokens: 0,
          cost: 0,
          providers: {}
        }
      },
      global: globalStats,
      limits: {
        dailyRequests: 1000,
        dailyCost: 10
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/ai/usage/check-limits
 * Check if user can make additional AI requests
 */
async function checkLimits(req) {
  try {
    const userId = req.user.id;
    const limitsCheck = aiService.usageTracker.checkUserLimits(userId);
    
    return NextResponse.json({
      ...limitsCheck,
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Apply middleware
const authenticatedGET = compose(withMethods(['GET']), withAuth, withErrorHandling)(GET);

export { authenticatedGET as GET };