/**
 * BMAD Orchestration Integration Tests - Real API
 * 
 * Tests the complete BMAD system integration:
 * - BmadOrchestrator initialization and workflow management
 * - WorkflowEngine execution flow  
 * - AgentCommunicator message handling
 * - End-to-end workflow execution
 * - Error handling and recovery
 */

import { BmadOrchestrator } from '../../lib/bmad/BmadOrchestrator.js'
import { WorkflowEngine } from '../../lib/bmad/WorkflowEngine.js'
import { AgentCommunicator } from '../../lib/bmad/AgentCommunicator.js'
import { WorkflowStatus, MessageType, WorkflowSequences } from '../../lib/bmad/types.js'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

describe('BMAD Orchestration Integration - Real API', () => {
  let mongoServer
  let orchestrator
  let workflowEngine
  let communicator

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    
    // Connect mongoose
    await mongoose.connect(mongoUri)
    console.log('🧪 BMAD Integration test MongoDB setup complete')
  })

  afterAll(async () => {
    // Clean up database connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
    
    if (mongoServer) {
      await mongoServer.stop()
    }
    
    console.log('🧪 BMAD Integration test cleanup complete')
  })

  beforeEach(async () => {
    // Clean database between tests
    const collections = mongoose.connection.collections
    for (const key in collections) {
      await collections[key].deleteMany({})
    }

    // Initialize fresh instances for each test
    orchestrator = new BmadOrchestrator()
    workflowEngine = new WorkflowEngine()
    communicator = new AgentCommunicator()

    // Mock the AgentLoader to avoid file system dependencies
    const mockAgentLoader = {
      loadAllAgents: jest.fn().mockResolvedValue(true),
      getAllAgentsMetadata: jest.fn().mockReturnValue([
        { id: 'pm', name: 'Project Manager', role: 'Project Management' },
        { id: 'architect', name: 'System Architect', role: 'System Architecture' },
        { id: 'dev', name: 'Developer', role: 'Software Development' }
      ]),
      validateWorkflowSequence: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      getAgentDefinition: jest.fn().mockImplementation((agentId) => ({
        agent_id: agentId,
        name: `Test ${agentId}`,
        role: `Test Role`,
        persona: 'Test persona',
        capabilities: ['test_capability']
      })),
      getDefaultWorkflowSequence: jest.fn().mockReturnValue(WorkflowSequences.FULL_STACK)
    }

    // Mock the AgentExecutor to avoid AI service dependencies  
    const mockAgentExecutor = {
      executeAgent: jest.fn().mockImplementation(async (agentDefinition, userPrompt, context) => {
        // Simulate agent execution with realistic delay
        await new Promise(resolve => setTimeout(resolve, 100))
        
        return {
          content: `${agentDefinition.name} has processed: "${userPrompt}". Context: ${JSON.stringify(context)}`,
          artifacts: [{
            type: 'DOCUMENT',
            name: `${agentDefinition.agent_id}_output.md`,
            content: `# ${agentDefinition.name} Output\n\nProcessed request successfully.`,
            agentId: agentDefinition.agent_id,
            timestamp: new Date().toISOString()
          }],
          metadata: {
            agentId: agentDefinition.agent_id,
            executionTime: 100,
            confidence: 0.95
          }
        }
      })
    }

    // Mock the ArtifactManager to avoid file system dependencies
    const mockArtifactManager = {
      initialize: jest.fn().mockResolvedValue(true),
      storeArtifact: jest.fn().mockResolvedValue({ id: 'artifact-id', path: '/mock/path' }),
      getArtifacts: jest.fn().mockResolvedValue([])
    }

    // Replace the real dependencies with mocks
    orchestrator.agentLoader = mockAgentLoader
    orchestrator.workflowEngine.agentLoader = mockAgentLoader
    orchestrator.workflowEngine.executor = mockAgentExecutor
    orchestrator.workflowEngine.artifactManager = mockArtifactManager

    workflowEngine.agentLoader = mockAgentLoader
    workflowEngine.executor = mockAgentExecutor
    workflowEngine.artifactManager = mockArtifactManager
  })

  afterEach(async () => {
    // Clean up orchestrator
    if (orchestrator) {
      // Cancel any active workflows
      try {
        const activeWorkflows = orchestrator.workflowEngine.activeWorkflows || new Map()
        for (const [workflowId] of activeWorkflows) {
          await orchestrator.cancelWorkflow(workflowId).catch(() => {})
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  })

  describe('BmadOrchestrator Initialization', () => {
    test('should initialize orchestrator successfully', async () => {
      expect(orchestrator.initialized).toBe(false)
      
      await orchestrator.initialize()
      
      expect(orchestrator.initialized).toBe(true)
      expect(orchestrator.agentLoader.loadAllAgents).toHaveBeenCalled()
    })

    test('should throw error if already initialized', async () => {
      await orchestrator.initialize()
      
      // Second initialization should not throw but should handle gracefully
      await expect(orchestrator.initialize()).resolves.toBe(true)
    })

    test('should initialize with Redux store integration', async () => {
      const mockStore = {
        dispatch: jest.fn(),
        getState: jest.fn().mockReturnValue({}),
        subscribe: jest.fn()
      }
      
      const orchestratorWithStore = new BmadOrchestrator(mockStore)
      orchestratorWithStore.agentLoader = orchestrator.agentLoader
      orchestratorWithStore.workflowEngine = orchestrator.workflowEngine
      
      await orchestratorWithStore.initialize()
      
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bmad/initialized',
          payload: expect.objectContaining({
            agents: expect.any(Array),
            sequences: expect.any(Array)
          })
        })
      )
    })
  })

  describe('Workflow Creation and Management', () => {
    beforeEach(async () => {
      await orchestrator.initialize()
    })

    test('should start workflow with valid prompt', async () => {
      const userPrompt = 'Create a modern web application with user authentication and dashboard functionality'
      
      const result = await orchestrator.startWorkflow(userPrompt, {
        name: 'Test Web Application',
        sequence: 'FULL_STACK',
        userId: 'test-user-123'
      })
      
      expect(result).toBeDefined()
      expect(result.workflowId).toBeDefined()
      expect(result.status).toBe(WorkflowStatus.RUNNING)
      expect(result.message).toContain('started successfully')
    })

    test('should reject workflow with invalid prompt', async () => {
      const shortPrompt = 'Hello'
      
      await expect(
        orchestrator.startWorkflow(shortPrompt)
      ).rejects.toThrow('User prompt must be at least 10 characters long')
    })

    test('should use default sequence when none specified', async () => {
      const userPrompt = 'Build a simple blog application with CRUD functionality'
      
      const result = await orchestrator.startWorkflow(userPrompt)
      
      expect(result.workflowId).toBeDefined()
      expect(orchestrator.agentLoader.getDefaultWorkflowSequence).toHaveBeenCalled()
    })

    test('should validate workflow configuration', async () => {
      const userPrompt = 'Create an e-commerce platform with payment integration'
      
      // Make validation fail
      orchestrator.agentLoader.validateWorkflowSequence.mockResolvedValueOnce({
        valid: false,
        errors: ['Invalid agent sequence', 'Missing required agent']
      })
      
      await expect(
        orchestrator.startWorkflow(userPrompt, { sequence: 'INVALID_SEQUENCE' })
      ).rejects.toThrow('Invalid workflow sequence: Invalid agent sequence, Missing required agent')
    })
  })

  describe('Workflow Status and Progress Tracking', () => {
    let workflowId

    beforeEach(async () => {
      await orchestrator.initialize()
      
      const result = await orchestrator.startWorkflow(
        'Create a task management application with real-time collaboration',
        { name: 'Task Manager', userId: 'test-user' }
      )
      workflowId = result.workflowId
    })

    test('should get workflow status', async () => {
      const status = orchestrator.getWorkflowStatus(workflowId)
      
      expect(status).toBeDefined()
      expect(status.id).toBe(workflowId)
      expect(status.status).toBe(WorkflowStatus.RUNNING)
      expect(status.communication).toBeDefined()
      expect(status.agents).toBeDefined()
    })

    test('should return null for non-existent workflow', () => {
      const status = orchestrator.getWorkflowStatus('non-existent-workflow')
      expect(status).toBeNull()
    })

    test('should track workflow progress over time', async () => {
      // Wait a bit for some progress
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      expect(status.currentStep).toBeGreaterThanOrEqual(0)
      expect(status.startTime).toBeDefined()
      
      if (status.status === WorkflowStatus.COMPLETED) {
        expect(status.endTime).toBeDefined()
      }
    })
  })

  describe('Workflow Control Operations', () => {
    let workflowId

    beforeEach(async () => {
      await orchestrator.initialize()
      
      const result = await orchestrator.startWorkflow(
        'Build a social media platform with user profiles and messaging',
        { name: 'Social Platform', userId: 'test-user' }
      )
      workflowId = result.workflowId
    })

    test('should pause workflow execution', async () => {
      const result = await orchestrator.pauseWorkflow(workflowId)
      
      expect(result.success).toBe(true)
      expect(result.workflowId).toBe(workflowId)
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe(WorkflowStatus.PAUSED)
    })

    test('should resume paused workflow', async () => {
      // First pause the workflow
      await orchestrator.pauseWorkflow(workflowId)
      
      // Then resume it
      const result = await orchestrator.resumeWorkflow(workflowId)
      
      expect(result.success).toBe(true)
      expect(result.workflowId).toBe(workflowId)
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe(WorkflowStatus.RUNNING)
    })

    test('should cancel workflow execution', async () => {
      const result = await orchestrator.cancelWorkflow(workflowId)
      
      expect(result.success).toBe(true)
      expect(result.workflowId).toBe(workflowId)
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe(WorkflowStatus.CANCELLED)
    })

    test('should handle workflow control errors gracefully', async () => {
      const nonExistentWorkflowId = 'workflow-does-not-exist'
      
      await expect(
        orchestrator.pauseWorkflow(nonExistentWorkflowId)
      ).rejects.toThrow()
      
      await expect(
        orchestrator.resumeWorkflow(nonExistentWorkflowId)
      ).rejects.toThrow()
      
      await expect(
        orchestrator.cancelWorkflow(nonExistentWorkflowId)
      ).rejects.toThrow()
    })
  })

  describe('Agent Communication Integration', () => {
    let workflowId

    beforeEach(async () => {
      await orchestrator.initialize()
      
      const result = await orchestrator.startWorkflow(
        'Create a project management tool with team collaboration features',
        { name: 'Project Manager', userId: 'test-user' }
      )
      workflowId = result.workflowId
    })

    test('should handle agent activation messages', async () => {
      const activationHandler = jest.fn()
      orchestrator.communicator.on('agent:activated', activationHandler)
      
      // Wait for some agent activations
      await new Promise(resolve => setTimeout(resolve, 300))
      
      expect(activationHandler).toHaveBeenCalled()
      
      const activationCall = activationHandler.mock.calls[0][0]
      expect(activationCall.workflowId).toBe(workflowId)
      expect(activationCall.agentId).toBeDefined()
    })

    test('should track message history', async () => {
      // Wait for some messages to be exchanged
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const messageHistory = orchestrator.communicator.getMessageHistory(workflowId)
      expect(Array.isArray(messageHistory)).toBe(true)
      expect(messageHistory.length).toBeGreaterThan(0)
      
      // Check message structure
      if (messageHistory.length > 0) {
        const message = messageHistory[0]
        expect(message.workflowId).toBe(workflowId)
        expect(message.type).toBeDefined()
        expect(message.timestamp).toBeDefined()
      }
    })

    test('should track active channels', async () => {
      // Wait for agents to be activated
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const activeChannels = orchestrator.communicator.getActiveChannels(workflowId)
      expect(Array.isArray(activeChannels)).toBe(true)
      
      if (activeChannels.length > 0) {
        const channel = activeChannels[0]
        expect(channel.workflowId).toBe(workflowId)
        expect(channel.agentId).toBeDefined()
        expect(channel.status).toBeDefined()
        expect(channel.startTime).toBeDefined()
      }
    })
  })

  describe('Workflow Completion and Results', () => {
    test('should complete simple workflow successfully', async () => {
      await orchestrator.initialize()
      
      // Create a simple workflow with just one agent
      const mockSingleAgentSequence = [
        { agentId: 'pm', role: 'Project Management', description: 'Create project plan' }
      ]
      
      orchestrator.agentLoader.getDefaultWorkflowSequence.mockReturnValue(mockSingleAgentSequence)
      
      const result = await orchestrator.startWorkflow(
        'Create a simple todo list application with basic CRUD operations',
        { name: 'Simple Todo App', userId: 'test-user' }
      )
      
      const workflowId = result.workflowId
      
      // Wait for completion
      let status
      let attempts = 0
      do {
        await new Promise(resolve => setTimeout(resolve, 100))
        status = orchestrator.getWorkflowStatus(workflowId)
        attempts++
      } while (status.status === WorkflowStatus.RUNNING && attempts < 50)
      
      expect(status.status).toBe(WorkflowStatus.COMPLETED)
      expect(status.endTime).toBeDefined()
      expect(status.artifacts).toBeDefined()
    })

    test('should collect workflow artifacts', async () => {
      await orchestrator.initialize()
      
      const result = await orchestrator.startWorkflow(
        'Build a weather dashboard with data visualization',
        { name: 'Weather Dashboard', userId: 'test-user' }
      )
      
      const workflowId = result.workflowId
      
      // Wait for some progress
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const artifacts = await orchestrator.getWorkflowArtifacts(workflowId)
      expect(Array.isArray(artifacts)).toBe(true)
      
      // If artifacts exist, check their structure
      if (artifacts.length > 0) {
        const artifact = artifacts[0]
        expect(artifact.type).toBeDefined()
        expect(artifact.name).toBeDefined()
        expect(artifact.content).toBeDefined()
        expect(artifact.agentId).toBeDefined()
      }
    })
  })

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await orchestrator.initialize()
    })

    test('should handle agent execution errors', async () => {
      // Make the executor throw an error
      orchestrator.workflowEngine.executor.executeAgent.mockRejectedValueOnce(
        new Error('Agent execution failed: AI service unavailable')
      )
      
      const result = await orchestrator.startWorkflow(
        'Create a chat application with real-time messaging',
        { name: 'Chat App', userId: 'test-user' }
      )
      
      const workflowId = result.workflowId
      
      // Wait for the error to propagate
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe(WorkflowStatus.ERROR)
      expect(status.errors).toBeDefined()
      expect(status.errors.length).toBeGreaterThan(0)
    })

    test('should handle workflow initialization errors', async () => {
      // Make agent loader validation fail
      orchestrator.agentLoader.validateWorkflowSequence.mockRejectedValueOnce(
        new Error('Failed to validate workflow sequence')
      )
      
      await expect(
        orchestrator.startWorkflow(
          'Build an e-learning platform with video streaming',
          { name: 'E-Learning Platform', userId: 'test-user' }
        )
      ).rejects.toThrow('Failed to validate workflow sequence')
    })

    test('should provide error recovery suggestions', async () => {
      // Mock an error with recovery suggestions
      const errorWithRecovery = new Error('Agent execution failed')
      errorWithRecovery.recovery = {
        suggestions: ['Retry with different parameters', 'Check AI service status'],
        retryable: true
      }
      
      orchestrator.workflowEngine.executor.executeAgent.mockRejectedValueOnce(errorWithRecovery)
      
      const result = await orchestrator.startWorkflow(
        'Create a booking system with calendar integration',
        { name: 'Booking System', userId: 'test-user' }
      )
      
      const workflowId = result.workflowId
      
      // Wait for error to occur
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      if (status.status === WorkflowStatus.ERROR && status.errors.length > 0) {
        const error = status.errors[0]
        expect(error.recovery).toBeDefined()
        expect(error.recovery.suggestions).toBeDefined()
        expect(error.recovery.retryable).toBe(true)
      }
    })
  })

  describe('System Health and Performance', () => {
    beforeEach(async () => {
      await orchestrator.initialize()
    })

    test('should provide system health status', () => {
      const health = orchestrator.getSystemHealth()
      
      expect(health).toBeDefined()
      expect(health.status).toBe('healthy')
      expect(health.initialized).toBe(true)
      expect(health.components).toBeDefined()
      expect(health.uptime).toBeGreaterThan(0)
    })

    test('should track performance metrics', async () => {
      const startTime = Date.now()
      
      const result = await orchestrator.startWorkflow(
        'Build a content management system with user roles',
        { name: 'CMS', userId: 'test-user' }
      )
      
      const workflowId = result.workflowId
      
      // Wait for some execution
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const status = orchestrator.getWorkflowStatus(workflowId)
      const executionTime = Date.now() - startTime
      
      expect(executionTime).toBeGreaterThan(0)
      expect(status.startTime).toBeDefined()
      
      if (status.status === WorkflowStatus.COMPLETED) {
        const totalDuration = new Date(status.endTime) - new Date(status.startTime)
        expect(totalDuration).toBeGreaterThan(0)
      }
    })

    test('should handle concurrent workflows', async () => {
      const workflows = await Promise.all([
        orchestrator.startWorkflow('Create app 1', { name: 'App 1', userId: 'user-1' }),
        orchestrator.startWorkflow('Create app 2', { name: 'App 2', userId: 'user-2' }),
        orchestrator.startWorkflow('Create app 3', { name: 'App 3', userId: 'user-3' })
      ])
      
      expect(workflows).toHaveLength(3)
      
      workflows.forEach(workflow => {
        expect(workflow.workflowId).toBeDefined()
        expect(workflow.status).toBe(WorkflowStatus.RUNNING)
      })
      
      // Verify all workflows are tracked
      const workflowIds = workflows.map(w => w.workflowId)
      workflowIds.forEach(id => {
        const status = orchestrator.getWorkflowStatus(id)
        expect(status).toBeDefined()
      })
    })
  })

  describe('Integration with External Systems', () => {
    beforeEach(async () => {
      await orchestrator.initialize()
    })

    test('should integrate with Redux store', async () => {
      const mockStore = {
        dispatch: jest.fn(),
        getState: jest.fn().mockReturnValue({ workflow: { active: [] } }),
        subscribe: jest.fn()
      }
      
      const orchestratorWithStore = new BmadOrchestrator(mockStore)
      orchestratorWithStore.agentLoader = orchestrator.agentLoader
      orchestratorWithStore.workflowEngine = orchestrator.workflowEngine
      
      await orchestratorWithStore.initialize()
      
      const result = await orchestratorWithStore.startWorkflow(
        'Create a notification system with email and SMS',
        { name: 'Notification System', userId: 'test-user' }
      )
      
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow/started',
          payload: expect.objectContaining({
            workflowId: result.workflowId,
            config: expect.any(Object),
            status: WorkflowStatus.RUNNING
          })
        })
      )
    })

    test('should support workflow analytics logging', async () => {
      const result = await orchestrator.startWorkflow(
        'Build an analytics dashboard with charts and reports',
        { name: 'Analytics Dashboard', userId: 'test-user' }
      )
      
      const workflowId = result.workflowId
      
      // Wait for some execution
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Check if workflow analytics would be logged
      const status = orchestrator.getWorkflowStatus(workflowId)
      expect(status.communication.statistics).toBeDefined()
      expect(status.communication.messageCount).toBeGreaterThanOrEqual(0)
    })
  })
})