/**
 * Smart Workflow Router
 * AI-autonomous routing that eliminates complex decision trees
 * Based on the simple, flowing experience from Untitled-1.md
 */

import logger from '../../utils/logger.js';

export class SmartWorkflowRouter {
  constructor(aiService, communicator) {
    this.aiService = aiService;
    this.communicator = communicator;
  }

  /**
   * Analyze user request and route autonomously like in the example
   * No complex forms - AI decides and continues
   */
  async analyzeAndRoute(workflowId, userRequest, context = {}) {
    logger.info(`🧠 [SMART ROUTER] Analyzing request: "${userRequest}"`);

    try {
      // AI analyzes the request like in Untitled-1.md
      const analysis = await this.performAIAnalysis(userRequest, context);
      
      // Send acknowledgment and continue (like the example)
      await this.sendRoutingResponse(workflowId, analysis);
      
      return {
        workflow: analysis.recommendedWorkflow,
        classification: analysis.classification,
        autoExecute: analysis.confidence > 0.8, // Only interrupt if AI is uncertain
        nextSteps: analysis.nextSteps,
        confidence: analysis.confidence
      };
      
    } catch (error) {
      logger.error(`❌ [SMART ROUTER] Analysis failed: ${error.message}`);
      
      // Fallback to safe default (like the example shows)
      return {
        workflow: 'major_enhancement',
        classification: 'major_enhancement', 
        autoExecute: true,
        nextSteps: ['documentation_check', 'prd_creation'],
        confidence: 0.9
      };
    }
  }

  /**
   * AI analyzes user request like the autonomous agent in the example
   */
  async performAIAnalysis(userRequest, context) {
    const prompt = `Analyze this enhancement request and classify it autonomously:

USER REQUEST: "${userRequest}"
PROJECT CONTEXT: ${context.repositoryName || 'unknown project'}

Based on the request, determine:
1. Classification: single_story, small_feature, or major_enhancement
2. Confidence level (0.0 to 1.0)
3. Recommended workflow path
4. Next steps to execute

Respond in JSON format:
{
  "classification": "major_enhancement",
  "confidence": 0.95,
  "recommendedWorkflow": "brownfield-fullstack",
  "reasoning": "User wants major enhancement...",
  "nextSteps": ["documentation_check", "prd_creation", "story_creation"]
}`;

    const agent = { name: 'smart-router', id: 'smart-router' };
    const response = await this.aiService.call(prompt, {
      agent,
      complexity: 1,
      context,
      userId: context.userId
    });
    
    if (response && response.content) {
      try {
        const analysis = JSON.parse(response.content);
        logger.info(`✅ [SMART ROUTER] AI classified as: ${analysis.classification} (confidence: ${analysis.confidence})`);
        return analysis;
      } catch (parseError) {
        logger.warn(`⚠️ [SMART ROUTER] Failed to parse AI response, using fallback`);
      }
    }

    // Fallback analysis
    return {
      classification: 'major_enhancement',
      confidence: 0.9,
      recommendedWorkflow: 'brownfield-fullstack',
      reasoning: 'Fallback classification for safe execution',
      nextSteps: ['documentation_check', 'prd_creation']
    };
  }

  /**
   * Send routing response like in Untitled-1.md example
   * Use the bmad-orchestrator agent's persona to generate response
   */
  async sendRoutingResponse(workflowId, analysis) {
    try {
      // Load the actual bmad-orchestrator agent from .bmad-core
      const { AgentLoader } = await import('../AgentLoader.js');
      const agentLoader = new AgentLoader();
      const orchestratorAgent = await agentLoader.loadAgent('bmad-orchestrator');
      
      if (!orchestratorAgent) {
        throw new Error('bmad-orchestrator agent not found');
      }

      // Let the bmad-orchestrator agent generate the routing response using its own persona
      const context = {
        userClassification: analysis.classification,
        confidence: analysis.confidence,
        recommendedWorkflow: analysis.recommendedWorkflow,
        reasoning: analysis.reasoning,
        action: 'send_routing_acknowledgment'
      };

      const response = await this.aiService.call('', {
        agent: orchestratorAgent,
        complexity: 1,
        context,
        userId: context.userId
      });
      
      const message = response?.content || `✦ Understood. Enhancement classified as ${analysis.classification}. Continuing with the workflow.`;
      
      await this.communicator.sendMessage(workflowId, {
        from: 'bmad-orchestrator',
        to: 'user',
        type: 'workflow_progress',
        content: {
          message: message,
          classification: analysis.classification,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning
        },
        timestamp: new Date()
      });
      
      logger.info(`📤 [SMART ROUTER] Sent orchestrator-generated routing response: ${analysis.classification}`);
    } catch (error) {
      logger.warn(`⚠️ [SMART ROUTER] Agent generation failed, using fallback: ${error.message}`);
      
      // Fallback to simple template only if agent loading fails
      const fallbackMessage = `✦ Understood. Enhancement classified as ${analysis.classification}. Continuing with the workflow.`;
      
      await this.communicator.sendMessage(workflowId, {
        from: 'bmad-orchestrator',
        to: 'user',
        type: 'workflow_progress',
        content: {
          message: fallbackMessage,
          classification: analysis.classification,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning
        },
        timestamp: new Date()
      });
      
      logger.info(`📤 [SMART ROUTER] Sent fallback routing response: ${analysis.classification}`);
    }
  }

  /**
   * Check if step requires user confirmation (minimize interruptions)
   * Most steps should auto-execute like in the example
   */
  shouldRequestConfirmation(step, analysis) {
    // Only ask for confirmation on final deliverable review steps
    const criticalReviewSteps = [
      'final_approval',
      'deployment_confirmation'
    ];
    
    // Only interrupt for critical steps or very low confidence
    return criticalReviewSteps.includes(step.type) || analysis.confidence < 0.5;
  }

  /**
   * Send progress update like the example shows
   * "✦ The next step is to check for existing project documentation..."
   */
  async sendProgressUpdate(workflowId, message, action = null) {
    await this.communicator.sendMessage(workflowId, {
      from: 'bmad-orchestrator', 
      to: 'user',
      type: 'workflow_progress',
      content: {
        message: `✦ ${message}`,
        action: action,
        timestamp: new Date()
      },
      timestamp: new Date()
    });
    
    logger.info(`📤 [PROGRESS] ${message}`);
  }
}

export default SmartWorkflowRouter;