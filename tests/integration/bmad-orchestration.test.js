/**
 * BMAD Orchestration Integration Tests
 * 
 * Tests the core orchestration functionality including:
 * - Workflow initialization and agent loading
 * - Sequential agent execution
 * - Inter-agent communication
 * - Error handling and recovery
 * - Artifact generation and storage
 */

const BmadOrchestrator = require('../../lib/bmad/BmadOrchestrator')
const MockAIService = require('../__mocks__/ai-service')
const testWorkflow = require('../fixtures/workflows/test-full-stack-workflow.json')
const { mockPusherServer } = require('../__mocks__/pusher')

describe('BMAD Orchestration Integration', () => {
  let orchestrator
  let mockAI
  
  beforeEach(async () => {
    // Initialize orchestrator with test configuration
    orchestrator = new BmadOrchestrator()
    
    // Setup mock AI service
    mockAI = new MockAIService()
    mockAI.configure({ delay: 100, failureRate: 0 })
    
    // Mock the AI service in the orchestrator
    orchestrator.aiService = mockAI
    
    // Initialize orchestrator
    await orchestrator.initialize()
    
    // Reset Pusher mocks
    mockPusherServer.clearEvents()
  })
  
  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup()
    }
  })

  describe('Workflow Initialization', () => {
    test('should initialize orchestrator with agents loaded', async () => {
      expect(orchestrator.isInitialized).toBe(true)
      
      const agents = orchestrator.getAvailableAgents()
      expect(agents).toBeDefined()
      expect(Array.isArray(agents)).toBe(true)
    })

    test('should load workflow sequences', async () => {
      const sequences = orchestrator.getWorkflowSequences()
      expect(sequences).toBeDefined()
      expect(sequences.FULL_STACK).toBeDefined()
      expect(Array.isArray(sequences.FULL_STACK)).toBe(true)
    })

    test('should validate workflow configuration', async () => {
      const validConfig = {
        userPrompt: testWorkflow.userPrompt,
        sequence: testWorkflow.sequence,
        name: testWorkflow.name
      }
      
      // This should not throw
      expect(() => {
        orchestrator.validateWorkflowConfig(validConfig)
      }).not.toThrow()
    })
  })

  describe('Workflow Execution', () => {
    test('should start workflow successfully', async () => {
      const result = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        {
          sequence: testWorkflow.sequence,
          name: testWorkflow.name
        }
      )
      
      expect(result).toBeDefined()
      expect(result.workflowId).toBeDefined()
      expect(result.status).toBe('RUNNING')
      expect(result.message).toContain('started successfully')
    })

    test('should execute agents in correct sequence', async () => {
      // Set up predefined responses for each agent
      mockAI.setResponse('test-pm', {
        content: 'PM analysis complete',
        artifacts: [{
          type: 'DOCUMENT',
          name: 'prd.md',
          content: 'Project requirements...'
        }]
      })
      
      mockAI.setResponse('test-architect', {
        content: 'Architecture design complete',
        artifacts: [{
          type: 'DOCUMENT', 
          name: 'architecture.md',
          content: 'System architecture...'
        }]
      })
      
      mockAI.setResponse('test-developer', {
        content: 'Development complete',
        artifacts: [{
          type: 'CODE',
          name: 'app.js',
          content: 'console.log("Hello World");'
        }]
      })
      
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: testWorkflow.sequence }
      )
      
      // Wait for workflow completion
      await new Promise(resolve => {
        const checkStatus = async () => {
          const status = await orchestrator.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED' || status.status === 'ERROR') {
            resolve()
          } else {
            setTimeout(checkStatus, 100)
          }
        }
        checkStatus()
      })
      
      const finalStatus = await orchestrator.getWorkflowStatus(workflowId)
      expect(finalStatus.status).toBe('COMPLETED')
      expect(finalStatus.completedAgents).toHaveLength(3)
      
      // Verify agent execution order
      const executionOrder = finalStatus.executionHistory.map(h => h.agentId)
      expect(executionOrder).toEqual(['test-pm', 'test-architect', 'test-developer'])
    })

    test('should generate artifacts during execution', async () => {
      mockAI.setResponse('test-pm', {
        content: 'PM work complete',
        artifacts: [{
          type: 'DOCUMENT',
          name: 'requirements.md',
          content: '# Project Requirements\n\nTest requirements...',
          agentId: 'test-pm'
        }]
      })
      
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: [testWorkflow.sequence[0]] } // Just PM agent
      )
      
      // Wait for completion
      await new Promise(resolve => {
        setTimeout(async () => {
          const artifacts = await orchestrator.getWorkflowArtifacts(workflowId)
          expect(artifacts).toBeDefined()
          expect(artifacts.length).toBeGreaterThan(0)
          expect(artifacts[0].name).toBe('requirements.md')
          expect(artifacts[0].type).toBe('DOCUMENT')
          resolve()
        }, 500)
      })
    })
  })

  describe('Agent Communication', () => {
    test('should handle inter-agent communication', async () => {
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: testWorkflow.sequence }
      )
      
      // Wait a bit for initial messages
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.messages).toBeDefined()
      expect(Array.isArray(status.messages)).toBe(true)
      
      // Should have activation messages
      const activationMessages = status.messages.filter(m => m.type === 'ACTIVATION')
      expect(activationMessages.length).toBeGreaterThan(0)
    })

    test('should broadcast real-time updates via Pusher', async () => {
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: [testWorkflow.sequence[0]] }
      )
      
      // Wait for Pusher events
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const pusherEvents = mockPusherServer.getEvents()
      expect(pusherEvents.length).toBeGreaterThan(0)
      
      // Should have workflow events
      const workflowEvents = pusherEvents.filter(e => 
        e.channel === `workflow-${workflowId}`
      )
      expect(workflowEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle agent execution failure', async () => {
      // Configure AI service to fail
      mockAI.configure({ shouldFail: true })
      
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: [testWorkflow.sequence[0]] }
      )
      
      // Wait for failure
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe('ERROR')
      expect(status.error).toBeDefined()
      expect(status.error.message).toContain('Mock AI service failure')
    })

    test('should handle agent timeout', async () => {
      // Configure long delay to simulate timeout
      mockAI.configure({ delay: 35000 }) // Longer than timeout
      
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { 
          sequence: [testWorkflow.sequence[0]],
          timeout: 1000 // Short timeout for testing
        }
      )
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe('ERROR')
      expect(status.error).toBeDefined()
    })

    test('should allow workflow cancellation', async () => {
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: testWorkflow.sequence }
      )
      
      // Cancel immediately
      const result = await orchestrator.cancelWorkflow(workflowId)
      expect(result.success).toBe(true)
      
      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe('CANCELLED')
    })
  })

  describe('Workflow State Management', () => {
    test('should pause and resume workflow', async () => {
      // Set up slow response to have time to pause
      mockAI.configure({ delay: 1000 })
      
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: testWorkflow.sequence }
      )
      
      // Pause after a short delay
      setTimeout(async () => {
        await orchestrator.pauseWorkflow(workflowId)
      }, 200)
      
      // Wait and check paused state
      await new Promise(resolve => setTimeout(resolve, 500))
      
      let status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe('PAUSED')
      
      // Resume workflow
      await orchestrator.resumeWorkflow(workflowId)
      
      status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.status).toBe('RUNNING')
    })

    test('should track workflow progress', async () => {
      mockAI.configure({ delay: 100 })
      
      const { workflowId } = await orchestrator.startWorkflow(
        testWorkflow.userPrompt,
        { sequence: testWorkflow.sequence }
      )
      
      // Check progress during execution
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.progress).toBeDefined()
      expect(typeof status.progress.percentage).toBe('number')
      expect(status.progress.currentStep).toBeDefined()
      expect(status.progress.totalSteps).toBe(3)
    })
  })

  describe('Concurrent Workflows', () => {
    test('should handle multiple workflows simultaneously', async () => {
      mockAI.configure({ delay: 200 })
      
      // Start multiple workflows
      const workflows = await Promise.all([
        orchestrator.startWorkflow('Create app 1', { sequence: [testWorkflow.sequence[0]] }),
        orchestrator.startWorkflow('Create app 2', { sequence: [testWorkflow.sequence[0]] }),
        orchestrator.startWorkflow('Create app 3', { sequence: [testWorkflow.sequence[0]] })
      ])
      
      expect(workflows).toHaveLength(3)
      workflows.forEach(workflow => {
        expect(workflow.workflowId).toBeDefined()
        expect(workflow.status).toBe('RUNNING')
      })
      
      // Check active workflows
      const activeWorkflows = orchestrator.getActiveWorkflows()
      expect(activeWorkflows.length).toBe(3)
    })

    test('should not exceed maximum concurrent workflows', async () => {
      // Set a low limit for testing
      orchestrator.maxConcurrentWorkflows = 2
      
      // Start workflows beyond limit
      const workflow1 = await orchestrator.startWorkflow('App 1', { sequence: [testWorkflow.sequence[0]] })
      const workflow2 = await orchestrator.startWorkflow('App 2', { sequence: [testWorkflow.sequence[0]] })
      
      // Third should be queued or rejected
      await expect(
        orchestrator.startWorkflow('App 3', { sequence: [testWorkflow.sequence[0]] })
      ).rejects.toThrow(/concurrent/)
    })
  })

  describe('System Health', () => {
    test('should provide system health status', async () => {
      const health = orchestrator.getSystemHealth()
      
      expect(health).toBeDefined()
      expect(health.status).toBe('healthy')
      expect(health.initialized).toBe(true)
      expect(health.agentsLoaded).toBeGreaterThan(0)
      expect(health.uptime).toBeGreaterThan(0)
    })

    test('should track resource usage', async () => {
      const health = orchestrator.getSystemHealth()
      
      expect(health.resources).toBeDefined()
      expect(typeof health.resources.memoryUsage).toBe('number')
      expect(typeof health.resources.activeWorkflows).toBe('number')
    })
  })
})