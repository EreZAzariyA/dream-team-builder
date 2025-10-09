/**
 * AI Service Health Monitoring API
 * Provides health status, circuit breaker state, and usage statistics
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import { compose, withMethods, withAuth, withErrorHandling, withRateLimit, withSecurityHeaders } from '../../../../lib/api/middleware.js';
import { AIService } from '../../../../lib/ai/AIService.js';

/**
 * GET /api/ai/health
 * Get comprehensive AI service health status
 */
async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    
    // Ensure AI service is initialized with user context
    const aiService = AIService.getInstance();
    if (!aiService.initialized) {
      await aiService.initialize(null, userId);
    }
    
    const healthStatus = await aiService.healthCheck();
    const systemStatus = aiService.getSystemStatus();
    
    return NextResponse.json({
      ...healthStatus,
      system: systemStatus,
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
    const aiService = AIService.getInstance();
    const healthStatus = await aiService.checkHealth();
    
    return NextResponse.json({
      message: 'Health check completed',
      providers: healthStatus, // checkHealth returns the providers object
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
      const aiService = AIService.getInstance();
      aiService.resetCircuitBreakers();
      return NextResponse.json({
        message: 'Circuit breakers reset successfully',
        timestamp: new Date().toISOString()
      });
    }
    
    if (action === 'update-provider-priority' && data?.priority) {
      const aiService = AIService.getInstance();
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