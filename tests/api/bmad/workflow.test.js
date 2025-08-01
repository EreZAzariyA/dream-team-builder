/**
 * BMAD Workflow API Integration Tests
 * 
 * Tests the REST API endpoints for workflow management:
 * - GET /api/bmad/workflow - List workflows
 * - POST /api/bmad/workflow - Create workflow
 * - PUT /api/bmad/workflow - Update workflow status
 * - GET /api/bmad/workflow/[id] - Get workflow details
 * - DELETE /api/bmad/workflow/[id] - Delete workflow
 */

const workflowHandler = require('../../../app/api/bmad/workflow/route')
const workflowByIdHandler = require('../../../app/api/bmad/workflow/[id]/route')

describe('/api/bmad/workflow', () => {
  let testUser

  beforeEach(async () => {
    // Create test user
    testUser = await apiTestUtils.createTestUser({
      email: 'workflow-test@example.com',
      profile: { name: 'Workflow Test User' }
    })
  })

  describe('GET /api/bmad/workflow', () => {
    test('should return empty list for new user', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser)
      
      await workflowHandler.GET(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.workflows).toEqual([])
      expect(data.total).toBe(0)
      expect(data.active).toBe(0)
      expect(data.completed).toBe(0)
    })

    test('should return user workflows with status filter', async () => {
      // Create test workflows
      const Workflow = require('../../../lib/database/models/Workflow')
      await Workflow.create([
        {
          title: 'Running Workflow',
          userId: testUser._id,
          prompt: 'Test prompt 1',
          status: 'running',
          template: 'FULL_STACK'
        },
        {
          title: 'Completed Workflow', 
          userId: testUser._id,
          prompt: 'Test prompt 2',
          status: 'completed',
          template: 'BACKEND_SERVICE'
        }
      ])
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'GET',
        query: { status: 'running' }
      })
      
      await workflowHandler.GET(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.workflows).toHaveLength(1)
      expect(data.workflows[0].status).toBe('running')
      expect(data.workflows[0].title).toBe('Running Workflow')
    })

    test('should enforce authentication', async () => {
      const { req, res } = apiTestUtils.createMockReqRes({ method: 'GET' })
      
      await workflowHandler.GET(req, res)
      
      apiTestUtils.expectError(res, 401, 'Authentication required')
    })

    test('should handle limit parameter', async () => {
      // Create multiple workflows
      const Workflow = require('../../../lib/database/models/Workflow')
      const workflows = Array.from({ length: 5 }, (_, i) => ({
        title: `Workflow ${i + 1}`,
        userId: testUser._id,
        prompt: `Test prompt ${i + 1}`,
        status: 'completed',
        template: 'FULL_STACK'
      }))
      
      await Workflow.create(workflows)
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'GET',
        query: { limit: '3' }
      })
      
      await workflowHandler.GET(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.workflows).toHaveLength(3)
    })
  })

  describe('POST /api/bmad/workflow', () => {
    test('should create new workflow successfully', async () => {
      const workflowData = {
        userPrompt: 'Create a modern web application with authentication',
        name: 'Test Web App',
        description: 'A test web application',
        sequence: 'FULL_STACK',
        priority: 'medium'
      }
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'POST',
        body: workflowData
      })
      
      await workflowHandler.POST(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.workflowId).toBeDefined()
      expect(data.status).toBe('RUNNING')
      expect(data.message).toContain('started successfully')
      
      // Verify workflow was created in database
      const Workflow = require('../../../lib/database/models/Workflow')
      const workflow = await Workflow.findById(data.workflowId)
      expect(workflow).toBeDefined()
      expect(workflow.title).toBe(workflowData.name)
      expect(workflow.prompt).toBe(workflowData.userPrompt)
      expect(workflow.userId.toString()).toBe(testUser._id.toString())
    })

    test('should validate required fields', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'POST',
        body: {} // Missing required userPrompt
      })
      
      await workflowHandler.POST(req, res)
      
      apiTestUtils.expectError(res, 400, 'userPrompt is required')
    })

    test('should handle invalid sequence', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'POST',
        body: {
          userPrompt: 'Test prompt',
          sequence: 'INVALID_SEQUENCE'
        }
      })
      
      await workflowHandler.POST(req, res)
      
      apiTestUtils.expectError(res, 400, 'Invalid workflow sequence')
    })

    test('should enforce authentication', async () => {
      const { req, res } = apiTestUtils.createMockReqRes({
        method: 'POST',
        body: { userPrompt: 'Test' }
      })
      
      await workflowHandler.POST(req, res)
      
      apiTestUtils.expectError(res, 401, 'Authentication required')
    })

    test('should handle orchestrator errors', async () => {
      // Mock orchestrator to simulate error
      const BmadOrchestrator = require('../../../lib/bmad/BmadOrchestrator')
      const originalStartWorkflow = BmadOrchestrator.prototype.startWorkflow
      BmadOrchestrator.prototype.startWorkflow = jest.fn()
        .mockRejectedValue(new Error('Orchestrator initialization failed'))
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'POST',
        body: { userPrompt: 'Test prompt' }
      })
      
      await workflowHandler.POST(req, res)
      
      apiTestUtils.expectError(res, 500, 'Failed to start workflow')
      
      // Restore original method
      BmadOrchestrator.prototype.startWorkflow = originalStartWorkflow
    })
  })

  describe('PUT /api/bmad/workflow', () => {
    let testWorkflow

    beforeEach(async () => {
      // Create test workflow
      const Workflow = require('../../../lib/database/models/Workflow')
      testWorkflow = await Workflow.create({
        title: 'Test Workflow',
        userId: testUser._id,
        prompt: 'Test prompt',
        status: 'running',
        template: 'FULL_STACK'
      })
    })

    test('should pause workflow', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'PUT',
        body: {
          workflowId: testWorkflow._id.toString(),
          action: 'pause'
        }
      })
      
      await workflowHandler.PUT(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.status).toBe('PAUSED')
      expect(data.workflowId).toBe(testWorkflow._id.toString())
    })

    test('should resume workflow', async () => {
      // First pause the workflow
      testWorkflow.status = 'paused'
      await testWorkflow.save()
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'PUT',
        body: {
          workflowId: testWorkflow._id.toString(),
          action: 'resume'
        }
      })
      
      await workflowHandler.PUT(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.status).toBe('RUNNING')
    })

    test('should cancel workflow', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'PUT',
        body: {
          workflowId: testWorkflow._id.toString(),
          action: 'cancel'
        }
      })
      
      await workflowHandler.PUT(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.status).toBe('CANCELLED')
    })

    test('should validate workflow ownership', async () => {
      // Create another user
      const otherUser = await apiTestUtils.createTestUser({
        email: 'other@example.com'
      })
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(otherUser, {
        method: 'PUT',
        body: {
          workflowId: testWorkflow._id.toString(),
          action: 'pause'
        }
      })
      
      await workflowHandler.PUT(req, res)
      
      apiTestUtils.expectError(res, 404, 'Workflow not found')
    })

    test('should validate action parameter', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'PUT',
        body: {
          workflowId: testWorkflow._id.toString(),
          action: 'invalid-action'
        }
      })
      
      await workflowHandler.PUT(req, res)
      
      apiTestUtils.expectError(res, 400, 'Invalid action')
    })
  })

  describe('GET /api/bmad/workflow/[id]', () => {
    let testWorkflow

    beforeEach(async () => {
      const Workflow = require('../../../lib/database/models/Workflow')
      testWorkflow = await Workflow.create({
        title: 'Detailed Test Workflow',
        userId: testUser._id,
        prompt: 'Test prompt for details',
        status: 'completed',
        template: 'FULL_STACK',
        agentSequence: [
          { agentId: 'pm', status: 'completed' },
          { agentId: 'architect', status: 'completed' }
        ],
        outputs: [
          { type: 'DOCUMENT', name: 'requirements.md', content: 'Test requirements' }
        ]
      })
    })

    test('should return workflow details', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'GET'
      })
      
      // Mock the route parameter
      req.params = { id: testWorkflow._id.toString() }
      
      await workflowByIdHandler.GET(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.workflow._id).toBe(testWorkflow._id.toString())
      expect(data.workflow.title).toBe('Detailed Test Workflow')
      expect(data.workflow.status).toBe('completed')
      expect(data.artifacts).toBeDefined()
      expect(data.messages).toBeDefined()
    })

    test('should enforce workflow ownership', async () => {
      const otherUser = await apiTestUtils.createTestUser({
        email: 'other-details@example.com'
      })
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(otherUser, {
        method: 'GET'
      })
      
      req.params = { id: testWorkflow._id.toString() }
      
      await workflowByIdHandler.GET(req, res)
      
      apiTestUtils.expectError(res, 404, 'Workflow not found')
    })

    test('should handle invalid workflow ID', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'GET'
      })
      
      req.params = { id: 'invalid-id' }
      
      await workflowByIdHandler.GET(req, res)
      
      apiTestUtils.expectError(res, 400, 'Invalid workflow ID')
    })
  })

  describe('DELETE /api/bmad/workflow/[id]', () => {
    let testWorkflow

    beforeEach(async () => {
      const Workflow = require('../../../lib/database/models/Workflow')
      testWorkflow = await Workflow.create({
        title: 'Workflow to Delete',
        userId: testUser._id,
        prompt: 'Test prompt',
        status: 'completed',
        template: 'FULL_STACK'
      })
    })

    test('should delete workflow successfully', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'DELETE'
      })
      
      req.params = { id: testWorkflow._id.toString() }
      
      await workflowByIdHandler.DELETE(req, res)
      
      const data = apiTestUtils.expectSuccess(res)
      expect(data.message).toContain('deleted successfully')
      
      // Verify workflow was soft deleted
      const Workflow = require('../../../lib/database/models/Workflow')
      const deletedWorkflow = await Workflow.findById(testWorkflow._id)
      expect(deletedWorkflow.isDeleted).toBe(true)
    })

    test('should prevent deleting running workflow', async () => {
      testWorkflow.status = 'running'
      await testWorkflow.save()
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'DELETE'
      })
      
      req.params = { id: testWorkflow._id.toString() }
      
      await workflowByIdHandler.DELETE(req, res)
      
      apiTestUtils.expectError(res, 400, 'Cannot delete running workflow')
    })

    test('should enforce workflow ownership', async () => {
      const otherUser = await apiTestUtils.createTestUser({
        email: 'other-delete@example.com'
      })
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(otherUser, {
        method: 'DELETE'
      })
      
      req.params = { id: testWorkflow._id.toString() }
      
      await workflowByIdHandler.DELETE(req, res)
      
      apiTestUtils.expectError(res, 404, 'Workflow not found')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should handle database connection errors', async () => {
      // Mock mongoose to simulate connection error
      const mongoose = require('mongoose')
      const originalConnect = mongoose.connection.readyState
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 0, // Disconnected
        configurable: true
      })
      
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'GET'
      })
      
      await workflowHandler.GET(req, res)
      
      apiTestUtils.expectError(res, 500, 'Database connection error')
      
      // Restore connection state
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: originalConnect,
        configurable: true
      })
    })

    test('should handle malformed request bodies', async () => {
      const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
        method: 'POST',
        body: 'invalid-json-string'
      })
      
      await workflowHandler.POST(req, res)
      
      apiTestUtils.expectError(res, 400, 'Invalid request body')
    })

    test('should handle concurrent workflow creation', async () => {
      const workflowData = {
        userPrompt: 'Concurrent test',
        name: 'Concurrent Workflow'
      }
      
      // Create multiple requests simultaneously
      const requests = Promise.all([
        new Promise(async (resolve) => {
          const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
            method: 'POST',
            body: workflowData
          })
          await workflowHandler.POST(req, res)
          resolve(res.statusCode)
        }),
        new Promise(async (resolve) => {
          const { req, res } = apiTestUtils.createAuthenticatedReq(testUser, {
            method: 'POST', 
            body: workflowData
          })
          await workflowHandler.POST(req, res)
          resolve(res.statusCode)
        })
      ])
      
      const results = await requests
      
      // Both should succeed (different workflow IDs)
      expect(results).toEqual([200, 200])
    })
  })
})