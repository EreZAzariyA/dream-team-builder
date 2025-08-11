/**
 * WorkflowParser Unit Tests
 * 
 * Tests the WorkflowParser's ability to parse workflow YAML files and extract relevant information.
 */

import WorkflowParser from '../../lib/bmad/WorkflowParser.js';

// Mock the file system to control workflow file existence for testing
jest.mock('fs/promises', () => ({
  readFile: jest.fn((path) => {
    if (path.includes('brownfield-fullstack.yaml')) {
      return Promise.resolve(`
workflow:
  id: brownfield-fullstack
  name: Brownfield Full-Stack Enhancement
  description: Agent workflow for enhancing existing full-stack applications with new features, modernization, or significant changes. Handles existing system analysis and safe integration.
  type: brownfield
  project_types:
    - fullstack

  sequence:
    - step: analyze_existing_code
      agent: architect
      action: elicit
      notes: "Analyze existing codebase."

    - step: create_prd
      agent: pm
      action: create_doc
      uses: prd-tmpl.yaml
      creates: prd.md

    - step: define_routing
      type: routing
      routingOptions:
        - option: frontend_only
          next_step: implement_frontend
        - option: backend_only
          next_step: implement_backend

    - step: conditional_step
      agent: dev
      condition: "user_wants_feature"
      action: implement_feature
      notes: "Implement a conditional feature."

    - step: create_artifact
      agent: qa
      creates: test-plan.md
      requires: implemented_code
      notes: "Create a test plan."

    - step: final_step
      agent: sm
      notes: "Final step of the workflow."
`);
    }
    return Promise.reject(new Error('File not found'));
  }),
  access: jest.fn((path) => {
    if (path.includes('brownfield-fullstack.yaml')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('File not found'));
  }),
}));

jest.mock('path', () => ({
  resolve: jest.fn((...args) => args.join('/')),
  join: jest.fn((...args) => args.join('/')),
}));

jest.mock('../../lib/utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('WorkflowParser', () => {
  let parser;

  beforeEach(() => {
    parser = new WorkflowParser();
    jest.clearAllMocks();
  });

  test('should correctly check if a workflow file exists', async () => {
    const workflowExists = await parser.workflowExists('brownfield-fullstack');
    expect(workflowExists).toBe(true);
  });

  test('should return false if a workflow file does not exist', async () => {
    const workflowExists = await parser.workflowExists('non-existent-workflow');
    expect(workflowExists).toBe(false);
  });

  test('should successfully parse a valid workflow file', async () => {
    const workflow = await parser.parseWorkflowFile('brownfield-fullstack');
    
    expect(workflow).toBeDefined();
    expect(workflow.id).toBe('brownfield-fullstack');
    expect(workflow.name).toBe('Brownfield Full-Stack Enhancement');
    expect(workflow.description).toContain('Agent workflow for enhancing existing full-stack applications');
    expect(workflow.type).toBe('brownfield');
    expect(workflow.projectTypes).toEqual(['fullstack']);
    expect(workflow.sequence).toBeDefined();
    expect(workflow.sequence.length).toBeGreaterThan(0);
  });

  test('should extract correct step details from the workflow', async () => {
    const workflow = await parser.parseWorkflowFile('brownfield-fullstack');
    const steps = workflow.sequence;

    expect(steps).toBeDefined();
    expect(steps.length).toBeGreaterThan(0);

    // Test a regular step
    expect(steps[0]).toMatchObject({
      step: 'analyze_existing_code',
      agent: 'architect',
      action: 'elicit',
    });

    // Test a step with creates and uses
    expect(steps[1]).toMatchObject({
      step: 'create_prd',
      agent: 'pm',
      action: 'create_doc',
      uses: 'prd-tmpl.yaml',
      creates: 'prd.md',
    });

    // Test a routing step
    expect(steps[2]).toMatchObject({
      step: 'define_routing',
      type: 'routing',
    });
    expect(steps[2].routingOptions).toEqual([
      { option: 'frontend_only', next_step: 'implement_frontend' },
      { option: 'backend_only', next_step: 'implement_backend' },
    ]);

    // Test a conditional step
    expect(steps[3]).toMatchObject({
      step: 'conditional_step',
      agent: 'dev',
      condition: 'user_wants_feature',
    });

    // Test an artifact step
    expect(steps[4]).toMatchObject({
      step: 'create_artifact',
      agent: 'qa',
      creates: 'test-plan.md',
      requires: 'implemented_code',
    });
  });

  test('should throw an error for a non-existent workflow file during parsing', async () => {
    await expect(parser.parseWorkflowFile('non-existent-workflow')).rejects.toThrow('Failed to parse workflow non-existent-workflow');
  });

  test('should handle malformed YAML gracefully', async () => {
    // Mock readFile to return malformed YAML
    require('fs/promises').readFile.mockImplementationOnce((path) => {
      if (path.includes('malformed.yaml')) {
        return Promise.resolve(`
workflow:
  id: malformed
  name: Malformed Workflow
  sequence:
    - step: missing_colon
      agent: pm
      action
`);
      }
      return Promise.reject(new Error('File not found'));
    });

    await expect(parser.parseWorkflowFile('malformed.yaml')).rejects.toThrow();
  });
});
