import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { AIServiceV2 } from '../../../../lib/ai/AIServiceV2.js';
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

    // Reinitialize the AI service with user keys (V2 API)
    const aiService = AIServiceV2.getInstance();
    const initResult = await aiService.reinitialize(apiKeys);

    if (initResult.success) {
      // Get updated health status
      const healthStatus = await aiService.healthCheck();

      return NextResponse.json({
        success: true,
        message: hasKeys
          ? 'AI service reinitialized with user API keys'
          : 'AI service reset to limited mode (no API keys)',
        providers: initResult.providers,
        healthStatus
      });
    } else {
      logger.error('Reinitialize failed:', initResult.error);
      return NextResponse.json({
        error: initResult.error?.message || 'Failed to reinitialize AI service',
        errorCode: initResult.error?.code,
        details: initResult.error?.details
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('AI reinitialize error:', error);
    return NextResponse.json(
      { error: 'Internal server error during AI service reinitialization' },
      { status: 500 }
    );
  }
}