/**
 * GitHub Workflow Integration Tests
 * Tests the complete GitHub-integrated workflow system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { BmadOrchestrator } from '../../lib/bmad/BmadOrchestrator.js';
import GitHubArtifactManager from '../../lib/bmad/GitHubArtifactManager.js';
import { GitIntegrationService } from '../../lib/integrations/GitIntegrationService.js';
import { connectMongoose, disconnectMongoose } from '../../lib/database/mongodb.js';

// Mock GitHub API responses
const mockGitHubAPI = {
  repositories: [
    {
      id: 123456,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      description: 'Test repository for BMAD workflow',
      owner: {
        login: 'testuser',
        avatar_url: 'https://github.com/images/avatars/testuser.png',
        type: 'User'
      },
      html_url: 'https://github.com/testuser/test-repo',
      clone_url: 'https://github.com/testuser/test-repo.git',
      ssh_url: 'git@github.com:testuser/test-repo.git',
      default_branch: 'main',
      language: 'JavaScript',
      private: false,
      stargazers_count: 42,
      forks_count: 5,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-08-01T12:00:00Z',
      pushed_at: '2024-08-20T15:30:00Z',
      size: 1024,
      topics: ['ai', 'workflow', 'automation']
    }
  ],
  languages: {
    'JavaScript': 85000,
    'TypeScript': 45000,
    'CSS': 12000,
    'HTML': 8000
  },
  structure: [
    { name: 'package.json', path: 'package.json', type: 'file', size: 2048 },
    { name: 'src', path: 'src', type: 'dir', size: 0,
      children: [
        { name: 'index.js', path: 'src/index.js', type: 'file', size: 1024 },
        { name: 'components', path: 'src/components', type: 'dir', size: 0 }
      ]
    },
    { name: 'README.md', path: 'README.md', type: 'file', size: 4096 }
  ]
};

// Mock session for authentication
const mockSession = {
  user: {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    githubAccessToken: 'mock-github-token'
  }
};

describe('GitHub Workflow Integration', () => {
  let orchestrator;
  let mockGitService;

  beforeAll(async () => {
    // Connect to test database
    await connectMongoose();
    
    // Initialize mock Git service
    mockGitService = {
      initialize: jest.fn().mockResolvedValue(true),
      commitWorkflowChanges: jest.fn().mockResolvedValue({
        commitSha: 'abc123def456',
        commitUrl: 'https://github.com/testuser/test-repo/commit/abc123def456',
        filesChanged: 3
      }),
      getRepositoryContext: jest.fn().mockResolvedValue({
        repository: mockGitHubAPI.repositories[0],
        branches: [
          { name: 'main', sha: 'main-sha-123', protected: false },
          { name: 'develop', sha: 'dev-sha-456', protected: false }
        ],
        releases: []
      }),
      githubPlugin: {
        makeAuthenticatedRequest: jest.fn().mockImplementation((url) => {
          if (url.includes('/repos/')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockGitHubAPI.repositories[0])
            });
          }
          if (url.includes('/languages')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockGitHubAPI.languages)
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
          });
        }),
        getRepositories: jest.fn().mockResolvedValue(mockGitHubAPI.repositories)
      }
    };

    // Initialize orchestrator with mock services
    orchestrator = new BmadOrchestrator(null, {
      mockMode: true,
      gitService: mockGitService
    });
    await orchestrator.initialize();
  });

  afterAll(async () => {
    await disconnectMongoose();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GitHub Repository API', () => {
    it('should list repositories with BMAD context', async () => {
      // Mock fetch for this test
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          repositories: mockGitHubAPI.repositories.map(repo => ({
            ...repo,
            bmad_context: {
              has_existing_artifacts: false,
              workflow_ready: true,
              suggested_workflow: 'brownfield-fullstack',
              estimated_complexity: 'medium'
            }
          }))
        })
      });

      const response = await fetch('/api/github/repositories?type=all&per_page=10');
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.repositories).toHaveLength(1);
      expect(data.repositories[0]).toHaveProperty('bmad_context');
      expect(data.repositories[0].bmad_context.suggested_workflow).toBe('brownfield-fullstack');
    });

    it('should get detailed repository context', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          context: {
            repository: mockGitHubAPI.repositories[0],
            structure: mockGitHubAPI.structure,
            development: {
              framework: 'Node.js',
              build_system: 'npm',
              testing_framework: 'Jest',
              package_managers: ['npm']
            },
            bmad_analysis: {
              workflow_recommendation: {
                type: 'brownfield',
                template: 'brownfield-fullstack',
                reason: 'JavaScript/TypeScript project detected'
              },
              complexity_assessment: 'medium',
              setup_requirements: ['Node.js and npm']
            }
          }
        })
      });

      const response = await fetch('/api/github/repositories/testuser/test-repo');
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.context).toHaveProperty('repository');
      expect(data.context).toHaveProperty('bmad_analysis');
      expect(data.context.bmad_analysis.workflow_recommendation.template).toBe('brownfield-fullstack');
    });
  });

  describe('GitHubArtifactManager', () => {
    let artifactManager;

    beforeEach(() => {
      artifactManager = new GitHubArtifactManager(mockGitService);
    });

    it('should initialize with repository context', async () => {
      const repoContext = {
        owner: 'testuser',
        name: 'test-repo',
        branch: 'main',
        workflowId: 'test-workflow-123'
      };

      await artifactManager.initialize(repoContext);
      
      expect(artifactManager.repositoryContext).toEqual(repoContext);
    });

    it('should generate artifacts in memory', async () => {
      await artifactManager.initialize({
        owner: 'testuser',
        name: 'test-repo',
        branch: 'main'
      });

      const artifactId = await artifactManager.generateArtifact(
        'analyst',
        'project-requirements.md',
        '# Project Requirements\n\nThis is a test PRD document.',
        { documentType: 'prd' }
      );

      expect(artifactId).toBeDefined();
      expect(typeof artifactId).toBe('string');

      const artifact = artifactManager.getArtifact(artifactId);
      expect(artifact).toBeDefined();
      expect(artifact.filename).toBe('project-requirements.md');
      expect(artifact.agentId).toBe('analyst');
      expect(artifact.content).toContain('Project Requirements');
    });

    it('should organize artifacts by path', async () => {
      await artifactManager.initialize({
        owner: 'testuser',
        name: 'test-repo',
        branch: 'main'
      });

      const artifacts = [
        { filename: 'prd.md', type: 'prd' },
        { filename: 'architecture.md', type: 'architecture' },
        { filename: 'user-story-1.md', type: 'story' }
      ];

      for (const artifact of artifacts) {
        await artifactManager.generateArtifact(
          'test-agent',
          artifact.filename,
          `# ${artifact.type}\n\nContent for ${artifact.filename}`,
          { documentType: artifact.type }
        );
      }

      const allArtifacts = artifactManager.getAllArtifacts();
      expect(allArtifacts).toHaveLength(3);

      // Check path organization
      const prdArtifact = allArtifacts.find(a => a.filename === 'prd.md');
      const archArtifact = allArtifacts.find(a => a.filename === 'architecture.md');
      const storyArtifact = allArtifacts.find(a => a.filename === 'user-story-1.md');

      expect(artifactManager.getArtifactPath(prdArtifact)).toBe('docs/prd.md');
      expect(artifactManager.getArtifactPath(archArtifact)).toBe('docs/architecture/architecture.md');
      expect(artifactManager.getArtifactPath(storyArtifact)).toBe('docs/stories/user-story-1.md');
    });

    it('should commit artifacts to GitHub', async () => {
      await artifactManager.initialize({
        owner: 'testuser',
        name: 'test-repo',
        branch: 'main',
        workflowId: 'test-workflow'
      });

      // Generate test artifacts
      await artifactManager.generateArtifact(
        'analyst',
        'requirements.md',
        '# Requirements\n\nTest requirements document.',
        { documentType: 'prd' }
      );

      await artifactManager.generateArtifact(
        'architect',
        'system-design.md',
        '# System Design\n\nTest architecture document.',
        { documentType: 'architecture' }
      );

      // Commit to repository
      const result = await artifactManager.commitArtifactsToRepository('main', 'Add BMAD workflow artifacts');

      expect(result.success).toBe(true);
      expect(result.committed).toBe(2);
      expect(result.commitSha).toBe('abc123def456');
      expect(result.branchName).toBe('main');

      // Verify git service was called correctly
      expect(mockGitService.commitWorkflowChanges).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        branchName: 'main',
        changes: [
          {
            path: 'docs/requirements.md',
            content: '# Requirements\n\nTest requirements document.'
          },
          {
            path: 'docs/architecture/system-design.md',
            content: '# System Design\n\nTest architecture document.'
          }
        ],
        message: 'Add BMAD workflow artifacts',
        workflowId: 'test-workflow'
      });
    });
  });

  describe('GitHub-Integrated Workflow Launch', () => {
    it('should launch workflow with GitHub repository context', async () => {
      const workflowPayload = {
        userPrompt: 'I want to enhance this JavaScript project with better testing and documentation.',
        name: 'Test Repository Enhancement',
        description: 'BMAD workflow for test-repo improvements',
        githubRepository: {
          owner: 'testuser',
          name: 'test-repo',
          full_name: 'testuser/test-repo',
          html_url: 'https://github.com/testuser/test-repo',
          clone_url: 'https://github.com/testuser/test-repo.git',
          default_branch: 'main',
          private: false
        }
      };

      // Mock the workflow launch
      const startWorkflowSpy = jest.spyOn(orchestrator, 'startWorkflow').mockResolvedValue({
        workflowId: 'github-workflow-test-123',
        status: 'running',
        agents: ['analyst', 'architect', 'dev', 'qa']
      });

      const result = await orchestrator.startWorkflow(workflowPayload.userPrompt, {
        workflowId: null,
        sequence: 'brownfield-fullstack',
        name: workflowPayload.name,
        description: workflowPayload.description,
        userId: mockSession.user.id,
        githubContext: {
          repository: workflowPayload.githubRepository,
          gitService: mockGitService,
          targetBranch: 'main'
        }
      });

      expect(result.workflowId).toBeDefined();
      expect(startWorkflowSpy).toHaveBeenCalledWith(
        workflowPayload.userPrompt,
        expect.objectContaining({
          githubContext: expect.objectContaining({
            repository: workflowPayload.githubRepository,
            targetBranch: 'main'
          })
        })
      );

      startWorkflowSpy.mockRestore();
    });

    it('should initialize GitHubArtifactManager with repository context', async () => {
      const initializeSpy = jest.spyOn(orchestrator.artifactManager, 'initialize');

      await orchestrator.startWorkflow('Test GitHub integration', {
        workflowId: 'test-workflow-456',
        sequence: 'brownfield-fullstack',
        userId: mockSession.user.id,
        githubContext: {
          repository: {
            owner: 'testuser',
            name: 'test-repo'
          },
          targetBranch: 'develop',
          gitService: mockGitService
        }
      });

      expect(initializeSpy).toHaveBeenCalledWith({
        owner: 'testuser',
        name: 'test-repo',
        branch: 'develop',
        workflowId: 'test-workflow-456'
      });

      initializeSpy.mockRestore();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete a full GitHub-integrated workflow cycle', async () => {
      const workflowConfig = {
        userPrompt: 'Add comprehensive testing to this Node.js project and improve the documentation.',
        githubRepository: mockGitHubAPI.repositories[0],
        workflowTemplate: 'brownfield-fullstack'
      };

      // Step 1: Initialize workflow with GitHub context
      const workflowResult = await orchestrator.startWorkflow(workflowConfig.userPrompt, {
        sequence: workflowConfig.workflowTemplate,
        userId: mockSession.user.id,
        githubContext: {
          repository: workflowConfig.githubRepository,
          gitService: mockGitService,
          targetBranch: 'main'
        }
      });

      expect(workflowResult).toBeDefined();
      expect(workflowResult.workflowId).toBeDefined();

      // Step 2: Verify GitHubArtifactManager is initialized
      expect(orchestrator.artifactManager.repositoryContext).toBeDefined();
      expect(orchestrator.artifactManager.repositoryContext.owner).toBe('testuser');
      expect(orchestrator.artifactManager.repositoryContext.name).toBe('test-repo');

      // Step 3: Simulate artifact generation during workflow
      const artifactManager = orchestrator.artifactManager;
      
      // Generate PRD
      const prdId = await artifactManager.generateArtifact(
        'analyst',
        'project-requirements.md',
        `# Project Requirements\n\n## Overview\nThis project requires comprehensive testing coverage and improved documentation.\n\n## Testing Requirements\n- Unit tests for all components\n- Integration tests for API endpoints\n- End-to-end tests for critical user flows\n\n## Documentation Requirements\n- API documentation with examples\n- Setup and deployment guides\n- Contributing guidelines`,
        { documentType: 'prd' }
      );

      // Generate Architecture Doc
      const archId = await artifactManager.generateArtifact(
        'architect',
        'testing-architecture.md',
        `# Testing Architecture\n\n## Test Structure\n- /tests/unit/ - Unit tests\n- /tests/integration/ - Integration tests  \n- /tests/e2e/ - End-to-end tests\n\n## Testing Tools\n- Jest for unit testing\n- Supertest for API testing\n- Playwright for E2E testing\n\n## Coverage Requirements\n- Minimum 80% code coverage\n- 100% coverage for critical paths`,
        { documentType: 'architecture' }
      );

      expect(artifactManager.getAllArtifacts()).toHaveLength(2);

      // Step 4: Commit artifacts to GitHub
      const commitResult = await artifactManager.commitArtifactsToRepository(
        'main',
        'Add BMAD testing and documentation artifacts\n\n🤖 Generated with BMAD AI Workflow System'
      );

      expect(commitResult.success).toBe(true);
      expect(commitResult.committed).toBe(2);
      expect(commitResult.commitSha).toBeDefined();

      // Step 5: Verify workflow summary
      const workflowSummary = artifactManager.getWorkflowSummary();
      expect(workflowSummary.repository).toBeDefined();
      expect(workflowSummary.totalArtifacts).toBe(2);
      expect(workflowSummary.agents).toContain('analyst');
      expect(workflowSummary.agents).toContain('architect');

      // Step 6: Clean up
      artifactManager.clearArtifacts();
      expect(artifactManager.getAllArtifacts()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle GitHub API errors gracefully', async () => {
      const failingGitService = {
        initialize: jest.fn().mockRejectedValue(new Error('GitHub API rate limit exceeded')),
        commitWorkflowChanges: jest.fn().mockRejectedValue(new Error('Repository access denied'))
      };

      const artifactManager = new GitHubArtifactManager(failingGitService);

      await expect(
        artifactManager.initialize({
          owner: 'testuser',
          name: 'private-repo',
          branch: 'main'
        })
      ).rejects.toThrow('GitHub API rate limit exceeded');
    });

    it('should validate repository access before workflow launch', async () => {
      const workflowPayload = {
        userPrompt: 'Test prompt',
        githubRepository: {
          owner: 'nonexistentuser',
          name: 'nonexistent-repo',
          full_name: 'nonexistentuser/nonexistent-repo',
          html_url: 'https://github.com/nonexistentuser/nonexistent-repo',
          default_branch: 'main',
          private: false
        }
      };

      const invalidGitService = {
        initialize: jest.fn().mockRejectedValue(new Error('Repository not found or access denied'))
      };

      await expect(
        orchestrator.startWorkflow(workflowPayload.userPrompt, {
          sequence: 'brownfield-fullstack',
          userId: mockSession.user.id,
          githubContext: {
            repository: workflowPayload.githubRepository,
            gitService: invalidGitService,
            targetBranch: 'main'
          }
        })
      ).rejects.toThrow('Repository not found or access denied');
    });

    it('should handle artifact commit failures', async () => {
      const artifactManager = new GitHubArtifactManager({
        ...mockGitService,
        commitWorkflowChanges: jest.fn().mockRejectedValue(new Error('Push rejected: branch protection rules'))
      });

      await artifactManager.initialize({
        owner: 'testuser',
        name: 'protected-repo',
        branch: 'main'
      });

      await artifactManager.generateArtifact(
        'test-agent',
        'test-file.md',
        'Test content',
        { documentType: 'test' }
      );

      await expect(
        artifactManager.commitArtifactsToRepository('main')
      ).rejects.toThrow('Push rejected: branch protection rules');
    });
  });
});
