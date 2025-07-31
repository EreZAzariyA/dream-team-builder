/**
 * BMAD Test Endpoint (No Authentication Required)
 * For testing BMAD system functionality
 */

import { NextResponse } from 'next/server';
import BmadOrchestrator from '../../../../lib/bmad/BmadOrchestrator.js';

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
      console.error('Test orchestrator initialization failed:', error);
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
    const sequences = bmad.getWorkflowSequences();

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
      sequences: Object.keys(sequences).map(key => ({
        id: key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        steps: sequences[key].length,
        description: `${sequences[key].length} step workflow`
      })),
      endpoints: {
        '/api/bmad/test': 'This test endpoint (no auth required)',
        '/api/bmad/agents': 'Get agents (requires auth)',
        '/api/bmad/workflow': 'Workflow management (requires auth)'
      }
    });

  } catch (error) {
    console.error('BMAD test endpoint error:', error);
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