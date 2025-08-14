import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { validateSessionAndGetUser } from '../../../../lib/utils/userLookup.js';
import { ApiKeyValidator } from '../../../../lib/ai/AIService.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/user/api-keys - Get user's API keys (returns masked versions for security)
 * Query parameter: ?includeValues=true to get actual values
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error, status } = await validateSessionAndGetUser(session);
    
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Get decrypted API keys
    const apiKeys = user.getApiKeys();
    
    // Check if actual values are requested
    const { searchParams } = new URL(request.url);
    const includeValues = searchParams.get('includeValues') === 'true';
    
    let result;
    if (includeValues) {
      // Return actual values (for display purposes)
      result = {
        openai: apiKeys.openai || '',
        gemini: apiKeys.gemini || '',
        hasOpenai: !!apiKeys.openai,
        hasGemini: !!apiKeys.gemini,
        updatedAt: apiKeys.updatedAt
      };
    } else {
      // Return only boolean flags for security
      result = {
        hasOpenai: !!apiKeys.openai,
        hasGemini: !!apiKeys.gemini,
        updatedAt: apiKeys.updatedAt
      };
    }

    return NextResponse.json({
      success: true,
      apiKeys: result
    });

  } catch (error) {
    logger.error('Get API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/api-keys - Save user's API keys (encrypted)
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error, status } = await validateSessionAndGetUser(session);
    
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const { apiKeys } = await request.json();
    
    if (!apiKeys || typeof apiKeys !== 'object') {
      return NextResponse.json(
        { error: 'Invalid API keys provided' },
        { status: 400 }
      );
    }

    // Validate that at least one key is provided
    if (!apiKeys.openai && !apiKeys.gemini) {
      return NextResponse.json(
        { error: 'At least one API key (OpenAI or Gemini) must be provided' },
        { status: 400 }
      );
    }

    // Validate API key formats using our validator
    logger.info('Validating API keys:', { 
      hasOpenai: !!apiKeys.openai, 
      hasGemini: !!apiKeys.gemini,
      openaiPrefix: apiKeys.openai?.substring(0, 5),
      geminiPrefix: apiKeys.gemini?.substring(0, 5)
    });
    
    const validation = ApiKeyValidator.validateAll(apiKeys);
    logger.info('Validation result:', validation);
    
    if (!validation.valid) {
      logger.error('API key validation failed:', validation.errors);
      return NextResponse.json(
        { error: 'No valid API keys provided', details: validation.errors },
        { status: 400 }
      );
    }

    // Set API keys
    logger.info('📝 About to call user.setApiKeys with:', { hasOpenai: !!apiKeys.openai, hasGemini: !!apiKeys.gemini });
    user.setApiKeys(apiKeys);
        logger.info('💾 About to save user...');
    await user.save();
            logger.info('✅ User saved successfully');

    // Reinitialize AI service with new keys - use singleton instance
    logger.info('🔄 Reinitializing AI service with new keys...');
    const { AIService } = await import('../../../../lib/ai/AIService.js');
    const aiService = AIService.getInstance();
    await aiService.initialize(apiKeys, session.user.id);
    logger.info('✅ AI service reinitialized successfully');

    // Return success with masked keys
    const savedKeys = user.getApiKeys();
    const maskedKeys = {
      openai: savedKeys.openai ? savedKeys.openai.substring(0, 8) + '...' + savedKeys.openai.slice(-4) : null,
      gemini: savedKeys.gemini ? savedKeys.gemini.substring(0, 8) + '...' + savedKeys.gemini.slice(-4) : null,
      hasOpenai: !!savedKeys.openai,
      hasGemini: !!savedKeys.gemini,
      updatedAt: savedKeys.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: 'API keys saved successfully',
      apiKeys: maskedKeys
    });

  } catch (error) {
    logger.error('Save API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/api-keys - Update individual API key
 */
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    const { user, error, status } = await validateSessionAndGetUser(session);
    
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const { provider, apiKey, action } = await request.json();
    
    // Validate provider
    if (!provider || !['openai', 'gemini'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "gemini"' },
        { status: 400 }
      );
    }

    // Handle different actions
    if (action === 'clear') {
      // Clear specific provider key
      const currentKeys = user.getApiKeys();
      const updatedKeys = { ...currentKeys };
      updatedKeys[provider] = null;
      
      // Remove null values for setApiKeys
      const keysToSave = {};
      if (updatedKeys.openai) keysToSave.openai = updatedKeys.openai;
      if (updatedKeys.gemini) keysToSave.gemini = updatedKeys.gemini;
      
      user.setApiKeys(keysToSave);
      await user.save();

      // Reinitialize AI service
      const { AIService } = await import('../../../../lib/ai/AIService.js');
      const aiService = AIService.getInstance();
      await aiService.initialize(keysToSave, session.user.id);

      return NextResponse.json({
        success: true,
        message: `${provider} API key cleared successfully`,
        provider,
        action: 'cleared'
      });
    } else {
      // Save/update API key
      if (!apiKey || !apiKey.trim()) {
        return NextResponse.json(
          { error: 'API key is required' },
          { status: 400 }
        );
      }

      // Validate API key format
      const keysToValidate = { [provider]: apiKey.trim() };
      const validation = ApiKeyValidator.validateAll(keysToValidate);
      
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid ${provider} API key format`, details: validation.errors },
          { status: 400 }
        );
      }

      // Get current keys and update specific provider
      const currentKeys = user.getApiKeys();
      const updatedKeys = {
        openai: currentKeys.openai || '',
        gemini: currentKeys.gemini || '',
        [provider]: apiKey.trim()
      };

      // Remove empty values
      const keysToSave = {};
      if (updatedKeys.openai) keysToSave.openai = updatedKeys.openai;
      if (updatedKeys.gemini) keysToSave.gemini = updatedKeys.gemini;

      user.setApiKeys(keysToSave);
      await user.save();

      // Reinitialize AI service
      const { AIService } = await import('../../../../lib/ai/AIService.js');
      const aiService = AIService.getInstance();
      await aiService.initialize(keysToSave, session.user.id);

      return NextResponse.json({
        success: true,
        message: `${provider} API key saved successfully`,
        provider,
        action: 'saved'
      });
    }

  } catch (error) {
    logger.error('Update API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/api-keys - Clear user's API keys
 */
export async function DELETE() {
  try {
    const { user, session, error } = await validateSessionAndGetUser(await getServerSession(authOptions));
    if (error) {
      return NextResponse.json({ error }, { status: error === 'Authentication required' ? 401 : 404 });
    }

    // Clear API keys
    user.clearApiKeys();
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'API keys cleared successfully'
    });

  } catch (error) {
    logger.error('Clear API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}