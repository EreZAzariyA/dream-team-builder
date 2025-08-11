/**
 * AI Service Usage Tracking API
 * Provides user-specific usage statistics and cost tracking
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { compose, withMethods, withErrorHandling, withRateLimit, withSecurityHeaders } from '../../../../lib/api/middleware.js';
import { aiService } from '../../../../lib/ai/AIService.js';

/**
 * GET /api/ai/usage
 * Get usage statistics for the authenticated user
 */
async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    const userStats = aiService.getUsageStats(userId);
    const globalStats = aiService.getGlobalUsageStats();
    
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



// Apply middleware - no withAuth needed since we handle session manually
const rateLimitedGET = compose(withMethods(['GET']), withRateLimit('general'), withSecurityHeaders, withErrorHandling)(GET);

export { rateLimitedGET as GET };