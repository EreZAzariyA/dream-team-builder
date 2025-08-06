const { getOrchestrator } = require('../lib/bmad/BmadOrchestrator');

describe('BMAD Orchestrator - Smoke Tests', () => {
  let orchestrator;

  beforeAll(async () => {
    orchestrator = await getOrchestrator();
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
    console.log({ result });
    

    expect(result).toBeDefined();
    expect(result.workflowId).toBeDefined();
    expect(result.status).toBe('running');
    expect(result.workflow).toBeDefined();
    expect(Array.isArray(result.workflow.steps)).toBe(true);
    expect(result.workflow.steps.length).toBeGreaterThan(0);
  });

  test('🛑 should fail gracefully when provided invalid workflow config', async () => {
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

  // 📌 Additional smoke tests can go here
});
