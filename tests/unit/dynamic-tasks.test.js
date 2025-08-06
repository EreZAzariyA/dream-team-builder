import path from 'path';
import { promises as fs } from 'fs';

// Mock external dependencies that tasks might use
jest.mock('../../lib/utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock specific modules that might be imported by tasks
// This is a generic mock; specific mocks might be needed for deeper tests
jest.mock('../../lib/documentation/DocumentationManager.js', () => ({
  DocumentationManager: jest.fn().mockImplementation(() => ({
    checkMissingDocs: jest.fn(() => Promise.resolve([])),
    getDocTemplate: jest.fn(() => Promise.resolve('Mock Template')),
    saveDocument: jest.fn(() => Promise.resolve()),
    updateDocument: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('../../lib/elicitation/ElicitationEngine.js', () => ({
  ElicitationEngine: jest.fn().mockImplementation(() => ({
    loadQuestionsForDoc: jest.fn(() => Promise.resolve([])),
    startInteractiveSession: jest.fn(() => Promise.resolve({})),
  })),
}));

jest.mock('../../lib/documentation/MarkdownGenerator.js', () => ({
  MarkdownGenerator: jest.fn().mockImplementation(() => ({
    generateMarkdown: jest.fn(() => Promise.resolve('Mock Markdown')),
  })),
}));

// Add more mocks for other common dependencies if needed, e.g., database, AI services

describe('Dynamic Task Execution Tests', () => {
  const tasksDir = path.join(process.cwd(), '.bmad-core', 'tasks');
  const taskFiles = [
    'fill-missing-docs.md',
    'create-doc.md',
    'execute-checklist.md',
    'advanced-elicitation.md',
    'brownfield-create-epic.md',
    'brownfield-create-story.md',
    'correct-course.md',
    'create-brownfield-story.md',
    'create-deep-research-prompt.md',
    'create-next-story.md',
    'document-project.md',
    'facilitate-brainstorming-session.md',
    'generate-ai-frontend-prompt.md',
    'index-docs.md',
    'kb-mode-interaction.md',
    'review-story.md',
    'shard-doc.md',
    'validate-next-story.md',
  ];

  // Mock context for task execution
  const mockContext = {
    projectRoot: process.cwd(),
    // Add any other common context properties here
  };

  // Mock elicitCallback - should not be called in non-interactive tests
  const mockElicitCallback = jest.fn(() => {
    throw new Error('Elicitation was unexpectedly called. This test should be non-interactive.');
  });

  // Loop through each task file and create a test case
  taskFiles.forEach(taskFile => {
    test(`Task: ${taskFile} should execute without throwing an immediate error`, async () => {
      const taskPath = path.join(tasksDir, taskFile);
      let taskModule;
      let execute;
      try {
        // Dynamic import of the task module
        taskModule = await import(taskPath);
        execute = taskModule.execute; // Attempt to get the named export
        if (!execute && taskModule.default && typeof taskModule.default.execute === 'function') {
          execute = taskModule.default.execute; // Fallback for default export wrapping
        } else if (!execute && typeof taskModule.default === 'function') {
          execute = taskModule.default; // Fallback if the default export *is* the function
        }
      } catch (importError) {
        // If import fails, it's a critical error for the test
        throw new Error(`Failed to import task ${taskFile}: ${importError.message}`);
      }

      // Ensure the task module exports an 'execute' function
      expect(execute).toBeInstanceOf(Function);

      // Execute the task with mock context and elicitCallback
      // Wrap in a try-catch to assert on expected errors if a task is designed to throw
      try {
        const result = await execute(mockContext, mockElicitCallback);
        // You can add more specific assertions here based on expected task outcomes
        expect(result).toBeDefined();
        // If a task is expected to return a specific status, assert it here
        // For example: expect(result.status).toBe('success');
      } catch (executionError) {
        // Some tasks might legitimately throw errors if conditions aren't met (e.g., missing args)
        // For this general test, we're primarily checking for *unexpected* errors.
        // If a task is known to throw, you'd add a specific `expect().toThrow()` for it.
        console.error(`Error executing task ${taskFile}:`, executionError.message);
        throw executionError; // Re-throw to fail the test if it's an unexpected error
      }
    }, 30000); // Increase timeout for potentially slow tasks
  });
});
