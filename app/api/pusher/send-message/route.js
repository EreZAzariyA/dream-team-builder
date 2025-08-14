/**
 * Pusher Message Sending API Route
 * Handles server-side message broadcasting via Pusher
 */

import { NextResponse } from 'next/server';
import { pusherServer, CHANNELS, EVENTS } from '../../../../lib/pusher/config';
import { getOrchestrator } from '../../../../lib/bmad/BmadOrchestrator.js';
import { AIService } from '../../../../lib/ai/AIService.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';
import AgentMessage from '../../../../lib/database/models/AgentMessage.js';
import { compose, withMethods, withAIRateLimit, withSecurityHeaders, withErrorHandling } from '../../../../lib/api/middleware.js';
import { WorkflowId } from '../../../../lib/utils/workflowId.js';
import logger from '@/lib/utils/logger.js';

/**
 * Load agent definition from file
 */
async function loadAgentDefinition(agentId) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const yaml = await import('js-yaml');
    
    const agentPath = path.join(process.cwd(), '.bmad-core', 'agents', `${agentId}.md`);
    const content = await fs.readFile(agentPath, 'utf-8');
    
    // Extract YAML block from markdown
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      return yaml.load(yamlContent);
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to load agent ${agentId}:`, error);
    return null;
  }
}

/**
 * Determine which agent should handle the message
 */
function determineTargetAgent(content) {
  const message = content.toLowerCase();
  
  // Agent-specific keywords
  const agentKeywords = {
    'pm': ['prd', 'product', 'requirements', 'roadmap', 'strategy', 'feature'],
    'dev': ['code', 'develop', 'implement', 'bug', 'programming', 'technical', 'javascript', 'function'],
    'architect': ['architecture', 'design', 'system', 'structure', 'technical design'],
    'qa': ['test', 'quality', 'bug', 'testing', 'qa', 'quality assurance'],
    'ux-expert': ['ux', 'ui', 'design', 'user experience', 'interface', 'usability'],
    'analyst': ['analysis', 'research', 'data', 'insights', 'investigate']
  };
  
  // Check for direct agent mentions
  for (const [agentId, keywords] of Object.entries(agentKeywords)) {
    const matchedKeyword = keywords.find(keyword => message.includes(keyword));
    if (matchedKeyword) {
      return agentId;
    }
  }
  
  // Default to PM for general project questions
  return 'pm';
}

/**
 * Process user message with BMAD agents using AI
 */
async function processUserMessageWithAgents(orchestrator, content, workflowId, targetAgentId = null, userId = null) {
  try {
    // Check if this is a workflow initiation request
    const isWorkflowTrigger = [
      'start workflow', 'bmad workflow', 'create project', 'build app',
      'develop application', 'design system', 'implement feature'
    ].some(trigger => content.toLowerCase().includes(trigger.toLowerCase()));

    if (isWorkflowTrigger) {
      // Start a new workflow
      const workflow = await orchestrator.startWorkflow(content, {
        workflowId: workflowId,
        metadata: { userMessage: content }
      });
      
      return {
        content: `🚀 I've started a new workflow for you! The BMAD agents are now working on: "${content}". You'll see real-time updates as they progress.`,
        agentId: 'bmad-orchestrator',
        workflowId: workflow.workflowId
      };
    } else {
      // Use specified target agent or determine from message content
      const finalTargetAgentId = targetAgentId || determineTargetAgent(content);
      
      // Load agent definition
      const agentDefinition = await loadAgentDefinition(finalTargetAgentId);
      
      if (agentDefinition) {
        try {
          // Generate AI response with agent persona using the correct method
          const aiService = AIService.getInstance();
          const aiResponse = await aiService.call(
            `Acting as ${agentDefinition.agent?.name || finalTargetAgentId} (${agentDefinition.agent?.title || 'Assistant'}): ${agentDefinition.persona?.identity || 'I am a helpful assistant'}.
            
User message: ${content}

Please respond in character as this agent, following the persona guidelines.`,
            agentDefinition.agent || { id: finalTargetAgentId, name: finalTargetAgentId },
            1, // complexity
            { persona: agentDefinition.persona, conversationHistory: [] },
            userId || 'anonymous'
          );
          
          return {
            content: aiResponse.content || aiResponse.message || 'Response generated successfully',
            agentId: agentDefinition.agent?.id || finalTargetAgentId,
            agentName: agentDefinition.agent?.name || finalTargetAgentId,
            provider: aiResponse.provider || 'ai-service',
            structured: aiResponse.structured || false
          };
        } catch (aiError) {
          logger.error('AI service error:', aiError);
          // Fallback with agent info when AI fails
          return {
            content: `Hello! I'm ${agentDefinition.agent?.name || finalTargetAgentId} (${agentDefinition.agent?.title || 'Assistant'}). I received your message: "${content}". 

I'm currently experiencing technical issues with my AI processing, but I'm here to help. Here's what I can tell you:
- I was correctly identified as the right agent for your request
- My role is: ${agentDefinition.agent?.title || 'General assistance'}
- Routing worked: "${content}" → ${finalTargetAgentId} agent

