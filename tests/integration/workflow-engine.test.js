/**
 * Workflow Engine Integration Tests
 * 
 * Tests the WorkflowEngine class with mocked dependencies to ensure it correctly
 * orchestrates the workflow lifecycle and agent execution.
 */

// Mock dependencies of WorkflowEngine
jest.mock('../../lib/bmad/AgentLoader.js');
jest.mock('../../lib/bmad/AgentCommunicator.js');
jest.mock('../../lib/bmad/SimplifiedAgentExecutor.js');
jest.mock('../../lib/bmad/MockAgentExecutor.js');
jest.mock('../../lib/bmad/WorkflowParser.js');
jest.mock('../../lib/bmad/engine/DynamicWorkflowHandler.js');
jest.mock('../../lib/bmad/engine/CheckpointManager.js');

// Mock the DatabaseService to control its behavior
jest.mock('../../lib/bmad/engine/DatabaseService.js', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    rehydrateState: jest.fn().mockResolvedValue([]),
  })),
}));

// Mock the service modules and their prototype methods
jest.mock('../../lib/bmad/ConsolidatedWorkflowManager.js', () => {
  const mockInstance = {
    startWorkflow: jest.fn(),
    completeWorkflow: jest.fn(),
    pauseWorkflow: jest.fn(),
    resumeWorkflow: jest.fn(),
    cancelWorkflow: jest.fn(),
    getWorkflowStatus: jest.fn(),
    getActiveWorkflows: jest.fn(),
    getWorkflowArtifacts: jest.fn(),
    executeNextStep: jest.fn(),
  };
  return {
    ConsolidatedWorkflowManager: jest.fn(() => mockInstance),
  };
});
// WorkflowStepExecutor removed - functionality moved to WorkflowEngine
// WorkflowStateManager removed - functionality moved to ConsolidatedWorkflowManager

const { WorkflowEngine } = require('../../lib/bmad/WorkflowEngine.js');
const { ConsolidatedWorkflowManager } = require('../../lib/bmad/ConsolidatedWorkflowManager.js');

describe('Workflow Engine Integration', () => {
  let workflowEngine;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Instantiate the real WorkflowEngine
    workflowEngine = new WorkflowEngine();
  });

  describe('Initialization', () => {
    test('should initialize successfully and load agents', async () => {
      await workflowEngine.initialize();
      expect(workflowEngine.agentLoader.loadAllAgents).toHaveBeenCalledTimes(1);
      expect(workflowEngine.artifactManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Workflow Lifecycle', () => {
    test('should delegate startWorkflow to WorkflowLifecycleManager', async () => {
      const config = { userPrompt: 'Test prompt' };
      await workflowEngine.startWorkflow(config);
      expect(workflowEngine.lifecycleManager.startWorkflow).toHaveBeenCalledWith(config);
    });

    test('should delegate pauseWorkflow to WorkflowLifecycleManager', async () => {
      const workflowId = 'workflow-123';
      await workflowEngine.pauseWorkflow(workflowId);
      expect(workflowEngine.lifecycleManager.pauseWorkflow).toHaveBeenCalledWith(workflowId);
    });

    test('should delegate resumeWorkflow to WorkflowLifecycleManager', async () => {
      const workflowId = 'workflow-123';
      await workflowEngine.resumeWorkflow(workflowId);
      expect(workflowEngine.lifecycleManager.resumeWorkflow).toHaveBeenCalledWith(workflowId);
    });

    test('should delegate cancelWorkflow to WorkflowLifecycleManager', async () => {
      const workflowId = 'workflow-123';
      await workflowEngine.cancelWorkflow(workflowId);
      expect(workflowEngine.lifecycleManager.cancelWorkflow).toHaveBeenCalledWith(workflowId);
    });
  });

  describe('Step Execution', () => {
    test('should delegate executeNextStep to WorkflowStepExecutor', async () => {
      const workflowId = 'workflow-123';
      await workflowEngine.executeNextStep(workflowId);
      expect(workflowEngine.stepExecutor.executeNextStep).toHaveBeenCalledWith(workflowId);
    });
  });

  describe('State Management', () => {
    test('should delegate getWorkflowStatus to WorkflowStateManager', async () => {
      const workflowId = 'workflow-123';
      await workflowEngine.getWorkflowStatus(workflowId);
      expect(workflowEngine.stateManager.getWorkflowStatus).toHaveBeenCalledWith(workflowId);
    });

    test('should delegate getActiveWorkflows to WorkflowStateManager', () => {
      workflowEngine.getActiveWorkflows();
      expect(workflowEngine.stateManager.getActiveWorkflows).toHaveBeenCalledTimes(1);
    });

    test('should delegate getWorkflowArtifacts to WorkflowStateManager', async () => {
      const workflowId = 'workflow-123';
      await workflowEngine.getWorkflowArtifacts(workflowId);
      expect(workflowEngine.stateManager.getWorkflowArtifacts).toHaveBeenCalledWith(workflowId);
    });
  });
});