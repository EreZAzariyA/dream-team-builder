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

import { AgentCommunicator } from '../../../../lib/bmad/AgentCommunicator.js'
import { EventEmitter } from 'events'

describe('AgentCommunicator', () => {
  let communicator
  let mockWebSocketServer

  beforeEach(() => {
    communicator = new AgentCommunicator()
    
    // Mock WebSocket server
    mockWebSocketServer = new EventEmitter()
    mockWebSocketServer.broadcast = jest.fn()
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
      expect(communicator.listenerCount('message')).toBeGreaterThan(0)
      expect(communicator.listenerCount('activation')).toBeGreaterThan(0)
      expect(communicator.listenerCount('completion')).toBeGreaterThan(0)
      expect(communicator.listenerCount('error')).toBeGreaterThan(0)
    })
  })

  describe('Message Sending', () => {
    test('should send activation message successfully', async () => {
      const workflowId = 'test-workflow-1'
      const message = {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: { action: 'start', context: 'Test context' },
        workflowId
      }

      const result = await communicator.sendMessage(workflowId, message)
      
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(result.timestamp).toBeDefined()
      
      // Check message was stored in history
      const history = communicator.getMessageHistory(workflowId)
      expect(history.length).toBe(1)
      expect(history[0].type).toBe('ACTIVATION')
    })

    test('should send completion message successfully', async () => {
      const workflowId = 'test-workflow-2'
      const message = {
        type: 'COMPLETION',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: {
          output: 'PM work completed',
          artifacts: [{ name: 'prd.md', type: 'DOCUMENT' }]
        },
        workflowId
      }

      const result = await communicator.sendMessage(workflowId, message)
      
      expect(result.success).toBe(true)
      
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
      ).rejects.toThrow('Invalid message structure')
    })

    test('should generate unique message IDs', async () => {
      const workflowId = 'test-workflow-4'
      const message1 = {
        type: 'INTER_AGENT',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: 'Message 1',
        workflowId
      }
      const message2 = {
        type: 'INTER_AGENT', 
        fromAgent: 'architect',
        toAgent: 'developer',
        content: 'Message 2',
        workflowId
      }

      const result1 = await communicator.sendMessage(workflowId, message1)
      const result2 = await communicator.sendMessage(workflowId, message2)
      
      expect(result1.messageId).not.toBe(result2.messageId)
    })

    test('should handle message sending with priority', async () => {
      const workflowId = 'test-workflow-priority'
      const highPriorityMessage = {
        type: 'ERROR',
        fromAgent: 'developer',
        content: { error: 'Critical error occurred' },
        priority: 'high',
        workflowId
      }

      const result = await communicator.sendMessage(workflowId, highPriorityMessage)
      
      expect(result.success).toBe(true)
      
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
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: { action: 'start' },
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(activationHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        message: expect.objectContaining({
          type: 'ACTIVATION',
          fromAgent: 'system'
        })
      })
    })

    test('should handle completion messages', async () => {
      const completionHandler = jest.fn()
      communicator.on('agent:completed', completionHandler)
      
      const workflowId = 'test-workflow-completion'
      const message = {
        type: 'COMPLETION',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: { output: 'Work completed' },
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(completionHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        message: expect.objectContaining({
          type: 'COMPLETION',
          fromAgent: 'pm'
        })
      })
    })

    test('should handle error messages', async () => {
      const errorHandler = jest.fn()
      communicator.on('agent:error', errorHandler)
      
      const workflowId = 'test-workflow-error'
      const message = {
        type: 'ERROR',
        fromAgent: 'developer',
        content: { error: 'Compilation failed' },
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(errorHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'developer',
        message: expect.objectContaining({
          type: 'ERROR',
          content: { error: 'Compilation failed' }
        })
      })
    })

    test('should handle inter-agent messages', async () => {
      const interAgentHandler = jest.fn()
      communicator.on('inter-agent:message', interAgentHandler)
      
      const workflowId = 'test-workflow-inter'
      const message = {
        type: 'INTER_AGENT',
        fromAgent: 'pm', 
        toAgent: 'architect',
        content: 'Please review the requirements',
        workflowId
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(interAgentHandler).toHaveBeenCalledWith({
        workflowId,
        fromAgent: 'pm',
        toAgent: 'architect',
        message: expect.objectContaining({
          type: 'INTER_AGENT'
        })
      })
    })
  })

  describe('Message History', () => {
    test('should track message history per workflow', async () => {
      const workflowId1 = 'workflow-1'
      const workflowId2 = 'workflow-2'
      
      await communicator.sendMessage(workflowId1, {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: 'Start workflow 1',
        workflowId: workflowId1
      })
      
      await communicator.sendMessage(workflowId2, {
        type: 'ACTIVATION',
        fromAgent: 'system', 
        toAgent: 'architect',
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
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: 'Activate PM',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'COMPLETION',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: 'PM completed',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'ERROR',
        fromAgent: 'architect',
        content: 'Error occurred',
        workflowId
      })
      
      const allMessages = communicator.getMessageHistory(workflowId)
      const activationMessages = communicator.getMessageHistory(workflowId, { type: 'ACTIVATION' })
      const errorMessages = communicator.getMessageHistory(workflowId, { type: 'ERROR' })
      
      expect(allMessages.length).toBe(3)
      expect(activationMessages.length).toBe(1)
      expect(errorMessages.length).toBe(1)
      expect(activationMessages[0].type).toBe('ACTIVATION')
      expect(errorMessages[0].type).toBe('ERROR')
    })

    test('should limit message history results', async () => {
      const workflowId = 'test-workflow-limit'
      
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await communicator.sendMessage(workflowId, {
          type: 'INTER_AGENT',
          fromAgent: 'pm',
          toAgent: 'architect',
          content: `Message ${i}`,
          workflowId
        })
      }
      
      const allMessages = communicator.getMessageHistory(workflowId)
      const limitedMessages = communicator.getMessageHistory(workflowId, { limit: 3 })
      
      expect(allMessages.length).toBe(5)
      expect(limitedMessages.length).toBe(3)
      
      // Should return most recent messages
      expect(limitedMessages[0].content).toBe('Message 4')
      expect(limitedMessages[2].content).toBe('Message 2')
    })
  })

  describe('Active Channels', () => {
    test('should track active channels', async () => {
      const workflowId = 'test-workflow-channels'
      
      await communicator.sendMessage(workflowId, {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
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
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: 'Activate PM',
        workflowId
      })
      
      // Complete agent
      await communicator.sendMessage(workflowId, {
        type: 'COMPLETION',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: 'PM completed',
        workflowId
      })
      
      const activeChannels = communicator.getActiveChannels(workflowId)
      const pmChannel = activeChannels.find(c => c.agentId === 'pm')
      
      expect(pmChannel.status).toBe('completed')
    })
  })

  describe('Communication Timeline', () => {
    test('should generate communication timeline', async () => {
      const workflowId = 'test-workflow-timeline'
      
      // Send sequence of messages
      await communicator.sendMessage(workflowId, {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: 'Start PM',
        workflowId
      })
      
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      
      await communicator.sendMessage(workflowId, {
        type: 'COMPLETION',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: 'PM done',
        workflowId
      })
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await communicator.sendMessage(workflowId, {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'architect',
        content: 'Start Architect',
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
      
      communicator.on('inter-agent:message', messageHandler)
      
      const result = await communicator.sendInterAgentMessage(
        workflowId,
        'pm',
        'architect',
        'Please review the technical requirements'
      )
      
      expect(result.success).toBe(true)
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        fromAgent: 'pm',
        toAgent: 'architect',
        message: expect.objectContaining({
          type: 'INTER_AGENT',
          content: 'Please review the technical requirements'
        })
      })
    })

    test('should broadcast messages to all agents', async () => {
      const workflowId = 'test-broadcast'
      const messageHandler = jest.fn()
      
      communicator.on('broadcast:message', messageHandler)
      
      const result = await communicator.broadcastMessage(
        workflowId,
        'pm',
        'Important announcement to all agents'
      )
      
      expect(result.success).toBe(true)
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        fromAgent: 'pm',
        message: expect.objectContaining({
          type: 'BROADCAST',
          content: 'Important announcement to all agents'
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
      
      expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(
        `workflow-${workflowId}`,
        'workflow-update',
        expect.objectContaining(update)
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
      
      expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(
        `agent-${agentId}`,
        'agent-update',
        expect.objectContaining({
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
        onMessage: jest.fn(),
        onActivation: jest.fn(),
        onCompletion: jest.fn(),
        onError: jest.fn()
      }
      
      communicator.subscribeToWorkflow(workflowId, eventHandlers)
      
      // Send messages and verify handlers are called
      await communicator.sendMessage(workflowId, {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: 'Start',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'COMPLETION',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: 'Done',
        workflowId
      })
      
      expect(eventHandlers.onMessage).toHaveBeenCalledTimes(2)
      expect(eventHandlers.onActivation).toHaveBeenCalledTimes(1)
      expect(eventHandlers.onCompletion).toHaveBeenCalledTimes(1)
    })
  })

  describe('Communication Statistics', () => {
    test('should provide communication statistics', async () => {
      const workflowId = 'test-stats'
      
      // Send various types of messages
      await communicator.sendMessage(workflowId, {
        type: 'ACTIVATION',
        fromAgent: 'system',
        toAgent: 'pm',
        content: 'Start',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'INTER_AGENT',
        fromAgent: 'pm',
        toAgent: 'architect',
        content: 'Question',
        workflowId
      })
      
      await communicator.sendMessage(workflowId, {
        type: 'ERROR',
        fromAgent: 'developer',
        content: 'Error occurred',
        workflowId
      })
      
      const stats = communicator.getStatistics(workflowId)
      
      expect(stats).toMatchObject({
        totalMessages: 3,
        messagesByType: expect.objectContaining({
          ACTIVATION: 1,
          INTER_AGENT: 1,
          ERROR: 1
        }),
        activeAgents: expect.any(Number),
        communicationStartTime: expect.any(Date),
        lastMessageTime: expect.any(Date)
      })
    })
  })
})