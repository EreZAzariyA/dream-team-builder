/**
 * BMAD Orchestration Integration Tests - Real API
 * 
 * Tests the BmadOrchestrator class with mocked dependencies to ensure it orchestrates
 * the workflow execution correctly.
 */

// Mock dependencies of BmadOrchestrator
jest.mock('../../lib/bmad/WorkflowEngine.js');
jest.mock('../../lib/bmad/AgentLoader.js');
jest.mock('../../lib/bmad/AgentCommunicator.js');
jest.mock('../../lib/bmad/MessageService.js');
jest.mock('../../lib/bmad/orchestration/PusherService.js');
jest.mock('../../lib/bmad/orchestration/StoreService.js');
jest.mock('../../lib/bmad/orchestration/EventHandler.js');

const { BmadOrchestrator } = require('../../lib/bmad/BmadOrchestrator.js');
const { WorkflowEngine } = require('../../lib/bmad/WorkflowEngine.js');
const { AgentLoader } = require('../../lib/bmad/AgentLoader.js');
const { AgentCommunicator } = require('../../lib/bmad/AgentCommunicator.js');
const { WorkflowStatus } = require('../../lib/bmad/types.js');

describe('BMAD Orchestration Integration - Real API', () => {
  let orchestrator;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Instantiate the real BmadOrchestrator
    orchestrator = new BmadOrchestrator();

    // Provide default mock implementations for dependencies
    WorkflowEngine.prototype.workflowParser = { workflowExists: jest.fn().mockResolvedValue(false) };
    AgentCommunicator.prototype.getActiveChannels = jest.fn().mockReturnValue([]);
    AgentLoader.prototype.agentCache = { size: 0 };
    AgentLoader.prototype.validateWorkflowSequence = jest.fn().mockResolvedValue({ valid: true, errors: [] });
    WorkflowEngine.prototype.activeWorkflows = { size: 0 };
    WorkflowEngine.prototype.executionHistory = { size: 0 };
    AgentCommunicator.prototype.activeChannels = { size: 0 };
  });

  describe('BmadOrchestrator Initialization', () => {
    test('should initialize orchestrator and its dependencies successfully', async () => {
      // Mock the initialize methods of dependencies
      WorkflowEngine.prototype.initialize.mockResolvedValue(true);
      AgentLoader.prototype.loadAllAgents.mockResolvedValue(true);

      await orchestrator.initialize();

      expect(orchestrator.initialized).toBe(true);
      expect(WorkflowEngine.prototype.initialize).toHaveBeenCalledTimes(1);
      expect(AgentLoader.prototype.loadAllAgents).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization failure', async () => {
      // Mock a failure during initialization
      WorkflowEngine.prototype.initialize.mockRejectedValue(new Error('Engine failed to initialize'));

      await expect(orchestrator.initialize()).rejects.toThrow('Engine failed to initialize');
      expect(orchestrator.initialized).toBe(false);
    });
  });

  describe('Workflow Creation and Management', () => {
    beforeEach(async () => {
      // Ensure orchestrator is initialized before each test in this block
      WorkflowEngine.prototype.initialize.mockResolvedValue(true);
      AgentLoader.prototype.loadAllAgents.mockResolvedValue(true);
      await orchestrator.initialize();
    });

    test('should start a workflow successfully', async () => {
      const userPrompt = 'Create a modern web application';
      const options = { name: 'Test App', sequence: 'greenfield-fullstack', userId: 'test-user' };

      // Mock the workflow engine's startWorkflow method
      const mockWorkflowResult = { workflowId: 'new-workflow-123', status: WorkflowStatus.RUNNING };
      WorkflowEngine.prototype.startWorkflow.mockResolvedValue(mockWorkflowResult);

      const result = await orchestrator.startWorkflow(userPrompt, options);

      expect(result).toEqual(mockWorkflowResult);
      expect(WorkflowEngine.prototype.startWorkflow).toHaveBeenCalledWith(expect.objectContaining({
        userPrompt,
        name: options.name,
        sequence: expect.any(Array)
      }));
    });

    test('should reject workflow with an invalid prompt', async () => {
      const shortPrompt = 'Hi';
      await expect(orchestrator.startWorkflow(shortPrompt)).rejects.toThrow('User prompt must be at least 10 characters long');
    });
  });

  describe('Workflow Status and Progress Tracking', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should get workflow status and enrich it with communication data', async () => {
      const workflowId = 'workflow-abc';
      const mockEngineStatus = { id: workflowId, status: WorkflowStatus.RUNNING, currentStep: 1 };
      const mockCommunicatorHistory = [{ id: 'msg-1', content: 'Hello' }];
      const mockCommunicatorStats = { totalMessages: 1 };

      // Mock the dependencies' methods
      WorkflowEngine.prototype.getWorkflowStatus.mockResolvedValue(mockEngineStatus);
      AgentCommunicator.prototype.getMessageHistory.mockReturnValue(mockCommunicatorHistory);
      AgentCommunicator.prototype.getStatistics.mockReturnValue(mockCommunicatorStats);

      const status = await orchestrator.getWorkflowStatus(workflowId);

      expect(status).toBeDefined();
      expect(status.id).toBe(workflowId);
      expect(status.status).toBe(WorkflowStatus.RUNNING);
      expect(status.communication.messageCount).toBe(1);
      expect(status.communication.timeline).toHaveLength(1);
      expect(WorkflowEngine.prototype.getWorkflowStatus).toHaveBeenCalledWith(workflowId);
      expect(AgentCommunicator.prototype.getMessageHistory).toHaveBeenCalledWith(workflowId);
    });
  });

  describe('Workflow Control Operations', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    test('should pause a workflow', async () => {
      const workflowId = 'workflow-to-pause';
      WorkflowEngine.prototype.pauseWorkflow.mockResolvedValue({ status: WorkflowStatus.PAUSED });

      const result = await orchestrator.pauseWorkflow(workflowId);

      expect(result.status).toBe(WorkflowStatus.PAUSED);
      expect(WorkflowEngine.prototype.pauseWorkflow).toHaveBeenCalledWith(workflowId);
    });

    test('should resume a workflow', async () => {
      const workflowId = 'workflow-to-resume';
      WorkflowEngine.prototype.resumeWorkflow.mockResolvedValue({ status: WorkflowStatus.RUNNING });

      const result = await orchestrator.resumeWorkflow(workflowId);

      expect(result.status).toBe(WorkflowStatus.RUNNING);
      expect(WorkflowEngine.prototype.resumeWorkflow).toHaveBeenCalledWith(workflowId);
    });

    test('should cancel a workflow', async () => {
      const workflowId = 'workflow-to-cancel';
      WorkflowEngine.prototype.cancelWorkflow.mockResolvedValue({ status: WorkflowStatus.CANCELLED });

      const result = await orchestrator.cancelWorkflow(workflowId);

      expect(result.status).toBe(WorkflowStatus.CANCELLED);
      expect(WorkflowEngine.prototype.cancelWorkflow).toHaveBeenCalledWith(workflowId);
    });
  });

  describe('System Health', () => {
    test('should provide system health status', async () => {
        await orchestrator.initialize();
        const health = orchestrator.getSystemHealth();

        expect(health).toBeDefined();
        expect(health.status).toBe('healthy');
        expect(health.initialized).toBe(true);
    });
  });
});
