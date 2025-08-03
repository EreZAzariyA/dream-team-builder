import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { ApiKeyValidator, Logger } from '../../../../lib/ai/AIService.js';

/**
 * POST /api/ai/validate-keys - Validate user-provided API keys
 * Tests if provided API keys are working without storing them
 */
export async function POST(request) {
  try {
    const { apiKeys } = await request.json();
    
    if (!apiKeys || typeof apiKeys !== 'object') {
      return NextResponse.json(
        { error: 'Invalid API keys provided' },
        { status: 400 }
      );
    }

    const results = {
      openai: null,
      gemini: null,
      valid: false
    };

    // Validate OpenAI key if provided
    if (apiKeys.openai) {
      const validation = ApiKeyValidator.validateOpenAI(apiKeys.openai);
      if (!validation.valid) {
        results.openai = {
          valid: false,
          error: validation.error
        };
      } else {
        try {
          const openaiClient = new OpenAI({ apiKey: apiKeys.openai });
          
          // Test with a minimal request
          const response = await openaiClient.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5
          });

          results.openai = {
            valid: true,
            model: 'gpt-3.5-turbo',
            usage: response.usage
          };
        } catch (error) {
          results.openai = {
            valid: false,
            error: error.message || 'Invalid OpenAI API key'
          };
        }
      }
    }

    // Validate Gemini key if provided
    if (apiKeys.gemini) {
      const validation = ApiKeyValidator.validateGemini(apiKeys.gemini);
      if (!validation.valid) {
        results.gemini = {
          valid: false,
          error: validation.error
        };
      } else {
        try {
          const geminiClient = new GoogleGenerativeAI(apiKeys.gemini);
          const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
          
          // Test with a minimal request
          const result = await model.generateContent('test');
          const response = await result.response;
          const text = response.text();

          results.gemini = {
            valid: true,
            model: 'gemini-2.5-flash',
            response: text?.trim()
          };
        } catch (error) {
          results.gemini = {
            valid: false,
            error: error.message || 'Invalid Gemini API key'
          };
        }
      }
    }

    // Overall validation status
    results.valid = (results.openai?.valid || results.gemini?.valid) || false;

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    Logger.error('API key validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error during validation' },
      { status: 500 }
    );
  }
}