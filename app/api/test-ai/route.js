import { NextResponse } from 'next/server';
import { aiService } from '../../../lib/ai/AIService.js';

export async function POST(request) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Message is required'
      }, { status: 400 });
    }

    // Test health check first
    const healthStatus = await aiService.healthCheck();
    console.log('Health check result:', healthStatus);

    // Create a simple agent definition for testing
    const testAgentDefinition = {
      agent: {
        id: 'test-agent',
        name: 'Test Agent',
        title: 'Test Assistant',
        icon: '🧪'
      },
      persona: {
        role: 'Test assistant for debugging AI connections',
        style: 'Direct and helpful',
        identity: 'I am a test agent used to verify AI service functionality',
        focus: 'Testing and debugging',
        core_principles: [
          'Provide clear test responses',
          'Help diagnose issues',
          'Be concise and direct'
        ]
      }
    };

    // Generate response
    const response = await aiService.generateAgentResponse(
      testAgentDefinition,
      message,
      []
    );

    return NextResponse.json({
      success: true,
      healthStatus,
      response,
      environment: {
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        keyLength: process.env.GEMINI_API_KEY?.length || 0
      }
    });

  } catch (error) {
    console.error('Test AI error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}