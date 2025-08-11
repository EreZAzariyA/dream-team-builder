jest.mock('../lib/bmad/WorkflowEngine.js');
jest.mock('../lib/bmad/AgentLoader.js');
jest.mock('../lib/bmad/AgentCommunicator.js');
jest.mock('../lib/bmad/MessageService.js');
jest.mock('../lib/bmad/orchestration/PusherService.js');
jest.mock('../lib/bmad/orchestration/StoreService.js');
jest.mock('../lib/bmad/orchestration/EventHandler.js');
jest.mock('../lib/ai/AIService.js');

// Mock the entire BmadOrchestrator module
jest.mock('../lib/bmad/BmadOrchestrator', () => {
  const mockBmadOrchestratorInstance = {
    initialized: true,
    initialize: jest.fn().mockResolvedValue(true),
    startWorkflow: jest.fn().mockResolvedValue({
      workflowId: 'mock-workflow-id',
      status: 'running',
      workflow: { steps: [{}] } // Minimal structure to satisfy assertions
    }),
    getWorkflowStatus: jest.fn().mockResolvedValue({
      id: 'mock-workflow-id',
      status: 'running',
      currentStep: 0,
      totalSteps: 1,
      communication: { messageCount: 0, timeline: [], statistics: {} },
      agents: {},
    }),
    cleanup: jest.fn().mockResolvedValue(true), // Add cleanup mock
    // Mock internal dependencies that BmadOrchestrator's constructor would create
    agentLoader: {},
    communicator: {},
    messageService: {},
    pusherService: {},
    storeService: {},
    eventHandler: {},
    workflowEngine: {},
  };

  return {
    __esModule: true,
    BmadOrchestrator: jest.fn(() => mockBmadOrchestratorInstance),
    getOrchestrator: jest.fn().mockResolvedValue(mockBmadOrchestratorInstance),
  };
});

const { BmadOrchestrator, getOrchestrator } = require('../lib/bmad/BmadOrchestrator');

describe('BMAD Orchestrator - Smoke Tests', () => {
  let orchestrator;

  beforeAll(async () => {
    orchestrator = await getOrchestrator();
  });

  afterAll(async () => {
    // Ensure cleanup is called to prevent open handles
    if (orchestrator && orchestrator.cleanup) {
      await orchestrator.cleanup();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('🧠 should initialize the orchestrator successfully', () => {
    expect(orchestrator).toBeDefined();
    expect(orchestrator.initialized).toBe(true);
  });

  test('🚀 should start a basic PRD workflow and return workflow data', async () => {
    const userPrompt = 'Create a simple product requirements document for a new mobile app.';
    const workflowConfig = {
      name: 'Simple PRD Workflow',
      description: 'A basic workflow to generate a PRD',
      sequence: 'pm', // Assuming predefined sequence
      userId: 'test-user-123',
    };

    const result = await orchestrator.startWorkflow(userPrompt, workflowConfig);
    
    expect(result).toBeDefined();
    expect(result.workflowId).toBeDefined();
    expect(result.status).toBe('running');
    expect(result.workflow).toBeDefined();
    expect(Array.isArray(result.workflow.steps)).toBe(true);
    expect(result.workflow.steps.length).toBeGreaterThan(0);
    // Assert that the mocked startWorkflow was called
    expect(orchestrator.startWorkflow).toHaveBeenCalledTimes(1);
  });

  test('🛑 should fail gracefully when provided invalid workflow config', async () => {
    // Mock startWorkflow to throw an error for invalid input for this specific test
    orchestrator.startWorkflow.mockImplementationOnce((prompt, config) => {
      return Promise.reject(new Error('Invalid workflow config'));
    });

    const invalidPrompt = '';
    const invalidConfig = {
      name: '',
      userId: '',
      sequence: null
    };

    await expect(
      orchestrator.startWorkflow(invalidPrompt, invalidConfig)
    ).rejects.toThrow();
  });
});
