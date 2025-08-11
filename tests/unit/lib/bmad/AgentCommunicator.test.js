/**
 * AgentCommunicator Unit Tests
 * 
 * Tests the AgentCommunicator class functionality:
 * - Message sending and validation
 * - Event emission and subscription
 * - Message history tracking
 * - Communication statistics
 * - WebSocket integration
 */

import { AgentCommunicator } from '../../../../lib/bmad/AgentCommunicator.js';
import { MessageType } from '../../../../lib/bmad/types.js';
import { EventEmitter } from 'events';

describe('AgentCommunicator', () => {
  let communicator;
  let mockWebSocketServer;

  beforeEach(() => {
    communicator = new AgentCommunicator();
    
    // Mock WebSocket server
    mockWebSocketServer = new EventEmitter();
    mockWebSocketServer.broadcast = jest.fn();
    mockWebSocketServer.broadcastToWorkflow = jest.fn();
    mockWebSocketServer.broadcastToAgent = jest.fn();
    mockWebSocketServer.emit = jest.fn();
    
    communicator.webSocketServer = mockWebSocketServer; // Assign mock to the communicator
  });

  afterEach(() => {
    if (communicator) {
      communicator.removeAllListeners();
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct state', () => {
      expect(communicator.messageHistory).toEqual(new Map());
      expect(communicator.activeChannels).toEqual(new Map());
      expect(communicator.messageHandlers).toBeInstanceOf(Map);
      expect(communicator.messageHandlers.size).toBeGreaterThan(0);
      expect(communicator instanceof EventEmitter).toBe(true);
    });

    test('should set up default message handlers', () => {
      expect(communicator.messageHandlers.size).toBeGreaterThan(0);
      expect(communicator.messageHandlers.has(MessageType.ACTIVATION)).toBe(true);
      expect(communicator.messageHandlers.has(MessageType.COMPLETION)).toBe(true);
      expect(communicator.messageHandlers.has(MessageType.ERROR)).toBe(true);
      expect(communicator.messageHandlers.has(MessageType.INTER_AGENT)).toBe(true);
    });
  });

  describe('Message Validation', () => {
    test('should validate required message fields', async () => {
      const workflowId = 'test-workflow-1';
      const invalidMessage = {
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
        // Missing required fields: from, to
      };

      await expect(
        communicator.sendMessage(workflowId, invalidMessage)
      ).rejects.toThrow('Message missing required field: from');
    });

    test('should validate message type', async () => {
      const workflowId = 'test-workflow-2';
      const invalidMessage = {
        from: 'system',
        to: 'pm',
        type: 'INVALID_TYPE',
        content: { action: 'start' }
      };

      await expect(
        communicator.sendMessage(workflowId, invalidMessage)
      ).rejects.toThrow('Invalid message type: INVALID_TYPE');
    });

    test('should accept valid message', async () => {
      const workflowId = 'test-workflow-3';
      const validMessage = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: 'Test context' }
      };

      const result = await communicator.sendMessage(workflowId, validMessage);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.workflowId).toBe(workflowId);
      expect(result.timestamp).toBeDefined();
      expect(result.status).toBe('sent');
    });
  });

  describe('Message Sending', () => {
    test('should send activation message successfully', async () => {
      const workflowId = 'test-workflow-activation';
      const message = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: { userPrompt: 'Build an app' } }
      };

      const result = await communicator.sendMessage(workflowId, message);
      
      expect(result.id).toBeDefined();
      expect(result.workflowId).toBe(workflowId);
      expect(result.timestamp).toBeDefined();
      expect(result.status).toBe('sent');
      
      const history = communicator.getMessageHistory(workflowId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(MessageType.ACTIVATION);
      expect(history[0].from).toBe('system');
      expect(history[0].to).toBe('pm');
    });

    test('should send completion message successfully', async () => {
      const workflowId = 'test-workflow-completion';
      const message = {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: {
          output: 'PM work completed',
          artifacts: [{ name: 'prd.md', type: 'DOCUMENT' }]
        }
      };

      const result = await communicator.sendMessage(workflowId, message);
      
      expect(result.id).toBeDefined();
      
      const history = communicator.getMessageHistory(workflowId);
      expect(history[0].content.output).toBe('PM work completed');
      expect(history[0].content.artifacts).toHaveLength(1);
    });

    test('should generate unique message IDs', async () => {
      const workflowId = 'test-workflow-ids';
      const message1 = {
        from: 'pm',
        to: 'architect',
        type: MessageType.INTER_AGENT,
        content: 'Message 1'
      };
      const message2 = {
        from: 'architect',
        to: 'dev',
        type: MessageType.INTER_AGENT,
        content: 'Message 2'
      };

      const result1 = await communicator.sendMessage(workflowId, message1);
      const result2 = await communicator.sendMessage(workflowId, message2);
      
      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(result2.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
    });
  });

  describe('Event Handling', () => {
    test('should handle activation messages and emit events', async () => {
      const activationHandler = jest.fn();
      communicator.on('agent:activated', activationHandler);
      
      const workflowId = 'test-workflow-activation-event';
      const message = {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: { userPrompt: 'Test' } }
      };

      await communicator.sendMessage(workflowId, message);
      
      expect(activationHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        context: { userPrompt: 'Test' }
      });
      
      const channels = communicator.getActiveChannels(workflowId);
      expect(channels).toHaveLength(1);
      expect(channels[0].agentId).toBe('pm');
      expect(channels[0].status).toBe('active');
    });

    test('should handle completion messages and update channels', async () => {
      const completionHandler = jest.fn();
      communicator.on('agent:completed', completionHandler);
      
      const workflowId = 'test-workflow-completion-event';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: {} }
      });
      
      const completionMessage = {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: {
          output: 'Work completed',
          artifacts: []
        }
      };

      await communicator.sendMessage(workflowId, completionMessage);
      
      expect(completionHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'pm',
        result: { output: 'Work completed', artifacts: [] }
      });
      
      const channels = communicator.getActiveChannels(workflowId);
      const pmChannel = channels.find(c => c.agentId === 'pm');
      expect(pmChannel.status).toBe('completed');
      expect(pmChannel.result).toEqual({ output: 'Work completed', artifacts: [] });
    });

    test('should handle error messages', async () => {
      const errorHandler = jest.fn();
      communicator.on('workflow:error', errorHandler);
      
      const workflowId = 'test-workflow-error';
      const message = {
        from: 'dev',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Compilation failed', details: 'Syntax error in line 42' }
      };

      await communicator.sendMessage(workflowId, message);
      
      expect(errorHandler).toHaveBeenCalledWith({
        workflowId,
        agentId: 'dev',
        error: { error: 'Compilation failed', details: 'Syntax error in line 42' }
      });
    });

    test('should handle inter-agent messages', async () => {
      const interAgentHandler = jest.fn();
      communicator.on('agent:communication', interAgentHandler);
      
      const workflowId = 'test-workflow-inter';
      const message = {
        from: 'pm',
        to: 'architect',
        type: MessageType.INTER_AGENT,
        content: 'Please review the requirements document'
      };

      await communicator.sendMessage(workflowId, message);
      
      expect(interAgentHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'architect',
        content: 'Please review the requirements document'
      });
    });
  });

  describe('Message History', () => {
    test('should track message history per workflow', async () => {
      const workflowId1 = 'workflow-1';
      const workflowId2 = 'workflow-2';
      
      await communicator.sendMessage(workflowId1, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      });
      
      await communicator.sendMessage(workflowId2, {
        from: 'system',
        to: 'architect',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      });
      
      const history1 = communicator.getMessageHistory(workflowId1);
      const history2 = communicator.getMessageHistory(workflowId2);
      
      expect(history1.length).toBe(1);
      expect(history2.length).toBe(1);
      expect(history1[0].to).toBe('pm');
      expect(history2[0].to).toBe('architect');
    });

    test('should filter message history by type', async () => {
      const workflowId = 'test-workflow-filter';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'PM completed' }
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'architect',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Error occurred' }
      });
      
      const allMessages = communicator.getMessageHistory(workflowId);
      const activationMessages = communicator.getMessageHistory(workflowId, { type: MessageType.ACTIVATION });
      const errorMessages = communicator.getMessageHistory(workflowId, { type: MessageType.ERROR });
      
      expect(allMessages.length).toBe(3);
      expect(activationMessages.length).toBe(1);
      expect(errorMessages.length).toBe(1);
      expect(activationMessages[0].type).toBe(MessageType.ACTIVATION);
      expect(errorMessages[0].type).toBe(MessageType.ERROR);
    });

    test('should filter message history by agent', async () => {
      const workflowId = 'test-workflow-agent-filter';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'Done' }
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'architect',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      });
      
      const pmMessages = communicator.getMessageHistory(workflowId, { agentId: 'pm' });
      const architectMessages = communicator.getMessageHistory(workflowId, { agentId: 'architect' });
      
      expect(pmMessages.length).toBe(2);
      expect(architectMessages.length).toBe(2);
    });

    test('should limit message history results', async () => {
      const workflowId = 'test-workflow-limit';
      
      for (let i = 0; i < 5; i++) {
        await communicator.sendMessage(workflowId, {
          from: 'pm',
          to: 'architect',
          type: MessageType.INTER_AGENT,
          content: `Message ${i}`
        });
      }
      
      const allMessages = communicator.getMessageHistory(workflowId);
      const limitedMessages = communicator.getMessageHistory(workflowId, { limit: 3 });
      
      expect(allMessages.length).toBe(5);
      expect(limitedMessages.length).toBe(3);
      
      expect(limitedMessages[0].content).toBe('Message 2');
      expect(limitedMessages[2].content).toBe('Message 4');
    });
  });

  describe('Active Channels', () => {
    test('should track active channels', async () => {
      const workflowId = 'test-workflow-channels';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: { userPrompt: 'Test' } }
      });
      
      const activeChannels = communicator.getActiveChannels(workflowId);
      expect(activeChannels).toHaveLength(1);
      expect(activeChannels[0]).toMatchObject({
        workflowId,
        agentId: 'pm',
        status: 'active'
      });
      expect(activeChannels[0].startTime).toBeDefined();
      expect(activeChannels[0].context).toEqual({ userPrompt: 'Test' });
    });

    test('should update channel status on completion', async () => {
      const workflowId = 'test-workflow-channel-completion';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: {} }
      });
      
      const completionMessage = {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: {
          output: 'Work completed',
          artifacts: []
        }
      };

      await communicator.sendMessage(workflowId, completionMessage);
      
      const activeChannels = communicator.getActiveChannels(workflowId);
      const pmChannel = activeChannels.find(c => c.agentId === 'pm');
      expect(pmChannel.status).toBe('completed');
      expect(pmChannel.endTime).toBeDefined();
      expect(pmChannel.result).toEqual({ output: 'Work completed', artifacts: [] });
    });

    test('should update channel status on error', async () => {
      const workflowId = 'test-workflow-channel-error';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'dev',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: {} }
      });
      
      const message = {
        from: 'dev',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Build failed', code: 'COMPILE_ERROR' }
      };

      await communicator.sendMessage(workflowId, message);
      
      const activeChannels = communicator.getActiveChannels(workflowId);
      const devChannel = activeChannels.find(c => c.agentId === 'dev');
      
      expect(devChannel.status).toBe('error');
      expect(devChannel.endTime).toBeDefined();
      expect(devChannel.error).toEqual({ error: 'Build failed', code: 'COMPILE_ERROR' });
    });
  });

  describe('Communication Timeline', () => {
    test('should generate communication timeline', () => {
      const workflowId = 'test-workflow-timeline';
      
      communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: 'Start PM' }
      });
      
      communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'PM done' }
      });
      
      communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'architect',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: 'Start Architect' }
      });
      
      const timeline = communicator.getCommunicationTimeline(workflowId);
      
      expect(timeline).toBeDefined();
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline).toHaveLength(3);
      
      timeline.forEach(entry => {
        expect(entry.id).toBeDefined();
        expect(entry.timestamp).toBeDefined();
        expect(entry.from).toBeDefined();
        expect(entry.to).toBeDefined();
        expect(entry.type).toBeDefined();
      });
    });
  });

  describe('Inter-Agent Communication', () => {
    test('should send inter-agent messages', async () => {
      const workflowId = 'test-inter-agent';
      const messageHandler = jest.fn();
      
      communicator.on('agent:communication', messageHandler);
      
      const result = await communicator.sendInterAgentMessage(
        workflowId,
        'pm',
        'architect',
        { message: 'Please review the technical requirements' }
      );
      
      expect(result.id).toBeDefined();
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'architect',
        content: expect.objectContaining({
          message: 'Please review the technical requirements'
        })
      });
    });

    test('should broadcast messages to all agents', async () => {
      const workflowId = 'test-broadcast';
      const messageHandler = jest.fn();
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'architect',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: 'Setup' }
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'developer',
        type: MessageType.ACTIVATION,
        content: { action: 'start', context: 'Setup' }
      });
      
      communicator.on('agent:communication', messageHandler);
      
      const result = await communicator.broadcastMessage(
        workflowId,
        'pm',
        { message: 'Important announcement to all agents' }
      );
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2); // Should broadcast to architect and developer
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'architect',
        content: expect.objectContaining({
          message: 'Important announcement to all agents',
          broadcast: true
        })
      });
      expect(messageHandler).toHaveBeenCalledWith({
        workflowId,
        from: 'pm',
        to: 'developer',
        content: expect.objectContaining({
          message: 'Important announcement to all agents',
          broadcast: true
        })
      });
    });
  });

  describe('WebSocket Integration', () => {
    test('should broadcast workflow updates via WebSocket', async () => {
      const workflowId = 'test-websocket-workflow';
      const update = {
        status: 'RUNNING',
        progress: { percentage: 50, currentStep: 2 }
      };
      
      communicator.broadcastWorkflowUpdate(workflowId, update);
      
      expect(mockWebSocketServer.broadcastToWorkflow).toHaveBeenCalledWith(
        workflowId,
        expect.objectContaining({
          type: 'workflow_update',
          ...update
        })
      );
    });

    test('should broadcast agent updates via WebSocket', async () => {
      const workflowId = 'test-websocket-agent';
      const agentId = 'pm';
      const update = {
        status: 'active',
        message: 'PM is working on requirements'
      };
      
      communicator.broadcastAgentUpdate(agentId, workflowId, update);
      
      expect(mockWebSocketServer.broadcastToAgent).toHaveBeenCalledWith(
        agentId,
        expect.objectContaining({
          type: 'agent_update',
          agentId,
          workflowId,
          ...update
        })
      );
    });
  });

  describe('Workflow Subscription', () => {
    test('should subscribe to workflow events', async () => {
      const workflowId = 'test-subscription';
      const eventHandlers = {
        message: jest.fn(),
        'agent:activated': jest.fn(),
        'agent:completed': jest.fn(),
        'workflow:error': jest.fn()
      };
      
      communicator.subscribeToWorkflow(workflowId, eventHandlers);
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: { action: 'start' }
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.COMPLETION,
        content: { output: 'Done' }
      });
      
      expect(eventHandlers.message).toHaveBeenCalledTimes(2);
      expect(eventHandlers['agent:activated']).toHaveBeenCalledTimes(1);
      expect(eventHandlers['agent:completed']).toHaveBeenCalledTimes(1);
    });
  });

  describe('Communication Statistics', () => {
    test('should provide communication statistics', async () => {
      const workflowId = 'test-stats';
      
      await communicator.sendMessage(workflowId, {
        from: 'system',
        to: 'pm',
        type: MessageType.ACTIVATION,
        content: 'Start'
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'pm',
        to: 'architect',
        type: MessageType.INTER_AGENT,
        content: 'Question'
      });
      
      await communicator.sendMessage(workflowId, {
        from: 'developer',
        to: 'system',
        type: MessageType.ERROR,
        content: { error: 'Error occurred' }
      });
      
      const stats = communicator.getStatistics(workflowId);
      
      expect(stats).toMatchObject({
        totalMessages: 3,
        messagesByType: expect.objectContaining({
          [MessageType.ACTIVATION]: 1,
          [MessageType.INTER_AGENT]: 1,
          [MessageType.ERROR]: 1
        }),
        activeChannels: expect.any(Number),
        communicationFlow: expect.any(Object),
        timeline: expect.any(Array)
      });
    });
  });

  describe('Cleanup', () => {
    test('should provide cleanup method', () => {
      expect(typeof communicator.cleanup).toBe('function');
    });
  });
});
