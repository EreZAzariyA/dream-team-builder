import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../../lib/utils/routeAuth.js';
import { getOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import { MessageType } from '../../../../../lib/bmad/types.js';
import logger from '../../../../../lib/utils/logger.js';

/**
 * Free Chat API for Live Workflow
 * Handles user messages that aren't elicitation responses
 * Allows users to communicate freely with workflow agents
 */

export async function POST(request, { params }) {
  const { workflowId } = await params;
  
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    const body = await request.json();
    const { message, targetAgent } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    logger.info(`💬 [FREE CHAT] User message in workflow ${workflowId}:`, {
      message: message.substring(0, 100),
      targetAgent,
      userId: session.user.id
    });

    // Get orchestrator
    const orchestrator = await getOrchestrator();
    
    // Get workflow status to determine current agent if no target specified
    const workflowStatus = await orchestrator.getWorkflowStatus(workflowId);
    const currentAgent = targetAgent || workflowStatus?.currentAgent || 'pm';

    // Send user message to the workflow
    const userMessage = {
      id: `user_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      from: 'user',
      fromName: session.user.name || session.user.email?.split('@')[0] || 'User',
      to: currentAgent,
      toName: currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1),
      content: message,
      timestamp: new Date().toISOString(),
      type: MessageType.USER_INPUT
    };

    // Add message to workflow communication
    if (orchestrator.messageService) {
      await orchestrator.messageService.addMessage(workflowId, userMessage);
    }

    // Send message through communicator for real-time updates
    await orchestrator.communicator.sendMessage(workflowId, userMessage);

    // Generate agent response using chat-style execution
    try {
      // Get the agent
      const agent = await orchestrator.agentLoader.loadAgent(currentAgent);
      if (!agent) {
        throw new Error(`Agent ${currentAgent} not found`);
      }

      // Create chat context for the agent
      const chatContext = {
        conversationId: workflowId,
        userPrompt: message,
        userId: session.user.id,
        userName: session.user.name || session.user.email?.split('@')[0] || 'User',
        mockMode: process.env.BMAD_MOCK_MODE === 'true',
        chatMode: true,
        workflowContext: {
          workflowId,
          currentStep: workflowStatus?.currentStep,
          totalSteps: workflowStatus?.sequence?.length,
          status: workflowStatus?.status
        }
      };

      // Execute agent in chat mode using ChatAgentExecutor if available
      let agentResponse;
      try {
        const { ChatAgentExecutor } = require('../../../../../lib/bmad/ChatAgentExecutor.js');
        const configManager = orchestrator.configurationManager;
        const chatExecutor = new ChatAgentExecutor(orchestrator.agentLoader, orchestrator.aiService, configManager);
        
        const result = await chatExecutor.executeChatAgent(agent, chatContext);
        agentResponse = result.content || 'I processed your message.';
        
        logger.info(`🤖 [FREE CHAT] Agent ${currentAgent} responded successfully`);
        
      } catch (chatError) {
        logger.warn('ChatAgentExecutor failed, using fallback:', chatError.message);
        // Fallback to simple response
        agentResponse = `Thank you for your message. As the ${currentAgent} agent, I'm currently working on the workflow. Is there something specific you'd like to know about the current progress?`;
      }

      // Create agent response message
      const responseMessage = {
        id: `agent_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        from: currentAgent,
        fromName: agent.agent?.name || currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1),
        to: 'user',
        toName: session.user.name || session.user.email?.split('@')[0] || 'User',
        content: agentResponse,
        timestamp: new Date().toISOString(),
        type: MessageType.INTER_AGENT,
        metadata: {
          responseTime: Date.now() - new Date(userMessage.timestamp).getTime(),
          chatMode: true
        }
      };

      // Add agent response to workflow
      if (orchestrator.messageService) {
        await orchestrator.messageService.addMessage(workflowId, responseMessage);
      }

      // Send agent response through communicator
      await orchestrator.communicator.sendMessage(workflowId, responseMessage);

      return NextResponse.json({
        success: true,
        userMessage,
        agentResponse: responseMessage,
        workflowId,
        currentAgent
      });

    } catch (agentError) {
      logger.error('Failed to generate agent response:', agentError);
      
      // Send error response to maintain conversation flow
      const errorMessage = {
        id: `error_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        from: currentAgent,
        fromName: currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1),
        to: 'user',
        toName: session.user.name || session.user.email?.split('@')[0] || 'User',
        content: "I apologize, but I encountered an issue processing your message. Could you please try again or rephrase your question?",
        timestamp: new Date().toISOString(),
        type: MessageType.INTER_AGENT,
        metadata: {
          error: true,
          originalError: agentError.message
        }
      };

      await orchestrator.communicator.sendMessage(workflowId, errorMessage);

      return NextResponse.json({
        success: true,
        userMessage,
        agentResponse: errorMessage,
        workflowId,
        currentAgent,
        warning: 'Agent response generated with fallback due to processing error'
      });
    }

  } catch (error) {
    logger.error(`Error handling free chat for workflow ${workflowId}:`, error);
    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: error.message,
        workflowId
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - API documentation
 */
export async function GET() {
  return NextResponse.json({
    name: 'Workflow Free Chat API',
    version: '1.0.0',
    description: 'Enables free conversation with agents during live workflow execution',
    
    endpoints: {
      POST: '/api/workflows/[workflowId]/chat'
    },
    
    usage: {
      description: 'Send messages to workflow agents for conversational interaction',
      body: {
        message: 'required - The user message text',
        targetAgent: 'optional - Specific agent to message (defaults to current workflow agent)'
      },
      response: 'User message and agent response with real-time updates'
    },

    features: [
      'Real-time agent responses',
      'Context-aware conversation',
      'Workflow status integration',
      'Message history tracking',
      'Fallback error handling'
    ]
  });
}