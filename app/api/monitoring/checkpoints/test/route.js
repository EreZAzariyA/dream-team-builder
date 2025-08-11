/**
 * Test Checkpoint Creation API
 * Creates test checkpoints for demonstration purposes
 */

import { NextResponse } from 'next/server';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import WorkflowCheckpoint from '../../../../../lib/database/models/WorkflowCheckpoint.js';

/**
 * POST /api/monitoring/checkpoints/test - Create a test checkpoint
 */
export async function POST(request) {
  try {
    await connectMongoose();

    const body = await request.json();
    const { workflowId, type = 'manual_checkpoint', description = 'Test checkpoint' } = body;

    // Generate test checkpoint data
    const testCheckpoint = new WorkflowCheckpoint({
      checkpointId: `test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      workflowId: workflowId || `test_workflow_${Date.now()}`,
      type,
      description,
      step: Math.floor(Math.random() * 5),
      currentAgent: ['pm', 'architect', 'dev', 'qa'][Math.floor(Math.random() * 4)],
      status: 'running',
      userId: 'test-user',
      state: {
        artifacts: [
          { type: 'document', name: 'Test PRD', content: 'Sample product requirements...' },
          { type: 'code', name: 'Test Implementation', content: 'Sample code implementation...' }
        ],
        messages: [
          { from: 'system', to: 'user', content: 'Test workflow started', timestamp: new Date() },
          { from: 'pm', to: 'system', content: 'PRD created successfully', timestamp: new Date() }
        ],
        errors: [],
        context: {
          initiatedBy: 'test-user',
          userPrompt: 'Build a test application with authentication',
          priority: 'medium'
        },
        metadata: {
          version: '1.0',
          source: 'test_ui',
          testData: true
        }
      }
    });

    const savedCheckpoint = await testCheckpoint.save();

    return NextResponse.json({
      success: true,
      checkpoint: {
        checkpointId: savedCheckpoint.checkpointId,
        workflowId: savedCheckpoint.workflowId,
        type: savedCheckpoint.type,
        description: savedCheckpoint.description,
        step: savedCheckpoint.step,
        stateSize: savedCheckpoint.stateSize,
        timestamp: savedCheckpoint.timestamp
      },
      message: 'Test checkpoint created successfully'
    });

  } catch (error) {
    logger.error('Error creating test checkpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create test checkpoint',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/monitoring/checkpoints/test - Clean up test checkpoints
 */
export async function DELETE() {
  try {
    await connectMongoose();

    // Delete all test checkpoints
    const result = await WorkflowCheckpoint.deleteMany({
      $or: [
        { workflowId: { $regex: /^test_/ } },
        { checkpointId: { $regex: /^test_/ } },
        { 'state.metadata.testData': true }
      ]
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleaned up ${result.deletedCount} test checkpoints`
    });

  } catch (error) {
    logger.error('Error cleaning up test checkpoints:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clean up test checkpoints',
        details: error.message 
      },
      { status: 500 }
    );
  }
}