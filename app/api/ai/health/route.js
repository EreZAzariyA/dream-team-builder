/**
 * AI Service Health Monitoring API
 * Provides health status, circuit breaker state, and usage statistics
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { compose, withMethods, withAuth, withErrorHandling, withRateLimit, withSecurityHeaders } from '../../../../lib/api/middleware.js';
import { AIServiceV2 } from '../../../../lib/ai/AIServiceV2.js';

/**
 * GET /api/ai/health
 * Get comprehensive AI service health status
 */
async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Ensure AI service is initialized with user context (V2 explicit initialization)
    const aiService = AIServiceV2.getInstance();
    if (!aiService.initialized) {
      const initResult = await aiService.initialize({ userId });
      if (!initResult.success) {
        return NextResponse.json({
          status: 'uninitialized',
          error: initResult.error?.message || 'Failed to initialize',
          errorCode: initResult.error?.code,
          timestamp: new Date().toISOString()
        }, { status: 503 }); // Service Unavailable
      }
    }

    const healthStatus = await aiService.healthCheck();
    const initState = aiService.getInitializationState();

    return NextResponse.json({
      ...healthStatus,
      initialization: initState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/ai/health
 * Perform health check and update provider status
 */
async function POST() {
  try {
    // Force a fresh health check and get the results
    const aiService = AIServiceV2.getInstance();
    const healthStatus = await aiService.healthCheck();

    return NextResponse.json({
      message: 'Health check completed',
      ...healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * PATCH /api/ai/health
 * Admin endpoint to reset circuit breakers or update provider priority
 */
async function PATCH(req) {
  try {
    const body = await req.json();
    const { action, data } = body;

    if (action === 'reset-circuit-breakers') {
      const aiService = AIServiceV2.getInstance();
      aiService.resetCircuitBreakers();
      return NextResponse.json({
        message: 'Circuit breakers reset successfully',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'update-provider-priority' && data?.priority) {
      const aiService = AIServiceV2.getInstance();
      aiService.setProviderPriority(data.priority);
      return NextResponse.json({
        message: 'Provider priority updated',
        newPriority: data.priority,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Supported actions: reset-circuit-breakers, update-provider-priority'
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Apply middleware with rate limiting and security headers
const rateLimitedGET = compose(withMethods(['GET']), withRateLimit('general'), withSecurityHeaders, withErrorHandling)(GET);
const authenticatedPOST = compose(withMethods(['POST']), withAuth, withRateLimit('general'), withSecurityHeaders, withErrorHandling)(POST);
const authenticatedPATCH = compose(withMethods(['PATCH']), withAuth, withRateLimit('expensive'), withSecurityHeaders, withErrorHandling)(PATCH);

export { rateLimitedGET as GET, authenticatedPOST as POST, authenticatedPATCH as PATCH };