/**
 * BMAD Test Endpoint (No Authentication Required)
 * For testing BMAD system functionality
 */

import { NextResponse } from 'next/server';
import BmadOrchestrator from '../../../../lib/bmad/BmadOrchestrator.js';
import logger from '@/lib/utils/logger.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import User from '../../../../lib/database/models/User.js';

// Global orchestrator instance for testing
let testOrchestrator = null;

/**
 * Initialize test orchestrator
 */
async function getTestOrchestrator() {
  if (!testOrchestrator) {
    testOrchestrator = new BmadOrchestrator();
    try {
      await testOrchestrator.initialize();
    } catch (error) {
      logger.error('Test orchestrator initialization failed:', error);
      // Continue with limited functionality
    }
  }
  return testOrchestrator;
}

/**
 * GET /api/bmad/test - Test BMAD system without authentication
 */
export async function GET() {
  try {
    const bmad = await getTestOrchestrator();

    // Get available agents
    const agents = bmad.getAvailableAgents();
    
    // Get workflow sequences
    const sequences = await bmad.getWorkflowSequences();

    // Get system health
    const health = bmad.getSystemHealth();

    return NextResponse.json({
      success: true,
      message: 'BMAD test endpoint working',
      system: {
        ...health,
        environment: 'test',
        timestamp: new Date().toISOString()
      },
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        title: agent.title,
        icon: agent.icon,
        status: agent.status
      })),
      sequences: sequences.map(key => ({
        id: key,
        name: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      })),
      endpoints: {
        '/api/bmad/test': 'This test endpoint (no auth required)',
        '/api/bmad/agents': 'Get agents (requires auth)',
        '/api/bmad/workflow': 'Workflow management (requires auth)'
      }
    });

  } catch (error) {
    logger.error('BMAD test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'BMAD test failed',
      details: error.message,
      system: {
        initialized: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/bmad/test - Test workflow execution without authentication
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userPrompt, sequence } = body;

    if (!userPrompt) {
      return NextResponse.json(
        { error: 'userPrompt is required' },
        { status: 400 }
      );
    }

    const bmad = await getTestOrchestrator();

    // Generate test workflow ID
    const workflowId = `test_workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Use the provided valid user ID for test execution
    const testUserId = "68aabf7b2a9f12fb8d1e5b58";
    logger.info('Using provided user ID for test execution:', testUserId);

    // Execute workflow with test configuration
    const result = await bmad.startWorkflow(userPrompt, {
      workflowId: workflowId,
      name: `Test Workflow - ${new Date().toLocaleDateString()}`,
      description: 'Test workflow execution via BMAD test endpoint',
      sequence: sequence || 'brownfield-fullstack',
      userId: testUserId,
      priority: 'normal',
      mockMode: true,
      context: {
        initiatedBy: testUserId,
        timestamp: new Date(),
        testExecution: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Test workflow started successfully',
      workflowId: result?.workflowId,
      status: result?.status || 'RUNNING',
      testMode: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('BMAD test workflow error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test workflow execution failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}