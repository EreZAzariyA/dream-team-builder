import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth/config.js';
import { aiService, Logger } from '../../../lib/ai/AIService.js';
import { compose, withMethods, withAuth, withRateLimit, withErrorHandling } from '../../../lib/api/middleware.js';

async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'anonymous';
    
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

    // Generate response with proper user context
    const response = await aiService.generateAgentResponse(
      testAgentDefinition,
      message,
      [],
      userId
    );

    return NextResponse.json({
      success: true,
      healthStatus,
      response,
      meta: {
        userId: userId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    Logger.error('Test AI error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Apply middleware for rate limiting and security
export const { POST: rateLimitedPOST } = compose(
  withMethods(['POST']),
  withRateLimit('general'),
  withErrorHandling
)(POST);

export { rateLimitedPOST as POST };