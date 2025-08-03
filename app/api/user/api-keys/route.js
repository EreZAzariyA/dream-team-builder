import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import { User } from '../../../../lib/database/models/index.js';
import { ApiKeyValidator, Logger } from '../../../../lib/ai/AIService.js';

/**
 * GET /api/user/api-keys - Get user's API keys (returns masked versions for security)
 * Query parameter: ?includeValues=true to get actual values
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectMongoose();
    
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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
    Logger.error('Get API keys error:', error);
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
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
    Logger.info('Validating API keys:', { 
      hasOpenai: !!apiKeys.openai, 
      hasGemini: !!apiKeys.gemini,
      openaiPrefix: apiKeys.openai?.substring(0, 5),
      geminiPrefix: apiKeys.gemini?.substring(0, 5)
    });
    
    const validation = ApiKeyValidator.validateAll(apiKeys);
    Logger.info('Validation result:', validation);
    
    if (!validation.valid) {
      Logger.error('API key validation failed:', validation.errors);
      return NextResponse.json(
        { error: 'No valid API keys provided', details: validation.errors },
        { status: 400 }
      );
    }

    await connectMongoose();
    
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Set API keys
    console.log('📝 About to call user.setApiKeys with:', { hasOpenai: !!apiKeys.openai, hasGemini: !!apiKeys.gemini });
    user.setApiKeys(apiKeys);
    console.log('💾 About to save user...');
    await user.save();
    console.log('✅ User saved successfully');

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
    Logger.error('Save API keys error:', error);
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectMongoose();
    
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Clear API keys
    user.clearApiKeys();
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'API keys cleared successfully'
    });

  } catch (error) {
    Logger.error('Clear API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}