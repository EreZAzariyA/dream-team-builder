import mongoose from 'mongoose';
import Workflow from '../../lib/database/models/Workflow.js';
import { jest } from '@jest/globals';

describe('Workflow Model', () => {
  // Mock mongoose connection and model methods
  beforeAll(() => {
    jest.spyOn(mongoose, 'connect').mockResolvedValue(true);
    jest.spyOn(mongoose.connection, 'close').mockResolvedValue(true);
    jest.spyOn(mongoose.connection, 'collections', 'get').mockReturnValue({
      workflows: { deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }) }
    });
    jest.spyOn(mongoose, 'model').mockImplementation((name, schema) => {
      if (name === 'Workflow') {
        return class MockWorkflow {
          constructor(data) {
            Object.assign(this, data);
            this.save = jest.fn().mockResolvedValue(this);
          }
          static find() { return { sort: jest.fn().mockReturnThis(), find: jest.fn().mockResolvedValue([]) }; }
          static findOne() { return jest.fn().mockResolvedValue(null); }
          static findById() { return jest.fn().mockResolvedValue(null); }
          static create(data) { return new MockWorkflow(data); }
          static aggregate() { return jest.fn().mockResolvedValue([]); }
          start() { this.status = 'RUNNING'; this.startedAt = new Date(); return this.save(); }
          complete() { this.status = 'COMPLETED'; this.completedAt = new Date(); return this.save(); }
          pause() { this.status = 'PAUSED'; this.pausedAt = new Date(); return this.save(); }
          resume() { this.status = 'RUNNING'; this.pausedAt = null; return this.save(); }
          cancel() { this.status = 'CANCELLED'; this.completedAt = new Date(); return this.save(); }
          addError(agentId, agentName, error) { this.errors.push({ agentId, agentName, error }); this.status = 'ERROR'; return this.save(); }
          resolveError(errorId) { /* simplified */ return this.save(); }
          getApiKeys() { return { openai: null, gemini: null }; } // Mock for pre-save
          setApiKeys() {} // Mock for pre-save
        };
      }
      return jest.requireActual('mongoose').model(name, schema);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create a new workflow', async () => {
    const workflowData = {
      workflowId: 'test-workflow-1',
      title: 'Test Workflow',
      description: 'A workflow for testing',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
      template: 'greenfield-fullstack',
    };
    const workflow = await Workflow.create(workflowData);

    expect(workflow).toBeDefined();
    expect(workflow.workflowId).toBe(workflowData.workflowId);
    expect(workflow.status).toBe('PAUSED');
    expect(workflow.save).toHaveBeenCalledTimes(1);
  });

  test('should update workflow status to RUNNING when start is called', async () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-2',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
    });
    await workflow.start();
    expect(workflow.status).toBe('RUNNING');
    expect(workflow.startedAt).toBeInstanceOf(Date);
    expect(workflow.save).toHaveBeenCalledTimes(1);
  });

  test('should update workflow status to COMPLETED when complete is called', async () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-3',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
    });
    await workflow.complete();
    expect(workflow.status).toBe('COMPLETED');
    expect(workflow.completedAt).toBeInstanceOf(Date);
    expect(workflow.save).toHaveBeenCalledTimes(1);
  });

  test('should add an error and set status to ERROR', async () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-4',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
      errors: [],
    });
    await workflow.addError('dev', 'Developer Agent', 'Something went wrong');
    expect(workflow.errors.length).toBe(1);
    expect(workflow.status).toBe('ERROR');
    expect(workflow.errors[0].error).toBe('Something went wrong');
    expect(workflow.save).toHaveBeenCalledTimes(1);
  });

  test('should update execution context on save', async () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-5',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
      bmadWorkflowData: {
        sequence: [{ agentId: 'a', order: 0 }, { agentId: 'b', order: 1 }],
        totalSteps: 2,
        currentStep: 1,
      },
    });
    await workflow.save(); // Pre-save hook should update context

    expect(workflow.executionContext.totalSteps).toBe(2);
    expect(workflow.executionContext.currentStep).toBe(1);
    expect(workflow.executionContext.completedSteps).toBe(1);
  });

  test('should calculate progress correctly', () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-6',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
      executionContext: {
        totalSteps: 10,
        completedSteps: 5,
      },
    });
    expect(workflow.progress).toBe(50);
  });

  test('should return 0 progress if totalSteps is 0', () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-7',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
      executionContext: {
        totalSteps: 0,
        completedSteps: 0,
      },
    });
    expect(workflow.progress).toBe(0);
  });

  test('should calculate duration correctly', () => {
    const startedAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
    const completedAt = new Date();
    const workflow = new Workflow({
      workflowId: 'test-workflow-8',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
      startedAt,
      completedAt,
    });
    expect(workflow.duration).toBeCloseTo(60 * 1000, -2); // Within 100ms
  });

  test('should return 0 duration if not started', () => {
    const workflow = new Workflow({
      workflowId: 'test-workflow-9',
      title: 'Test Workflow',
      userId: new mongoose.Types.ObjectId(),
      prompt: 'Test prompt',
    });
    expect(workflow.duration).toBe(0);
  });

  test('should correctly identify active status', () => {
    const runningWorkflow = new Workflow({ status: 'RUNNING' });
    const pausedWorkflow = new Workflow({ status: 'PAUSED' });
    const elicitationWorkflow = new Workflow({ status: 'PAUSED_FOR_ELICITATION' });
    const completedWorkflow = new Workflow({ status: 'COMPLETED' });

    expect(runningWorkflow.isActive).toBe(true);
    expect(pausedWorkflow.isActive).toBe(true);
    expect(elicitationWorkflow.isActive).toBe(true);
    expect(completedWorkflow.isActive).toBe(false);
  });

  test('should correctly identify if workflow has errors', () => {
    const workflowWithError = new Workflow({ errors: [{ error: 'test', resolved: false }] });
    const workflowWithoutError = new Workflow({ errors: [] });
    const workflowWithResolvedError = new Workflow({ errors: [{ error: 'test', resolved: true }] });

    expect(workflowWithError.hasErrors).toBe(true);
    expect(workflowWithoutError.hasErrors).toBe(false);
    expect(workflowWithResolvedError.hasErrors).toBe(false);
  });

  // Static methods tests
  test('findByUser should return workflows for a given user', async () => {
    const mockWorkflows = [{ workflowId: 'user-wf-1' }, { workflowId: 'user-wf-2' }];
    Workflow.find.mockReturnValueOnce({ sort: jest.fn().mockReturnThis(), find: jest.fn().mockResolvedValue(mockWorkflows) });

    const workflows = await Workflow.findByUser(new mongoose.Types.ObjectId());
    expect(workflows).toEqual(mockWorkflows);
    expect(Workflow.find).toHaveBeenCalledTimes(1);
  });

  test('findActive should return active workflows', async () => {
    const mockActiveWorkflows = [{ workflowId: 'active-wf-1' }];
    Workflow.find.mockReturnValueOnce({ sort: jest.fn().mockReturnThis(), find: jest.fn().mockResolvedValue(mockActiveWorkflows) });

    const activeWorkflows = await Workflow.findActive();
    expect(activeWorkflows).toEqual(mockActiveWorkflows);
    expect(Workflow.find).toHaveBeenCalledWith({ status: { $in: ['RUNNING', 'PAUSED', 'PAUSED_FOR_ELICITATION'] } });
  });

  test('getWorkflowStats should return correct statistics', async () => {
    const mockStats = [{ _id: 'COMPLETED', count: 5 }];
    Workflow.aggregate.mockResolvedValueOnce(mockStats);

    const stats = await Workflow.getWorkflowStats(new mongoose.Types.ObjectId());
    expect(stats.completed).toBe(5);
    expect(stats.total).toBe(5);
    expect(Workflow.aggregate).toHaveBeenCalledTimes(1);
  });
});