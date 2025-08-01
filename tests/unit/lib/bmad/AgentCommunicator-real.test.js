/**
 * AgentCommunicator Unit Tests - Real API
 * 
 * Tests the actual AgentCommunicator class functionality:
 * - Message sending and validation
 * - Event emission and subscription
 * - Message history tracking
 * - Communication statistics
 * - Real message structure
 */

import { AgentCommunicator } from '../../../../lib/bmad/AgentCommunicator.js'
import { MessageType } from '../../../../lib/bmad/types.js'
import { EventEmitter } from 'events'

describe('AgentCommunicator - Real API', () => {
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
    
    communicator.webSocketServer = mockWebSocketServer
  })

  afterEach(() => {
    if (communicator) {
      communicator.removeAllListeners()
    }
  })

  describe('Initialization', () => {
    test('should initialize with correct state', () => {
      expect(communicator.messageHistory).toEqual(new Map())
      expect(communicator.activeChannels).toEqual(new Map())
      expect(communicator.messageHandlers).toBeInstanceOf(Map)
      expect(communicator.messageHandlers.size).toBeGreaterThan(0)
      expect(communicator instanceof EventEmitter).toBe(true)
    })

    test('should set up default message handlers', () => {
      // Check that message handlers map has entries
      expect(communicator.messageHandlers.size).toBeGreaterThan(0)
      expect(communicator.messageHandlers.has(MessageType.ACTIVATION)).toBe(true)
      expect(communicator.messageHandlers.has(MessageType.COMPLETION)).toBe(true)
      expect(communicator.messageHandlers.has(MessageType.ERROR)).toBe(true)
      expect(communicator.messageHandlers.has(MessageType.INTER_AGENT)).toBe(true)
    })
  })

  describe('Message Validation', () => {
    test('should validate required message fields', async () => {
      const workflowId = 'test-workflow-1'
      const invalidMessage = {
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
        // Missing required fields: from, to
      }

      await expect(
        communicator.sendMessage(workflowId, invalidMessage)
      ).rejects.toThrow('Message missing required field: from')
    })

    test('should validate message type', async () => {
      const workflowId = 'test-workflow-2'
      const invalidMessage = {
        from: 'system',
        to: 'pm',
        type: 'INVALID_TYPE',
        content: { action: 'start' }
      }

      await expect(
        communicator.sendMessage(workflowId, invalidMessage)
      ).rejects.toThrow('Invalid message type: INVALID_TYPE')
    })

    test('should accept valid message', async () => {
      const workflowId = 'test-workflow-3'
      const validMessage = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: 'Test context' }
      }

      const result = await communicator.sendMessage(workflowId, validMessage)
      
      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.workflowId).toBe(workflowId)
      expect(result.timestamp).toBeDefined()
      expect(result.status).toBe('sent')
    })
  })

  describe('Message Sending', () => {
    test('should send activation message successfully', async () => {
      const workflowId = 'test-workflow-activation'
      const message = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: { userPrompt: 'Build an app' } }
      }

      const result = await communicator.sendMessage(workflowId, message)
      
      expect(result.id).toBeDefined()
      expect(result.workflowId).toBe(workflowId)
      expect(result.timestamp).toBeDefined()
      expect(result.status).toBe('sent')
      
      // Check message was stored in history
      const history = communicator.getMessageHistory(workflowId)
      expect(history.length).toBe(1)
      expect(history[0].type).toBe(MessageType.ACTIVATION)
      expect(history[0].from).toBe('system')
      expect(history[0].to).toBe('pm')
    })

    test('should send completion message successfully', async () => {
      const workflowId = 'test-workflow-completion'
      const message = {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: {
          output: 'PM work completed',
          artifacts: [{ name: 'prd.md', type: 'DOCUMENT' }]
        }
      }

      const result = await communicator.sendMessage(workflowId, message)
      
      expect(result.id).toBeDefined()
      
      const history = communicator.getMessageHistory(workflowId)
      expect(history[0].content.output).toBe('PM work completed')
      expect(history[0].content.artifacts).toHaveLength(1)
    })

    test('should generate unique message IDs', async () => {
      const workflowId = 'test-workflow-ids'
      const message1 = {
        from: 'pm',
        to: 'architect',
        type: MessageType.INTER_AGENT,
        content: 'Message 1'
      }
      const message2 = {
        from: 'architect',
        to: 'dev',
        type: MessageType.INTER_AGENT,
        content: 'Message 2'
      }

      const result1 = await communicator.sendMessage(workflowId, message1)
      const result2 = await communicator.sendMessage(workflowId, message2)
      
      expect(result1.id).not.toBe(result2.id)
      expect(result1.id).toMatch(/^msg_\d+_[a-z0-9]+$/)
      expect(result2.id).toMatch(/^msg_\d+_[a-z0-9]+$/)
    })
  })

  describe('Event Handling', () => {
    test('should handle activation messages and emit events', async () => {
      const activationHandler = jest.fn()
      communicator.on('agent:activated', activationHandler)
      
      const workflowId = 'test-workflow-activation-event'
      const message = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: { userPrompt: 'Test' } }
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(activationHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        context: { userPrompt: 'Test' }
      })
      
      // Check active channel was created
      const channels = communicator.getActiveChannels(workflowId)
      expect(channels).toHaveLength(1)
      expect(channels[0].agentId).toBe('pm')
      expect(channels[0].status).toBe('active')
    })

    test('should handle completion messages and update channels', async () => {
      const completionHandler = jest.fn()
      communicator.on('agent:completed', completionHandler)
      
      const workflowId = 'test-workflow-completion-event'
      
      // First activate the agent
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: {} }
      })
      
      // Then complete the agent
      const completionMessage = {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'Work completed', artifacts: [] }
      }

      await communicator.sendMessage(workflowId, completionMessage)
      
      expect(completionHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        result: { output: 'Work completed', artifacts: [] }
      })
      
      // Check channel status was updated
      const channels = communicator.getActiveChannels(workflowId)
      const pmChannel = channels.find(c => c.agentId === 'pm')
      expect(pmChannel.status).toBe('completed')
      expect(pmChannel.result).toEqual({ output: 'Work completed', artifacts: [] })
    })

    test('should handle error messages', async () => {
      const errorHandler = jest.fn()
      communicator.on('workflow:error', errorHandler)
      
      const workflowId = 'test-workflow-error'
      const message = {
        from: 'dev',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Compilation failed', details: 'Syntax error in line 42' }
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(errorHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'dev',
        error: { error: 'Compilation failed', details: 'Syntax error in line 42' }
      })
    })

    test('should handle inter-agent messages', async () => {
      const interAgentHandler = jest.fn()
      communicator.on('agent:communication', interAgentHandler)
      
      const workflowId = 'test-workflow-inter'
      const message = {
        from: 'pm',
        to: 'architect',
        type: MessageType.INTER_AGENT,
        content: 'Please review the requirements document'
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(interAgentHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'architect',
        content: 'Please review the requirements document'
      })
    })
  })

  describe('Message History', () => {
    test('should track message history per workflow', async () => {
      const workflowId1 = 'workflow-1'
      const workflowId2 = 'workflow-2'
      
      await communicator.sendMessage(workflowId1, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      })
      
      await communicator.sendMessage(workflowId2, {
        from: 'system',
        to: 'architect',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      })
      
      const history1 = communicator.getMessageHistory(workflowId1)
      const history2 = communicator.getMessageHistory(workflowId2)
      
      expect(history1.length).toBe(1)
      expect(history2.length).toBe(1)
      expect(history1[0].to).toBe('pm')
      expect(history2[0].to).toBe('architect')
    })

    test('should filter message history by type', async () => {
      const workflowId = 'test-workflow-filter'
      
      // Send different types of messages
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      })
      
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'PM completed' }
      })
      
      await communicator.sendMessage(workflowId, {
        from: 'architect',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Error occurred' }
      })
      
      const allMessages = communicator.getMessageHistory(workflowId)
      const activationMessages = communicator.getMessageHistory(workflowId, { type: MessageType.ACTIVATION })
      const errorMessages = communicator.getMessageHistory(workflowId, { type: MessageType.ERROR })
      
      expect(allMessages.length).toBe(3)
      expect(activationMessages.length).toBe(1)
      expect(errorMessages.length).toBe(1)
      expect(activationMessages[0].type).toBe(MessageType.ACTIVATION)
      expect(errorMessages[0].type).toBe(MessageType.ERROR)
    })

    test('should filter message history by agent', async () => {
      const workflowId = 'test-workflow-agent-filter'
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      })
      
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'Done' }
      })
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'architect',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      })
      
      const pmMessages = communicator.getMessageHistory(workflowId, { agentId: 'pm' })
      const architectMessages = communicator.getMessageHistory(workflowId, { agentId: 'architect' })
      
      expect(pmMessages.length).toBe(2) // to pm + from pm
      expect(architectMessages.length).toBe(2) // from pm to architect + to architect from system
    })

    test('should limit message history results', async () => {
      const workflowId = 'test-workflow-limit'
      
      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        await communicator.sendMessage(workflowId, {
          from: 'pm',
          to: 'architect',
          type: MessageType.INTER_AGENT,
          content: `Message ${i}`
        })
      }
      
      const allMessages = communicator.getMessageHistory(workflowId)
      const limitedMessages = communicator.getMessageHistory(workflowId, { limit: 3 })
      
      expect(allMessages.length).toBe(5)
      expect(limitedMessages.length).toBe(3)
      
      // Should return most recent messages (last 3)
      expect(limitedMessages[0].content).toBe('Message 2')
      expect(limitedMessages[2].content).toBe('Message 4')
    })
  })

  describe('Active Channels', () => {
    test('should track active channels', async () => {
      const workflowId = 'test-workflow-channels'
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: { userPrompt: 'Test' } }
      })
      
      const activeChannels = communicator.getActiveChannels(workflowId)
      expect(activeChannels).toHaveLength(1)
      expect(activeChannels[0]).toMatchObject({
        workflowId,
        agentId: 'pm',
        status: 'active'
      })
      expect(activeChannels[0].startTime).toBeDefined()
      expect(activeChannels[0].context).toEqual({ userPrompt: 'Test' })
    })

    test('should update channel status on completion', async () => {
      const workflowId = 'test-workflow-channel-completion'
      
      // Activate agent
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: {} }
      })
      
      // Complete agent
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'PM completed', artifacts: [] }
      })
      
      const activeChannels = communicator.getActiveChannels(workflowId)
      const pmChannel = activeChannels.find(c => c.agentId === 'pm')
      
      expect(pmChannel.status).toBe('completed')
      expect(pmChannel.endTime).toBeDefined()
      expect(pmChannel.result).toEqual({ output: 'PM completed', artifacts: [] })
    })

    test('should update channel status on error', async () => {
      const workflowId = 'test-workflow-channel-error'
      
      // Activate agent
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'dev',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: {} }
      })
      
      // Send error from agent
      await communicator.sendMessage(workflowId, {
        from: 'dev',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Build failed', code: 'COMPILE_ERROR' }
      })
      
      const activeChannels = communicator.getActiveChannels(workflowId)
      const devChannel = activeChannels.find(c => c.agentId === 'dev')
      
      expect(devChannel.status).toBe('error')
      expect(devChannel.endTime).toBeDefined()
      expect(devChannel.error).toEqual({ error: 'Build failed', code: 'COMPILE_ERROR' })
    })
  })

  describe('Event Emission', () => {
    test('should emit message events', async () => {
      const messageHandler = jest.fn()
      const workflowMessageHandler = jest.fn()
      const typeMessageHandler = jest.fn()
      
      communicator.on('message', messageHandler)
      
      const workflowId = 'test-workflow-events'
      communicator.on(`message:${workflowId}`, workflowMessageHandler)
      communicator.on(`message:${MessageType.ACTIVATION}`, typeMessageHandler)
      
      const message = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      }

      await communicator.sendMessage(workflowId, message)
      
      expect(messageHandler).toHaveBeenCalledWith(expect.objectContaining({
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        workflowId
      }))
      
      expect(workflowMessageHandler).toHaveBeenCalledWith(expect.objectContaining({
        workflowId
      }))
      
      expect(typeMessageHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.ACTIVATION
      }))
    })
  })

  describe('Cleanup', () => {
    test('should provide cleanup method', () => {
      expect(typeof communicator.cleanup).toBe('function')
    })
  })
})