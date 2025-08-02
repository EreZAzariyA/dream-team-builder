/**
 * AI Service Health Monitoring API
 * Provides health status, circuit breaker state, and usage statistics
 */

import { NextResponse } from 'next/server';
import { compose, withMethods, withAuth, withErrorHandling } from '../../../../lib/api/middleware.js';
import { aiService } from '../../../../lib/ai/AIService.js';

/**
 * GET /api/ai/health
 * Get comprehensive AI service health status
 */
async function GET(req) {
  try {
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
async function POST(req) {
  try {
    // Force a fresh health check
    await aiService.performHealthChecks();
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
      aiService.resetCircuitBreakers();
      return NextResponse.json({
        message: 'Circuit breakers reset successfully',
        timestamp: new Date().toISOString()
      });
    }
    
    if (action === 'update-provider-priority' && data?.priority) {
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

// Apply middleware  
const authenticatedPOST = compose(withMethods(['POST']), withAuth, withErrorHandling)(POST);
const authenticatedPATCH = compose(withMethods(['PATCH']), withAuth, withErrorHandling)(PATCH);

export { GET, authenticatedPOST as POST, authenticatedPATCH as PATCH };