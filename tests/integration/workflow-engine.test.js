/**
 * Workflow Engine Integration Tests
 * 
 * Tests the WorkflowEngine functionality including:
 * - Workflow lifecycle management
 * - Agent execution orchestration
 * - State transitions and persistence
 * - Artifact management
 * - Analytics logging
 */

const WorkflowEngine = require('../../lib/bmad/WorkflowEngine')
const AgentCommunicator = require('../../lib/bmad/AgentCommunicator')
const MockAIService = require('../__mocks__/ai-service')
const testWorkflow = require('../fixtures/workflows/test-full-stack-workflow.json')

describe('Workflow Engine Integration', () => {
  let workflowEngine
  let agentCommunicator
  let mockAI
  
  beforeEach(async () => {
    // Initialize components
    agentCommunicator = new AgentCommunicator()
    workflowEngine = new WorkflowEngine(agentCommunicator)
    mockAI = new MockAIService()
    
    // Setup mock AI
    mockAI.configure({ delay: 100, failureRate: 0 })
    workflowEngine.aiService = mockAI
    
    // Initialize
    await workflowEngine.initialize()
    
    // Clean database
    await integrationTestUtils.cleanDatabase()
  })
  
  afterEach(async () => {
    if (workflowEngine) {
      // Clean up any active workflows
      const activeWorkflows = workflowEngine.getActiveWorkflows()
      for (const workflow of activeWorkflows) {
        await workflowEngine.cancelWorkflow(workflow.id)
      }
    }
  })

  describe('Workflow Lifecycle', () => {
    test('should create and start workflow', async () => {
      const config = {
        userPrompt: testWorkflow.userPrompt,
        sequence: testWorkflow.sequence,
        name: testWorkflow.name,
        userId: 'test-user-id'
      }
      
      const result = await workflowEngine.startWorkflow(config)
      
      expect(result).toBeDefined()
      expect(result.workflowId).toBeDefined()
      expect(result.status).toBe('RUNNING')
      
      // Verify workflow is tracked
      const status = await workflowEngine.getWorkflowStatus(result.workflowId)
      expect(status.status).toBe('RUNNING')
      expect(status.sequence).toEqual(testWorkflow.sequence)
    })

    test('should track workflow state transitions', async () => {
      const config = {
        userPrompt: 'Test prompt',
        sequence: [testWorkflow.sequence[0]], // Single agent
        userId: 'test-user-id'
      }
      
      mockAI.setResponse('test-pm', {
        content: 'PM work complete',
        artifacts: [{ type: 'DOCUMENT', name: 'test.md', content: 'test' }]
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Monitor state changes
      const stateChanges = []
      const checkState = async () => {
        const status = await workflowEngine.getWorkflowStatus(workflowId)
        stateChanges.push(status.status)
        
        if (status.status === 'COMPLETED' || status.status === 'ERROR') {
          return
        }
        setTimeout(checkState, 50)
      }
      
      checkState()
      
      // Wait for completion
      await new Promise(resolve => {
        const waitForCompletion = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED') {
            resolve()
          } else {
            setTimeout(waitForCompletion, 100)
          }
        }
        waitForCompletion()
      })
      
      // Should have transitioned through states
      expect(stateChanges).toContain('RUNNING')
      expect(stateChanges).toContain('COMPLETED')
    })

    test('should handle workflow completion', async () => {
      const config = {
        userPrompt: 'Complete test',
        sequence: testWorkflow.sequence,
        userId: 'test-user-id'
      }
      
      // Set responses for all agents
      testWorkflow.sequence.forEach(agent => {
        mockAI.setResponse(agent.agentId, {
          content: `${agent.name} completed successfully`,
          artifacts: [{
            type: 'DOCUMENT',
            name: `${agent.agentId}-output.md`,
            content: `Output from ${agent.name}`
          }]
        })
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for completion
      await new Promise(resolve => {
        const checkCompletion = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId) 
          if (status.status === 'COMPLETED') {
            resolve()
          } else {
            setTimeout(checkCompletion, 100)
          }
        }
        checkCompletion()
      })
      
      const finalStatus = await workflowEngine.getWorkflowStatus(workflowId)
      expect(finalStatus.status).toBe('COMPLETED')
      expect(finalStatus.completedAt).toBeDefined()
      expect(finalStatus.duration).toBeGreaterThan(0)
    })
  })

  describe('Agent Execution', () => {
    test('should execute agents in sequence', async () => {
      const config = {
        userPrompt: 'Sequential test',
        sequence: testWorkflow.sequence,
        userId: 'test-user-id'
      }
      
      const executionOrder = []
      
      // Mock responses and track execution order
      testWorkflow.sequence.forEach(agent => {
        mockAI.setResponse(agent.agentId, {
          content: `${agent.name} executed`,
          artifacts: [],
          metadata: {
            onExecute: () => executionOrder.push(agent.agentId)
          }
        })
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for completion
      await new Promise(resolve => {
        const waitComplete = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED' || status.status === 'ERROR') {
            resolve()
          } else {
            setTimeout(waitComplete, 100)
          }
        }
        waitComplete()
      })
      
      // Verify execution order matches sequence
      const expectedOrder = testWorkflow.sequence.map(a => a.agentId)
      expect(executionOrder).toEqual(expectedOrder)
    })

    test('should provide execution context to agents', async () => {
      const config = {
        userPrompt: 'Context test',
        sequence: [testWorkflow.sequence[0]],
        userId: 'test-user-id'
      }
      
      let receivedContext = null
      
      // Mock to capture context
      const originalExecuteAgent = workflowEngine.executeAgent
      workflowEngine.executeAgent = async (workflowId, agentId, context) => {
        receivedContext = context
        return originalExecuteAgent.call(workflowEngine, workflowId, agentId, context)
      }
      
      mockAI.setResponse('test-pm', {
        content: 'Context received',
        artifacts: []
      })
      
      await workflowEngine.startWorkflow(config)
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200))
      
      expect(receivedContext).toBeDefined()
      expect(receivedContext.userPrompt).toBe('Context test')
      expect(receivedContext.workflowId).toBeDefined()
      expect(receivedContext.userId).toBe('test-user-id')
    })

    test('should handle agent execution errors', async () => {
      const config = {
        userPrompt: 'Error test',
        sequence: [testWorkflow.sequence[0]],
        userId: 'test-user-id'
      }
      
      // Configure AI to fail
      mockAI.configure({ shouldFail: true })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const status = await workflowEngine.getWorkflowStatus(workflowId)
      expect(status.status).toBe('ERROR')
      expect(status.error).toBeDefined()
      expect(status.failedAgent).toBe('test-pm')
    })

    test('should handle agent timeouts', async () => {
      const config = {
        userPrompt: 'Timeout test',
        sequence: [{
          ...testWorkflow.sequence[0],
          timeout: 100 // Very short timeout
        }],
        userId: 'test-user-id'
      }
      
      // Configure long delay
      mockAI.configure({ delay: 500 })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const status = await workflowEngine.getWorkflowStatus(workflowId)
      expect(status.status).toBe('ERROR')
      expect(status.error.message).toMatch(/timeout/i)
    })
  })

  describe('Artifact Management', () => {
    test('should collect and store artifacts', async () => {
      const config = {
        userPrompt: 'Artifact test',
        sequence: [testWorkflow.sequence[0]],
        userId: 'test-user-id'
      }
      
      const testArtifact = {
        type: 'DOCUMENT',
        name: 'test-requirements.md',
        content: '# Test Requirements\n\nTest content...',
        agentId: 'test-pm'
      }
      
      mockAI.setResponse('test-pm', {
        content: 'Requirements created',
        artifacts: [testArtifact]
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const artifacts = await workflowEngine.getWorkflowArtifacts(workflowId)
      expect(artifacts).toBeDefined()
      expect(artifacts.length).toBe(1)
      expect(artifacts[0].name).toBe('test-requirements.md')
      expect(artifacts[0].type).toBe('DOCUMENT')
      expect(artifacts[0].content).toContain('Test Requirements')
    })

    test('should handle multiple artifacts from different agents', async () => {
      const config = {
        userPrompt: 'Multi-artifact test',
        sequence: testWorkflow.sequence.slice(0, 2), // PM and Architect
        userId: 'test-user-id'
      }
      
      mockAI.setResponse('test-pm', {
        content: 'PM complete',
        artifacts: [{
          type: 'DOCUMENT',
          name: 'requirements.md',
          content: 'Requirements...',
          agentId: 'test-pm'
        }]
      })
      
      mockAI.setResponse('test-architect', {
        content: 'Architecture complete',
        artifacts: [{
          type: 'DOCUMENT',
          name: 'architecture.md', 
          content: 'Architecture...',
          agentId: 'test-architect'
        }]
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for completion
      await new Promise(resolve => {
        const waitForCompletion = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED' || status.status === 'ERROR') {
            resolve()
          } else {
            setTimeout(waitForCompletion, 100)
          }
        }
        waitForCompletion()
      })
      
      const artifacts = await workflowEngine.getWorkflowArtifacts(workflowId)
      expect(artifacts.length).toBe(2)
      
      const pmArtifact = artifacts.find(a => a.agentId === 'test-pm')
      const architectArtifact = artifacts.find(a => a.agentId === 'test-architect')
      
      expect(pmArtifact).toBeDefined()
      expect(architectArtifact).toBeDefined()
      expect(pmArtifact.name).toBe('requirements.md')
      expect(architectArtifact.name).toBe('architecture.md')
    })
  })

  describe('Workflow Control', () => {
    test('should pause workflow execution', async () => {
      const config = {
        userPrompt: 'Pause test',
        sequence: testWorkflow.sequence,
        userId: 'test-user-id'
      }
      
      // Slow execution to allow pausing
      mockAI.configure({ delay: 1000 })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Pause after brief delay
      setTimeout(async () => {
        await workflowEngine.pauseWorkflow(workflowId)
      }, 200)
      
      // Wait and verify paused
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const status = await workflowEngine.getWorkflowStatus(workflowId)
      expect(status.status).toBe('PAUSED')
    })

    test('should resume paused workflow', async () => {
      const config = {
        userPrompt: 'Resume test',
        sequence: [testWorkflow.sequence[0]],
        userId: 'test-user-id'
      }
      
      mockAI.configure({ delay: 300 })
      mockAI.setResponse('test-pm', {
        content: 'PM work done',
        artifacts: []
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Pause and resume
      setTimeout(async () => {
        await workflowEngine.pauseWorkflow(workflowId)
        setTimeout(async () => {
          await workflowEngine.resumeWorkflow(workflowId)
        }, 100)
      }, 100)
      
      // Wait for completion
      await new Promise(resolve => {
        const waitComplete = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED') {
            resolve()
          } else {
            setTimeout(waitComplete, 100)
          }
        }
        waitComplete()
      })
      
      const finalStatus = await workflowEngine.getWorkflowStatus(workflowId)
      expect(finalStatus.status).toBe('COMPLETED')
    })

    test('should cancel workflow execution', async () => {
      const config = {
        userPrompt: 'Cancel test',
        sequence: testWorkflow.sequence,
        userId: 'test-user-id'
      }
      
      mockAI.configure({ delay: 1000 })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Cancel immediately
      const result = await workflowEngine.cancelWorkflow(workflowId)
      expect(result.success).toBe(true)
      
      const status = await workflowEngine.getWorkflowStatus(workflowId)
      expect(status.status).toBe('CANCELLED')
    })
  })

  describe('Analytics and Monitoring', () => {
    test('should log workflow analytics on completion', async () => {
      const config = {
        userPrompt: 'Analytics test',
        sequence: [testWorkflow.sequence[0]],
        userId: 'test-user-id'
      }
      
      mockAI.setResponse('test-pm', {
        content: 'Analytics work done',
        artifacts: []
      })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for completion
      await new Promise(resolve => {
        const waitComplete = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED') {
            resolve()
          } else {
            setTimeout(waitComplete, 100)
          }
        }
        waitComplete()
      })
      
      // Check if analytics were saved
      const WorkflowAnalytics = require('../../lib/database/models/WorkflowAnalytics')
      const analytics = await WorkflowAnalytics.findOne({ workflowId })
      
      expect(analytics).toBeDefined()
      expect(analytics.userId).toBe('test-user-id')
      expect(analytics.status).toBe('completed')
      expect(analytics.duration).toBeGreaterThan(0)
      expect(analytics.agentCount).toBe(1)
    })

    test('should track execution history', async () => {
      const config = {
        userPrompt: 'History test',
        sequence: testWorkflow.sequence.slice(0, 2),
        userId: 'test-user-id'
      }
      
      mockAI.setResponse('test-pm', { content: 'PM done', artifacts: [] })
      mockAI.setResponse('test-architect', { content: 'Architect done', artifacts: [] })
      
      const { workflowId } = await workflowEngine.startWorkflow(config)
      
      // Wait for completion
      await new Promise(resolve => {
        const waitComplete = async () => {
          const status = await workflowEngine.getWorkflowStatus(workflowId)
          if (status.status === 'COMPLETED') {
            resolve()
          } else {
            setTimeout(waitComplete, 100)
          }
        }
        waitComplete()
      })
      
      const history = await workflowEngine.getExecutionHistory(10)
      expect(history.length).toBeGreaterThan(0)
      
      const thisWorkflow = history.find(h => h.workflowId === workflowId)
      expect(thisWorkflow).toBeDefined()
      expect(thisWorkflow.completedAgents).toBe(2)
    })
  })
})