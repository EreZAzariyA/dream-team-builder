import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from '../../../../lib/auth/config.js';
import { AIService } from '../../../../lib/ai/AIService.js';

export async function GET(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe'); // hour, day, week
    const userId = searchParams.get('userId') || session.user.id;

    // Use AI service singleton instance
    const aiService = AIService.getInstance();
    
    // Get detailed usage statistics (now async)
    const stats = await aiService.getDetailedUsageStats(userId, timeframe);
    
    // Add current usage tracker stats for comparison
    const currentTrackerStats = aiService.usageTracker ? {
      userStats: aiService.usageTracker.getUserStats(userId),
      globalStats: aiService.usageTracker.getGlobalStats()
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        detailed: stats,
        tracker: currentTrackerStats,
        timeframe: timeframe || 'all',
        userId: userId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Usage stats error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch usage statistics',
      details: error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, timeframe, userId } = body;

    // Use AI service singleton instance
    const aiService = AIService.getInstance();

    if (action === 'export') {
      // Export detailed usage data
      const stats = await aiService.getDetailedUsageStats(userId || session.user.id, timeframe);
      
      return NextResponse.json({
        success: true,
        data: {
          exportData: stats,
          exportTimestamp: new Date().toISOString(),
          format: 'json'
        }
      });
    }

    if (action === 'clear') {
      // Clear usage data (admin only or own data)
      if (userId && userId !== session.user.id && !session.user.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized to clear other user data' }, { status: 403 });
      }

      // Clear the detailed usage store
      if (aiService.detailedUsageStore) {
        if (userId) {
          // Clear only specific user's data
          aiService.detailedUsageStore = aiService.detailedUsageStore.filter(
            entry => entry.userId !== userId
          );
        } else {
          // Clear all data (admin only)
          aiService.detailedUsageStore = [];
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Usage data cleared successfully'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Usage stats action error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process usage action',
      details: error.message
    }, { status: 500 });
  }
}