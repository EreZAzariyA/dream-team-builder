
import logger from '@/lib/utils/logger.js';
const { AgentStatus } = require('../types.js');

class EventHandler {
  constructor(communicator, storeService, pusherService) {
    this.communicator = communicator;
    this.storeService = storeService;
    this.pusherService = pusherService;
  }

  setup() {
    this.communicator.on('workflow:complete', (data) => this.handleWorkflowComplete(data));
    this.communicator.on('agent:activated', (data) => this.handleAgentActivated(data));
    this.communicator.on('agent:completed', (data) => this.handleAgentCompleted(data));
    this.communicator.on('message', (message) => this.handleMessage(message));
  }

  handleWorkflowComplete(data) {
    this.storeService.dispatch('workflow/completed', data);
    this.pusherService.trigger(data.workflowId, 'workflow-update', {
      status: 'completed',
      message: 'Workflow completed successfully'
    });
  }

  handleAgentActivated(data) {
    this.storeService.dispatch('agent/statusChanged', {
      agentId: data.agentId,
      status: AgentStatus.ACTIVE,
      workflowId: data.workflowId
    });
    this.pusherService.trigger(data.workflowId, 'agent-activated', {
      agentId: data.agentId,
      status: 'active',
      message: `Agent ${data.agentId} is now active`
    });
  }

  handleAgentCompleted(data) {
    this.storeService.dispatch('agent/statusChanged', {
      agentId: data.agentId,
      status: AgentStatus.COMPLETED,
      workflowId: data.workflowId
    });
    this.pusherService.trigger(data.workflowId, 'agent-completed', {
      agentId: data.agentId,
      status: 'completed',
      message: `Agent ${data.agentId} completed successfully`
    });
  }

  async handleMessage(message) {
    logger.info(`[BMAD] ${message.type}: ${message.from} → ${message.to}`);
    if (message.workflowId) {
      if (message.type === 'elicitation_request') {
        await this.handleElicitationRequest(message);
      } else {
        this.handleGeneralMessage(message);
      }
    }
  }

  async handleElicitationRequest(message) {
    try {
      const { connectMongoose } = require('../../database/mongodb.js');
      await connectMongoose();
      
      const WorkflowModel = require('../../database/models/Workflow.js').default;
      const updateResult = await WorkflowModel.findByIdAndUpdate(message.workflowId, { 
        status: 'PAUSED_FOR_ELICITATION',
        elicitationDetails: message.content,
        updatedAt: new Date()
      }, { new: true });
      
      logger.info('📝 [DATABASE] Elicitation details saved:', { 
        workflowId: message.workflowId, 
        success: !!updateResult,
        elicitationDetails: message.content 
      });

      this.pusherService.trigger(message.workflowId, 'workflow-update', {
        status: 'PAUSED_FOR_ELICITATION',
        message: 'Workflow paused, waiting for user input.',
        elicitationDetails: message.content,
        timestamp: new Date().toISOString()
      });
      logger.debug('\uD83D\uDCE3 [PUSHER DIAGNOSTIC] Event sent: workflow-update', { workflowId: message.workflowId, status: 'PAUSED_FOR_ELICITATION' });
    } catch (dbError) {
      logger.error('❌ [DATABASE] Failed to update workflow with elicitation details:', dbError);
    }
  }

  handleGeneralMessage(message) {
    if (message.type === 'activation') {
      this.pusherService.trigger(message.workflowId, 'agent-activated', {
        agentId: message.to,
        status: 'active',
        message: `Agent ${message.to} activated`,
        timestamp: new Date().toISOString()
      });
    } else if (message.type === 'completion') {
      this.pusherService.trigger(message.workflowId, 'agent-completed', {
        agentId: message.from,
        status: 'completed',
        message: `Agent ${message.from} completed successfully`,
        timestamp: new Date().toISOString()
      });
    }
    
    this.pusherService.trigger(message.workflowId, 'workflow-message', {
      message: {
        id: message.id || `msg_${Date.now()}`,
        from: message.from,
        to: message.to,
        summary: this.generateMessageSummary(message),
        content: this.truncateContentForPusher(message.content),
        timestamp: new Date().toISOString()
      }
    });
    
    if (message.type === 'inter_agent') {
      this.pusherService.trigger(message.workflowId, 'agent-communication', {
        from: message.from,
        to: message.to,
        content: message.content,
        summary: message.content?.summary || 'Agent communication',
        timestamp: new Date().toISOString()
      });
    }
  }

  truncateContentForPusher(content) {
    if (!content) return null;
    
    try {
      if (typeof content === 'object') {
        if (content.summary && content.agentRole) {
          return content;
        }
        
        const summary = {
          userPrompt: content.userPrompt || null,
          instructions: Array.isArray(content.instructions) ? `${content.instructions.length} instructions` : content.instructions,
          context: content.context ? {
            workflowId: content.context.workflowId,
            step: content.context.step,
            totalSteps: content.context.totalSteps,
            agentRole: content.context.agentRole,
            previousArtifacts: content.context.previousArtifacts ? `${content.context.previousArtifacts.length} artifacts` : null
          } : null
        };
        
        let summaryString = JSON.stringify(summary);
        if (summaryString.length > 1000) {
          return {
            userPrompt: content.userPrompt ? content.userPrompt.substring(0, 200) + '...' : null,
            type: 'truncated_object',
            originalSize: JSON.stringify(content).length
          };
        }
        return summary;
      }
      
      if (typeof content === 'string') {
        return content.length > 500 ? content.substring(0, 500) + '...' : content;
      }
      
      return content;
    } catch (error) {
      logger.error('Error truncating content for Pusher:', error);
      return { error: 'Content truncation failed', type: typeof content };
    }
  }

  generateMessageSummary(message) {
    switch (message.type) {
      case 'activation':
        return `Activating ${message.to} agent`;
      case 'completion':
        return message.content?.summary || `${message.from} completed task`;
      case 'error':
        return `Error in ${message.from}: ${message.content?.error || 'Unknown error'}`;
      case 'inter_agent':
        return `${message.from} → ${message.to}: ${message.content?.summary || 'Communication'}`;
      case 'workflow_complete':
        return 'Workflow completed successfully';
      default:
        return `${message.type} message from ${message.from} to ${message.to}`;
    }
  }
}

module.exports = { EventHandler };
