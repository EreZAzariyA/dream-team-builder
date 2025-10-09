/**
 * User Interaction Service
 * Handles all user communication, questions, approvals, and messaging
 */

import logger from '../../utils/logger.js';
import { EVENTS } from '../../pusher/config.js';
import InteractiveMessaging from '../InteractiveMessaging.js';

class UserInteractionService {
  constructor(pusherService, messageService) {
    this.pusherService = pusherService;
    this.messageService = messageService;
    this.interactiveMessaging = new InteractiveMessaging(pusherService, messageService);
  }

  /**
   * Send agent message to user
   */
  async sendAgentMessage(workflowId, eventType, data) {
    if (!this.pusherService) {
      logger.warn(`No pusher service available for workflow ${workflowId}`);
      return;
    }

    try {
      const { WorkflowId } = await import('../../utils/workflowId.js');
      const channelName = WorkflowId.toChannelName(workflowId);
      
      await this.pusherService.trigger(channelName, eventType, {
        workflowId: workflowId,
        timestamp: new Date().toISOString(),
        ...data
      });

      logger.info(`📨 Message sent to workflow ${workflowId}: ${eventType}`);
    } catch (error) {
      logger.error(`❌ Failed to send message to workflow ${workflowId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate analysis questions for agent
   */
  async generateAnalysisQuestions(agent, step, context, workflow) {
    const baseQuestions = [
      "What is the main goal you want to achieve?",
      "Are there any specific requirements or constraints I should know about?",
      "Do you have any preferences for the approach or methodology?"
    ];

    // Agent-specific questions based on role
    const agentSpecificQuestions = {
      'analyst': [
        "What type of analysis are you looking for (technical, business, user experience)?",
        "Are there specific areas of the codebase you want me to focus on?",
        "Do you have any existing documentation I should review?"
      ],
      'architect': [
        "What are the key architectural concerns or challenges?",
        "Are there any performance or scalability requirements?",
        "Do you have preferences for specific technologies or patterns?"
      ],
      'pm': [
        "What are the key business objectives for this project?",
        "Who are the primary stakeholders and users?",
        "What is the timeline and priority level?"
      ]
    };

    const agentId = agent.id || agent.role || 'unknown';
    const questions = [...baseQuestions];
    
    if (agentSpecificQuestions[agentId]) {
      questions.push(...agentSpecificQuestions[agentId]);
    }

    return questions.slice(0, 4); // Limit to 4 questions
  }

  /**
   * Ask user questions and wait for responses
   */
  async askUserQuestions(workflowId, agentName, questions) {
    await this.sendAgentMessage(workflowId, EVENTS.AGENT_QUESTIONS, {
      agent: agentName,
      questions: questions,
      requiresResponse: true,
      responseType: 'questions'
    });

    logger.info(`❓ Questions sent to user for workflow ${workflowId}, waiting for responses...`);
    
    // Return placeholder - actual response would come through the messaging system
    return { 
      status: 'questions_sent',
      questionsCount: questions.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Wait for user approval of agent's work
   */
  async waitForUserApproval(workflowId, agentName) {
    // This is handled by the interactive messaging system
    // when requiresResponse is true in sendAgentMessage
    return { action: 'yes' };
  }

  /**
   * Handle user modification requests
   */
  async handleModificationRequest(workflowId, agent, step, context, workflow, feedback, originalResponse) {
    // Add user feedback to context
    context.userFeedback = feedback;
    
    await this.sendAgentMessage(workflowId, 'agent-modifying', {
      agent: agent.name || step.agent,
      message: `✦ I understand your feedback. Let me revise the ${step.creates || 'work'}.`,
      timestamp: new Date().toISOString(),
      requiresResponse: false
    });

    return {
      status: 'revision_requested',
      feedback,
      adjustedContext: context
    };
  }

  /**
   * Present revised work to user
   */
  async presentRevisedWork(workflowId, agent, step, revisedResponse) {
    await this.sendAgentMessage(workflowId, 'agent-work-revised', {
      agent: agent.name || step.agent,
      message: `✦ Here's the revised version. How does this look?`,
      timestamp: new Date().toISOString(),
      content: revisedResponse.content,
      requiresResponse: true,
      responseType: 'approval'
    });

    return {
      status: 'revision_presented',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send informational message
   */
  async sendInfoMessage(workflowId, agent, message) {
    await this.sendAgentMessage(workflowId, EVENTS.AGENT_MESSAGE, {
      agent: agent,
      message: message,
      requiresResponse: false,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send error message to user
   */
  async sendErrorMessage(workflowId, error, context = {}) {
    await this.sendAgentMessage(workflowId, EVENTS.AGENT_ERROR, {
      agent: 'system',
      message: `❌ An error occurred: ${error.message}`,
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
      requiresResponse: false
    });
  }

  /**
   * Send workflow completion message
   */
  async sendCompletionMessage(workflowId, artifacts) {
    const artifactList = artifacts ? Array.from(artifacts.keys()).join(', ') : 'none';
    
    await this.sendAgentMessage(workflowId, EVENTS.WORKFLOW_COMPLETE, {
      agent: 'system',
      message: `🎉 Workflow completed successfully! Generated artifacts: ${artifactList}`,
      artifacts: artifactList,
      timestamp: new Date().toISOString(),
      requiresResponse: false
    });
  }

  /**
   * Resume workflow with elicitation response
   */
  async resumeWorkflowWithElicitation(workflowId, elicitationResponse, agentName, userId = null) {
    logger.info(`📝 Resuming workflow ${workflowId} with elicitation response from ${agentName}`);
    
    // This would integrate with the workflow execution system
    // For now, return a status indicating the response was received
    return {
      status: 'elicitation_received',
      workflowId,
      agentName,
      response: elicitationResponse,
      userId,
      timestamp: new Date().toISOString()
    };
  }
}

export default UserInteractionService;