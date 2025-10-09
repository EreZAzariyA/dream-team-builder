import mongoose from 'mongoose';
import WorkflowCheckpoint from '../../lib/database/models/WorkflowCheckpoint.js';
import { jest } from '@jest/globals';

describe('WorkflowCheckpoint Model', () => {
  // Mock mongoose connection and model methods
  beforeAll(() => {
    jest.spyOn(mongoose, 'connect').mockResolvedValue(true);
    jest.spyOn(mongoose.connection, 'close').mockResolvedValue(true);
    jest.spyOn(mongoose.connection, 'collections', 'get').mockReturnValue({
      workflow_checkpoints: { deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }) }
    });
    jest.spyOn(mongoose, 'model').mockImplementation((name, schema) => {
      if (name === 'WorkflowCheckpoint') {
        return class MockWorkflowCheckpoint {
          constructor(data) {
            Object.assign(this, data);
            this.save = jest.fn().mockResolvedValue(this);
          }
          static find() { return { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }; }
          static findOne() { return { sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) }; }
          static deleteMany() { return jest.fn().mockResolvedValue({ deletedCount: 1 }); }
          static create(data) { return new MockWorkflowCheckpoint(data); }
        };
      }
      return jest.requireActual('mongoose').model(name, schema);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create a new workflow checkpoint', async () => {
    const checkpointData = {
      checkpointId: 'test-checkpoint-1',
      workflowId: 'test-workflow-1',
      type: 'manual_checkpoint',
      step: 1,
      status: 'running',
      userId: 'user123',
    };
    const checkpoint = await WorkflowCheckpoint.create(checkpointData);

    expect(checkpoint).toBeDefined();
    expect(checkpoint.checkpointId).toBe(checkpointData.checkpointId);
    expect(checkpoint.workflowId).toBe(checkpointData.workflowId);
    expect(checkpoint.type).toBe(checkpointData.type);
    expect(checkpoint.save).toHaveBeenCalledTimes(1);
  });

  test('should calculate state size on save', async () => {
    const checkpoint = new WorkflowCheckpoint({
      checkpointId: 'test-checkpoint-2',
      workflowId: 'test-workflow-2',
      type: 'manual_checkpoint',
      step: 1,
      status: 'running',
      userId: 'user123',
      state: {
        artifacts: [{ name: 'test.txt', content: 'hello' }],
        messages: [{ text: 'message' }],
      },
    });
    await checkpoint.save();

    expect(checkpoint.stateSize).toBeGreaterThan(0);
  });

  test('should set expiresAt on save if not provided', async () => {
    const checkpoint = new WorkflowCheckpoint({
      checkpointId: 'test-checkpoint-3',
      workflowId: 'test-workflow-3',
      type: 'manual_checkpoint',
      step: 1,
      status: 'running',
      userId: 'user123',
    });
    await checkpoint.save();

    expect(checkpoint.expiresAt).toBeInstanceOf(Date);
  });

  // Static methods tests
  test('findByWorkflow should return checkpoints for a given workflow', async () => {
    const mockCheckpoints = [{ checkpointId: 'wf-cp-1' }, { checkpointId: 'wf-cp-2' }];
    WorkflowCheckpoint.find.mockReturnValueOnce({ 
      sort: jest.fn().mockReturnThis(), 
      limit: jest.fn().mockReturnThis(), 
      select: jest.fn().mockReturnThis(), 
      lean: jest.fn().mockResolvedValue(mockCheckpoints) 
    });

    const checkpoints = await WorkflowCheckpoint.findByWorkflow('test-workflow-id');
    expect(checkpoints).toEqual(mockCheckpoints);
    expect(WorkflowCheckpoint.find).toHaveBeenCalledWith({ workflowId: 'test-workflow-id' });
  });

  test('findLatestByType should return the latest checkpoint of a specific type', async () => {
    const mockCheckpoint = { checkpointId: 'latest-cp' };
    WorkflowCheckpoint.findOne.mockReturnValueOnce({ 
      sort: jest.fn().mockReturnThis(), 
      lean: jest.fn().mockResolvedValue(mockCheckpoint) 
    });

    const checkpoint = await WorkflowCheckpoint.findLatestByType('test-workflow-id', 'manual_checkpoint');
    expect(checkpoint).toEqual(mockCheckpoint);
    expect(WorkflowCheckpoint.findOne).toHaveBeenCalledWith({ workflowId: 'test-workflow-id', type: 'manual_checkpoint' });
  });

  test('cleanup should delete old checkpoints', async () => {
    const cutoffDate = new Date();
    jest.spyOn(global, 'Date').mockImplementation(() => cutoffDate); // Mock Date.now()
    
    await WorkflowCheckpoint.cleanup(7); // 7 days old

    expect(WorkflowCheckpoint.deleteMany).toHaveBeenCalledWith({
      timestamp: { $lt: new Date(cutoffDate.getTime() - (7 * 24 * 60 * 60 * 1000)) },
      type: { $ne: 'workflow_completed' }
    });
  });
});