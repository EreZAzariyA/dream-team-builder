/**
 * BMAD Agents API Endpoints
 * Provides information about available agents and their capabilities
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import BmadOrchestrator from '../../../../lib/bmad/BmadOrchestrator.js';

// Global orchestrator instance
let orchestrator = null;

/**
 * Initialize orchestrator if not already done
 */
async function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = new BmadOrchestrator();
    await orchestrator.initialize();
  }
  return orchestrator;
}

/**
 * GET /api/bmad/agents - Get all available agents
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bmad = await getOrchestrator();

    // Get all available agents
    const agents = bmad.getAvailableAgents();
    
    // Get workflow sequences
    const sequences = bmad.getWorkflowSequences();

    // Get system health
    const health = bmad.getSystemHealth();

    return NextResponse.json({
      success: true,
      agents,
      sequences: Object.keys(sequences).map(key => ({
        id: key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        steps: sequences[key],
        description: `${sequences[key].length} step workflow`
      })),
      system: health,
      meta: {
        agentCount: agents.length,
        sequenceCount: Object.keys(sequences).length,
        totalSteps: Object.values(sequences).reduce((sum, seq) => sum + seq.length, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', details: error.message },
      { status: 500 }
    );
  }
}