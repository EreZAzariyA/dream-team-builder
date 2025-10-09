import { AgentActivationEngine } from '../../lib/bmad/core/AgentActivationEngine.js';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
  access: jest.fn(),
}));
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')), // Corrected: Removed unnecessary backslash before newline
  basename: jest.fn((p, ext) => p.replace(/^.*[\/]/, '').replace(ext, '')), // Corrected: Removed unnecessary backslash before quote
  extname: jest.fn((p) => p.split('.').pop()),
  resolve: jest.fn((...args) => args.join('/')), // Corrected: Removed unnecessary backslash before newline
}));
jest.mock('js-yaml', () => ({
  load: jest.fn(),
}));
jest.mock('../../lib/utils/fileValidator.js', () => ({
  validateFilePath: jest.fn(),
}));
jest.mock('../../lib/utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('AgentActivationEngine', () => {
  let engine;
  let mockConfigManager;

  beforeEach(() => {
    mockConfigManager = {
      isLoaded: true,
      getBmadCorePaths: jest.fn(() => ({
        agents: 'path/to/agents',
        templates: 'path/to/templates',
        tasks: 'path/to/tasks',
        checklists: 'path/to/checklists',
      })),
      getDevAlwaysFiles: jest.fn(() => []),
    };
    engine = new AgentActivationEngine(mockConfigManager);
    jest.clearAllMocks();
  });

  describe('loadAllAgents', () => {
    test('should load all agent definitions from the agents directory', async () => {
      require('fs/promises').readdir.mockResolvedValue(['analyst.md', 'pm.md']);
      require('fs/promises').readFile.mockImplementation((filePath) => {
        if (filePath.includes('analyst.md')) {
          return Promise.resolve(`---\nagent:\n  name: Mary\n  id: analyst\n  title: Business Analyst\n---\n`);
        }
        if (filePath.includes('pm.md')) {
          return Promise.resolve(`---\nagent:\n  name: John\n  id: pm\n  title: Product Manager\n---\n`);
        }
        return Promise.reject(new Error('File not found'));
      });
      require('js-yaml').load.mockImplementation((content) => {
        if (content.includes('Mary')) return { agent: { name: 'Mary', id: 'analyst', title: 'Business Analyst' } };
        if (content.includes('John')) return { agent: { name: 'John', id: 'pm', title: 'Product Manager' } };
        return {};
      });

      await engine.loadAllAgents();

      expect(engine.agents.size).toBe(2);
      expect(engine.agents.has('analyst')).toBe(true);
      expect(engine.agents.has('pm')).toBe(true);
      expect(require('fs/promises').readdir).toHaveBeenCalledWith('path/to/agents');
      expect(require('fs/promises').readFile).toHaveBeenCalledTimes(2);
    });

    test('should throw an error if config is not loaded', async () => {
      engine.configManager.isLoaded = false;
      await expect(engine.loadAllAgents()).rejects.toThrow('Configuration must be loaded before loading agents');
    });

    test('should handle errors during file reading', async () => {
      require('fs/promises').readdir.mockResolvedValue(['invalid.md']);
      require('fs/promises').readFile.mockRejectedValue(new Error('Read error'));

      await expect(engine.loadAllAgents()).rejects.toThrow('Failed to load agents: Read error');
    });
  });

  describe('activateAgent', () => {
    beforeEach(async () => {
      // Pre-load an agent for activation tests
      engine.agents.set('test-agent', {
        id: 'test-agent',
        agent: { name: 'Test Agent', title: 'Test Title', icon: '🧪' },
        commands: [],
        dependencies: [],
      });
    });

    test('should activate the specified agent', async () => {
      const activeAgent = await engine.activateAgent('test-agent');
      expect(engine.activeAgent).toBeDefined();
      expect(engine.activeAgent.id).toBe('test-agent');
      expect(activeAgent.agent.agent.name).toBe('Test Agent');
      expect(engine.agentStates.has('test-agent')).toBe(true);
    });

    test('should throw an error if agent not found', async () => {
      await expect(engine.activateAgent('non-existent')).rejects.toThrow('Agent "non-existent" not found');
    });
  });

  describe('loadAgentDependencies', () => {
    beforeEach(async () => {
      // Pre-load an agent for dependency tests
      engine.agents.set('dep-agent', {
        id: 'dep-agent',
        agent: { name: 'Dep Agent', title: 'Dep Title' },
        dependencies: ['task1.md', 'template1.yaml'],
      });
      await engine.activateAgent('dep-agent');
    });

    test('should load agent dependencies', async () => {
      require('fs/promises').readFile.mockImplementation((filePath) => {
        if (filePath.includes('task1.md')) return Promise.resolve('Task content');
        if (filePath.includes('template1.yaml')) return Promise.resolve('template: {}');
        return Promise.reject(new Error('File not found'));
      });
      require('js-yaml').load.mockReturnValue({}); // For template1.yaml

      const dependencies = await engine.loadAgentDependencies('dep-agent');
      expect(dependencies.length).toBe(2);
      expect(dependencies[0].path).toContain('task1.md');
      expect(dependencies[1].path).toContain('template1.yaml');
      expect(engine.agentStates.get('dep-agent').loaded).toBe(true);
    });

    test('should not load dependencies if already loaded', async () => {
      engine.agentStates.get('dep-agent').loaded = true;
      const dependencies = await engine.loadAgentDependencies('dep-agent');
      expect(dependencies.length).toBe(0); // No new dependencies loaded
      expect(require('fs/promises').readFile).not.toHaveBeenCalled();
    });
  });

  describe('getAgentHelp', () => {
    beforeEach(async () => {
      engine.agents.set('help-agent', {
        id: 'help-agent',
        agent: { name: 'Help Agent', title: 'Help Title', icon: '❓', description: 'A helpful agent' },
        commands: ['cmd1', { cmd2: 'description2' }],
      });
    });

    test('should return correct help information for an agent', () => {
      const help = engine.getAgentHelp('help-agent');
      expect(help.name).toBe('Help Agent');
      expect(help.commands.length).toBe(2);
      expect(help.commands[0].command).toBe('cmd1');
      expect(help.commands[1].description).toBe('description2');
    });

    test('should return null if agent not found', () => {
      const help = engine.getAgentHelp('non-existent');
      expect(help).toBeNull();
    });
  });

  describe('canAgentEditSection', () => {
    beforeEach(() => {
      engine.agents.set('editor-agent', {
        id: 'editor-agent',
        agent: { name: 'Editor' },
        permissions: { canEdit: ['sectionA', 'all'] },
      });
      engine.agentStates.set('editor-agent', { permissions: { canEdit: ['sectionA', 'all'], restrictedSections: [] } });

      engine.agents.set('restricted-agent', {
        id: 'restricted-agent',
        agent: { name: 'Restricted' },
        permissions: { canEdit: ['sectionB'] },
      });
      engine.agentStates.set('restricted-agent', { permissions: { canEdit: ['sectionB'], restrictedSections: ['sectionA'] } });
    });

    test('should return true if agent has permission to edit section', () => {
      expect(engine.canAgentEditSection('editor-agent', 'sectionA')).toBe(true);
      expect(engine.canAgentEditSection('editor-agent', 'sectionC')).toBe(true); // 'all' permission
    });

    test('should return false if agent does not have permission to edit section', () => {
      expect(engine.canAgentEditSection('restricted-agent', 'sectionC')).toBe(false);
    });

    test('should return false if section is restricted for the agent', () => {
      expect(engine.canAgentEditSection('restricted-agent', 'sectionA')).toBe(false);
    });

    test('should return false if agent state not found', () => {
      expect(engine.canAgentEditSection('non-existent', 'sectionA')).toBe(false);
    });
  });
});