The issue is with the AI generation service. Please try again, or contact support if this persists.`,
            agentId: agentDefinition.agent?.id || finalTargetAgentId,
            agentName: agentDefinition.agent?.name || finalTargetAgentId,
            provider: 'fallback-detailed'
          };
        }
      } else {
        // Fallback if agent definition not found
        return {
          content: `Hello! I'm here to help with: "${content}". I'm connecting you with our ${finalTargetAgentId.toUpperCase()} agent who specializes in this area.`,
          agentId: finalTargetAgentId
        };
      }
    }
  } catch (error) {
    logger.error('Error processing user message:', error);
    return {
      content: `I encountered an issue processing your message: "${content}". Please try again or rephrase your request.`,
      agentId: 'bmad-system'
    };
  }
}

/**
 * Save message to database for persistence
 */
async function saveMessageToDatabase(messageData, messageType = 'response', fromAgent = 'user', toAgent = null) {
  try {
    await connectMongoose();
    
    // For now, we'll skip the workflowId ObjectId requirement
    // since our workflow IDs are strings, not MongoDB ObjectIds
    // In a future version, we could look up the actual Workflow document
    
    const agentMessage = new AgentMessage({
      messageId: messageData.id,
      fromAgent: fromAgent,
      toAgent: toAgent,
      messageType: messageType,
      content: {
        text: messageData.content,
        data: {
          timestamp: messageData.timestamp,
          userId: messageData.userId,
          target: messageData.target,
          structured: messageData.structured,
          agentName: messageData.agentName,
          provider: messageData.provider
        }
      },
      priority: 'medium',
      category: 'workflow',
      timestamp: new Date(messageData.timestamp || Date.now()),
      status: 'delivered',
      metadata: {
        conversationId: `conversation-${messageData.target?.id || 'default'}`,
        correlationId: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        context: {
          messageType: messageType,
          channel: messageData.target?.type,
          workflowId: messageData.target?.id
        }
      }
      // Note: Skipping workflowId for now since we need proper MongoDB ObjectId
    });
    
    await agentMessage.save();
    logger.info(`💾 Message saved to database: ${messageData.id}`);
    return agentMessage;
  } catch (error) {
    logger.error('Failed to save message to database:', error);
    // Don't throw - we don't want to break the real-time functionality
    return null;
  }
}

async function handler(request) {
  try {
    const { content, target, userId, timestamp } = await request.json();

    if (!content || !target) {
      return NextResponse.json(
        { error: 'Content and target are required' },
        { status: 400 }
      );
    }
    
    // Validate workflow ID if target is workflow
    if (target.type === 'workflow' && !WorkflowId.validate(target.id)) {
      return NextResponse.json(
        { error: 'Invalid workflow ID format' },
        { status: 400 }
      );
    }

    // Determine channel and event based on target with standardized naming
    let channelName;
    let eventName;
    
    if (target.type === 'workflow') {
      channelName = WorkflowId.toChannelName(target.id) || CHANNELS.WORKFLOW(target.id);
      eventName = EVENTS.USER_MESSAGE;
    } else if (target.type === 'agent') {
      channelName = CHANNELS.AGENT(target.id);
      eventName = EVENTS.USER_MESSAGE;
    } else if (target.type === 'channel') {
      channelName = `channel-${target.id}`;
      eventName = 'user-message';
    } else {
      channelName = CHANNELS.GLOBAL;
      eventName = EVENTS.USER_MESSAGE;
    }

    // Prepare message data with standardized ID
    const messageData = {
      id: WorkflowId.generate(), // Use standardized ID generation
      content,
      userId,
      timestamp: timestamp || new Date().toISOString(),
      target,
      validated: {
        workflowId: target.type === 'workflow' ? WorkflowId.extract(target.id) : null,
        channelName,
        eventName
      }
    };

    // Send message via Pusher
    await pusherServer.trigger(channelName, eventName, messageData);

    // Save user message to database
    await saveMessageToDatabase(messageData, 'request', 'user', target.targetAgent || 'system');

    // Process with real BMAD agents
    if (target.type === 'workflow') {
      try {
        // Get singleton BMAD orchestrator
        const orchestrator = await getOrchestrator();

        // Process the message as a user input to agents
        const response = await processUserMessageWithAgents(orchestrator, content, target.id, target.targetAgent, userId);
        
        // Send agent response via Pusher immediately with standardized ID
        const agentResponse = {
          id: WorkflowId.generate(), // Use standardized ID generation
          content: response.content,
          agentId: response.agentId || 'bmad-orchestrator',
          agentName: response.agentName,
          provider: response.provider || 'unknown',
          usage: response.usage,
          userId: 'system',
          timestamp: new Date().toISOString(),
          workflowId: WorkflowId.extract(target.id), // Normalize workflow ID
          structured: response.structured,
        };

        await pusherServer.trigger(
          channelName,
          EVENTS.AGENT_MESSAGE,
          agentResponse
        );

        // Save agent response to database
        await saveMessageToDatabase(
          { ...agentResponse, target }, 
          'response', 
          response.agentId || 'bmad-orchestrator', 
          'user'
        );
      } catch (error) {
        logger.error('BMAD processing error:', error);
        // Fallback to simple response immediately with standardized ID
        const fallbackResponse = {
          id: WorkflowId.generate(), // Use standardized ID generation
          content: `I received your message: "${content}". I'm currently experiencing technical issues, but I'm here to help you with that!`,
          agentId: 'bmad-assistant',
          userId: 'system',
          timestamp: new Date().toISOString(),
          workflowId: WorkflowId.extract(target.id), // Normalize workflow ID
          error: error.message
        };

        await pusherServer.trigger(
          channelName,
          EVENTS.AGENT_MESSAGE,
          fallbackResponse
        );

        // Save fallback response to database
        await saveMessageToDatabase(
          { ...fallbackResponse, target }, 
          'response', 
          'bmad-assistant', 
          'user'
        );
      }
    }

    return NextResponse.json({
      success: true,
      messageId: messageData.id,
      channel: channelName,
      event: eventName,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

// Apply AI rate limiting and security headers to POST endpoint
export const POST = compose(
  withMethods(['POST']),
  withAIRateLimit,
  withSecurityHeaders,
  withErrorHandling
)(handler);