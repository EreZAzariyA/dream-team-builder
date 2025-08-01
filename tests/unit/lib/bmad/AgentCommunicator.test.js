/**
 * AgentCommunicator Unit Tests
 * 
 * Tests the AgentCommunicator class functionality:
 * - Message sending and handling
 * - Event emission and subscription
 * - Message history tracking
 * - Communication statistics
 * - WebSocket integration
 */

const { AgentCommunicator } = require('../../../../lib/bmad/AgentCommunicator.js')
const { EventEmitter } = require('events')

describe('AgentCommunicator', () => {
  let communicator
  let mockWebSocketServer

  beforeEach(() => {
    communicator = new AgentCommunicator()
    
    // Mock WebSocket server
    mockWebSocketServer = new EventEmitter()
    mockWebSocketServer.broadcast = jest.fn()
    mockWebSocketServer.broadcastToWorkflow = jest.fn()
    mockWebSocketServer.broadcastToAgent = jest.fn()
    mockWebSocketServer.emit = jest.fn()
    
    communicator.setWebSocketServer(mockWebSocketServer)
  })

  afterEach(() => {
    if (communicator) {
      communicator.removeAllListeners()
    }
  })

  describe('Initialization', () => {
    test('should initialize with empty state', () => {
      expect(communicator.messageHistory).toEqual(new Map())
      expect(communicator.activeChannels).toEqual(new Map())
      expect(communicator instanceof EventEmitter).toBe(true)
    })

    test('should set up default message handlers', () => {
      expect(communicator.messageHandlers.has('activation')).toBe(true)
      expect(communicator.messageHandlers.has('completion')).toBe(true)
      expect(communicator.messageHandlers.has('error')).toBe(true)
      expect(communicator.messageHandlers.has('inter_agent')).toBe(true)
    })
  })

  describe('Message Sending', () => {
    test('should send activation message successfully', async () => {
      const workflowId = 'test-workflow-1'
      const message = {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: { action: 'start', context: 'Test context' }
      }

      const result = await communicator.sendMessage(workflowId, message)
      
      expect(result.id).toBeDefined()
      expect(result.timestamp).toBeDefined()
      expect(result.type).toBe('activation')
      
      // Check message was stored in history
      const history = communicator.getMessageHistory(workflowId)
      expect(history.length).toBe(1)
      expect(history[0].type).toBe('activation')
    })

    test('should send completion message successfully', async () => {
      const workflowId = 'test-workflow-2'
      const message = {
        type: 'completion',
        from: 'pm',
        to: 'architect',
        content: {
          output: 'PM work completed',
          artifacts: [{ name: 'prd.md', type: 'DOCUMENT' }]
        }
      }

      const result = await communicator.sendMessage(workflowId, message)
      
      expect(result.id).toBeDefined()
      expect(result.type).toBe('completion')
      
      const history = communicator.getMessageHistory(workflowId)
      expect(history[0].content.output).toBe('PM work completed')
      expect(history[0].content.artifacts).toHaveLength(1)
    })

    test('should validate message structure', async () => {
      const workflowId = 'test-workflow-3'
      const invalidMessage = {
        // Missing required fields
        content: 'Test content'
      }

      await expect(
        communicator.sendMessage(workflowId, invalidMessage)
      ).rejects.toThrow('Message missing required field')
    })

    test('should generate unique message IDs', async () => {
      const workflowId = 'test-workflow-4'
      const message1 = {
        type: 'inter_agent',
        from: 'pm',
        to: 'architect',
        content: 'Message 1',
        workflowId
      }
      const message2 = {
        type: 'inter_agent', 
        from: 'architect',
        to: 'developer',
        content: 'Message 2',
        workflowId
      }

      const result1 = await communicator.sendMessage(workflowId, message1)
      const result2 = await communicator.sendMessage(workflowId, message2)
      
      expect(result1.id).not.toBe(result2.id)
    })

    test('should handle message sending with priority', async () => {
      const workflowId = 'test-workflow-priority'
      const highPriorityMessage = {
        type: 'error',
        from: 'developer',
        to: 'system',
        content: { error: 'Critical error occurred' },
        priority: 'high',
        workflowId
      }

      const result = await communicator.sendMessage(workflowId, highPriorityMessage)
      
      expect(result.id).toBeDefined()
      
      const history = communicator.getMessageHistory(workflowId)
      expect(history[0].priority).toBe('high')
    })
  })

  describe('Message Handling', () => {
    test('should handle activation messages', async () => {
      const activationHandler = jest.fn()
      communicator.on('agent:activated', activationHandler)
      
      const workflowId = 'test-workflow-activation'
      const message = {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: { action: 'start', context: 'Test context' },
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(activationHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        context: 'Test context'
      })
    })

    test('should handle completion messages', async () => {
      const completionHandler = jest.fn()
      communicator.on('agent:completed', completionHandler)
      
      const workflowId = 'test-workflow-completion'
      const message = {
        type: 'completion',
        from: 'pm',
        to: 'architect',
        content: { output: 'Work completed' },
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(completionHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        result: { output: 'Work completed' }
      })
    })

    test('should handle error messages', async () => {
      const errorHandler = jest.fn()
      communicator.on('workflow:error', errorHandler)
      
      const workflowId = 'test-workflow-error'
      const message = {
        type: 'error',
        from: 'developer',
        to: 'system',
        content: { error: 'Compilation failed' },
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(errorHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'developer',
        error: { error: 'Compilation failed' }
      })
    })

    test('should handle inter-agent messages', async () => {
      const interAgentHandler = jest.fn()
      communicator.on('agent:communication', interAgentHandler)
      
      const workflowId = 'test-workflow-inter'
      const message = {
        type: 'inter_agent',
        from: 'pm', 
        to: 'architect',
        content: 'Please review the technical requirements',
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(interAgentHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'architect',
        content: 'Please review the technical requirements'
      })
    })
  })

  describe('Message History', () => {
    test('should track message history per workflow', async () => {
      const workflowId1 = 'workflow-1'
      const workflowId2 = 'workflow-2'
      
      await communicator.sendMessage(workflowId1, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: 'Start workflow 1',
        workflowId: workflowId1
      })
      
      await communicator.sendMessage(workflowId2, {
        type: 'activation',
        from: 'system', 
        to: 'architect',
        content: 'Start workflow 2',
        workflowId: workflowId2
      })
      
      const history1 = communicator.getMessageHistory(workflowId1)
      const history2 = communicator.getMessageHistory(workflowId2)
      
      expect(history1.length).toBe(1)
      expect(history2.length).toBe(1)
      expect(history1[0].content).toBe('Start workflow 1')
      expect(history2[0].content).toBe('Start workflow 2')
    })

    test('should filter message history by type', async () => {
      const workflowId = 'test-workflow-filter'
      
      // Send different types of messages
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: 'Activate PM',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'completion',
        from: 'pm',
        to: 'architect',
        content: 'PM completed',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'error',
        from: 'architect',
        to: 'system',
        content: { error: 'Error occurred' },
        workflowId
      })
      
      const allMessages = communicator.getMessageHistory(workflowId)
      const activationMessages = communicator.getMessageHistory(workflowId, { type: 'activation' })
      const errorMessages = communicator.getMessageHistory(workflowId, { type: 'error' })
      
      expect(allMessages.length).toBe(3)
      expect(activationMessages.length).toBe(1)
      expect(errorMessages.length).toBe(1)
      expect(activationMessages[0].type).toBe('activation')
      expect(errorMessages[0].type).toBe('error')
    })

    test('should limit message history results', async () => {
      const workflowId = 'test-workflow-limit'
      
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await communicator.sendMessage(workflowId, {
          type: 'inter_agent',
          from: 'pm',
          to: 'architect',
          content: `Message ${i}`,
          workflowId
        })
      }
      
      const allMessages = communicator.getMessageHistory(workflowId)
      const limitedMessages = communicator.getMessageHistory(workflowId, { limit: 3 })
      
      expect(allMessages.length).toBe(5)
      expect(limitedMessages.length).toBe(3)
      
      // Should return most recent messages (last 3 in reverse order)
      expect(limitedMessages[0].content).toBe('Message 2')
      expect(limitedMessages[2].content).toBe('Message 4')
    })
  })

  describe('Active Channels', () => {
    test('should track active channels', async () => {
      const workflowId = 'test-workflow-channels'
      
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: 'Activate PM',
        workflowId
      })
      
      const activeChannels = communicator.getActiveChannels(workflowId)
      expect(activeChannels).toBeDefined()
      expect(activeChannels.length).toBeGreaterThan(0)
      expect(activeChannels[0]).toMatchObject({
        agentId: 'pm',
        status: 'active'
      })
    })

    test('should update channel status on completion', async () => {
      const workflowId = 'test-workflow-channel-status'
      
      // Activate agent
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: 'Activate PM',
        workflowId
      })
      
      // Complete agent
      await communicator.sendMessage(workflowId, {
        type: 'completion',
        from: 'pm',
        to: 'architect',
        content: 'PM completed',
        workflowId
      })
      
      const activeChannels = communicator.getActiveChannels(workflowId)
      const pmChannel = activeChannels.find(c => c.agentId === 'pm')
      
      expect(pmChannel.status).toBe('completed')
    })
  })

  describe('Communication Timeline', () => {
    test.skip('should generate communication timeline', async () => {
      const workflowId = 'test-workflow-timeline'
      
      // Send sequence of messages
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: { action: 'start', context: 'Start PM' },
        workflowId
      })
      
      await new Promise(resolve => setTimeout(resolve, 5)) // Small delay
      
      await communicator.sendMessage(workflowId, {
        type: 'completion',
        from: 'pm',
        to: 'architect',
        content: { output: 'PM done' },
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'architect',
        content: { action: 'start', context: 'Start Architect' },
        workflowId
      })
      
      const timeline = communicator.getCommunicationTimeline(workflowId)
      
      expect(timeline).toBeDefined()
      expect(Array.isArray(timeline)).toBe(true)
      expect(timeline.length).toBe(3)
      
      // Should be in chronological order
      expect(new Date(timeline[0].timestamp).getTime()).toBeLessThan(
        new Date(timeline[1].timestamp).getTime()
      )
    })
  })

  describe('Inter-Agent Communication', () => {
    test('should send inter-agent messages', async () => {
      const workflowId = 'test-inter-agent'
      const messageHandler = jest.fn()
      
      communicator.on('agent:communication', messageHandler)
      
      const result = await communicator.sendInterAgentMessage(
        workflowId,
        'pm',
        'architect',
        { message: 'Please review the technical requirements' }
      )
      
      expect(result.id).toBeDefined()
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'architect',
        content: expect.objectContaining({
          message: 'Please review the technical requirements'
        })
      })
    })

    test('should broadcast messages to all agents', async () => {
      const workflowId = 'test-broadcast'
      const messageHandler = jest.fn()
      
      // First activate some agents to create channels
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'architect',
        content: { action: 'start', context: 'Setup' },
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'developer',
        content: { action: 'start', context: 'Setup' },
        workflowId
      })
      
      communicator.on('agent:communication', messageHandler)
      
      const result = await communicator.broadcastMessage(
        workflowId,
        'pm',
        { message: 'Important announcement to all agents' }
      )
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: expect.any(String),
        content: expect.objectContaining({
          message: 'Important announcement to all agents',
          broadcast: true
        })
      })
    })
  })

  describe('WebSocket Integration', () => {
    test('should broadcast workflow updates via WebSocket', async () => {
      const workflowId = 'test-websocket-workflow'
      const update = {
        status: 'RUNNING',
        progress: { percentage: 50, currentStep: 2 }
      }
      
      communicator.broadcastWorkflowUpdate(workflowId, update)
      
      expect(mockWebSocketServer.broadcastToWorkflow).toHaveBeenCalledWith(
        workflowId,
        expect.objectContaining({
          type: 'workflow_update',
          ...update
        })
      )
    })

    test('should broadcast agent updates via WebSocket', async () => {
      const workflowId = 'test-websocket-agent'
      const agentId = 'pm'
      const update = {
        status: 'active',
        message: 'PM is working on requirements'
      }
      
      communicator.broadcastAgentUpdate(agentId, workflowId, update)
      
      expect(mockWebSocketServer.broadcastToAgent).toHaveBeenCalledWith(
        agentId,
        expect.objectContaining({
          type: 'agent_update',
          agentId,
          workflowId,
          ...update
        })
      )
    })
  })

  describe('Workflow Subscription', () => {
    test('should subscribe to workflow events', async () => {
      const workflowId = 'test-subscription'
      const eventHandlers = {
        message: jest.fn(),
        'agent:activated': jest.fn(),
        'agent:completed': jest.fn(),
        'workflow:error': jest.fn()
      }
      
      communicator.subscribeToWorkflow(workflowId, eventHandlers)
      
      // Send messages and verify handlers are called
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: { action: 'start' },
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'completion',
        from: 'pm',
        to: 'architect',
        content: { output: 'Done' },
        workflowId
      })
      
      expect(eventHandlers.message).toHaveBeenCalledTimes(2)
      expect(eventHandlers['agent:activated']).toHaveBeenCalledTimes(1)
      expect(eventHandlers['agent:completed']).toHaveBeenCalledTimes(1)
    })
  })

  describe('Communication Statistics', () => {
    test('should provide communication statistics', async () => {
      const workflowId = 'test-stats'
      
      // Send various types of messages
      await communicator.sendMessage(workflowId, {
        type: 'activation',
        from: 'system',
        to: 'pm',
        content: 'Start',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'inter_agent',
        from: 'pm',
        to: 'architect',
        content: 'Question',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'error',
        from: 'developer',
        to: 'system',
        content: { error: 'Error occurred' },
        workflowId
      })
      
      const stats = communicator.getStatistics(workflowId)
      
      expect(stats).toMatchObject({
        totalMessages: 3,
        messagesByType: expect.objectContaining({
          activation: 1,
          inter_agent: 1,
          error: 1
        }),
        activeChannels: expect.any(Number),
        communicationFlow: expect.any(Object),
        timeline: expect.any(Array)
      })
    })
  })
})