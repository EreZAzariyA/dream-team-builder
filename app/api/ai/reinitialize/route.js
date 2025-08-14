import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { AIService } from '../../../../lib/ai/AIService.js';
import logger from '@/lib/utils/logger.js';

/**
 * Reinitialize AI service with user-provided API keys
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { apiKeys } = await request.json();
    
    if (!apiKeys || typeof apiKeys !== 'object') {
      return NextResponse.json(
        { error: 'Invalid API keys provided' },
        { status: 400 }
      );
    }

    // For clearing keys, allow empty object
    const hasKeys = apiKeys.openai || apiKeys.gemini;
    
    // If keys are provided, validate them
    if (hasKeys && !apiKeys.openai && !apiKeys.gemini) {
      return NextResponse.json(
        { error: 'At least one API key (OpenAI or Gemini) must be provided' },
        { status: 400 }
      );
    }

    // Initialize the AI service with user keys and current user's ID - use singleton instance
    const userId = session?.user?.id || null;
    const aiService = AIService.getInstance();
    const success = await aiService.initialize(apiKeys, userId);
    
    if (success) {
      // Get updated health status
      const healthStatus = await aiService.healthCheck();
      
      return NextResponse.json({
        success: true,
        message: hasKeys ? 'AI service reinitialized with user API keys' : 'AI service reset to limited mode (no API keys)',
        healthStatus
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to reinitialize AI service' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('AI reinitialize error:', error);
    return NextResponse.json(
      { error: 'Internal server error during AI service reinitialization' },
      { status: 500 }
    );
  }
}