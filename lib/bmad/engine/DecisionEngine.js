/**
 * DECISION ENGINE
 * 
 * Handles AI-driven workflow decision making
 * Extracted from DynamicWorkflowHandler to improve maintainability
 * 
 * Responsibilities:
 * - Detect decision steps vs elicitation steps
 * - Use AI to analyze context and make routing decisions
 * - Format decision messages for user display
 * - Handle decision step execution lifecycle
 */

import logger from '../../utils/logger.js';

class DecisionEngine {
  constructor(workflowEngine) {
    this.workflowEngine = workflowEngine;
  }

  /**
   * Determine if a step is a decision step (not elicitation)
   * Decision steps analyze existing context and make routing decisions
   */
  isDecisionStep(step) {
    logger.info(`🔍 [DECISION ENGINE] Checking if step is decision: ${step.step || 'unnamed'}, action: "${step.action || 'none'}"`);
    
    // AGGRESSIVE DEBUG: Log every call to isDecisionStep
    logger.info(`🚨 [DECISION ENGINE DEBUG] isDecisionStep called for step: ${JSON.stringify({step: step.step, action: step.action, condition: step.condition})}`);
    
    if (!step.action) {
      logger.info(`🔍 [DECISION ENGINE] Step has no action: ${JSON.stringify(step)}`);
      return false;
    }
    
    const decisionActions = [
      'check existing documentation',
      'determine if architecture document needed',
      'assess documentation quality',
      'evaluate existing resources',
      'analyze current state'
    ];
    
    logger.info(`🔍 [DECISION ENGINE] Comparing action "${step.action}" against decision actions`);
    
    // Check for exact decision action matches
    if (decisionActions.includes(step.action)) {
      logger.info(`🗘️ [DECISION ENGINE] EXACT MATCH: "${step.action}" is a decision action`);
      return true;
    }
    
    // Check for decision action patterns
    const decisionPatterns = [
      /^check\s+existing/i,
      /^determine\s+(if|whether)/i,
      /^assess\s+/i,
      /^evaluate\s+/i,
      /^analyze\s+current/i
    ];
    
    for (const pattern of decisionPatterns) {
      if (pattern.test(step.action)) {
        logger.info(`🗘️ [DECISION ENGINE] PATTERN MATCH: "${step.action}" matches pattern ${pattern}`);
        return true;
      }
    }
    
    logger.info(`🔍 [DECISION ENGINE] NO MATCH: "${step.action}" is not a decision action`);
    return false;
  }

  /**
   * Handle decision steps - use AI to analyze context and set routing decisions
   */
  async handleDecisionStep(workflowId, step, userId = null) {
    // Load workflow from database instead of in-memory storage
    const workflow = await this.workflowEngine.databaseService.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found in database`);
    }
    
    logger.info(`🧠 [DECISION ENGINE] Starting handleDecisionStep for: ${step.step || 'unnamed'}`);
    logger.info(`🧠 [DECISION ENGINE] Step action: "${step.action}"`);
    logger.info(`🧠 [DECISION ENGINE] Workflow ID: ${workflowId}`);
    
    try {
      
      // Get the agent for this decision
      const agent = await this.workflowEngine.agentLoader.loadAgent(step.agentId);
      if (!agent) {
        throw new Error(`Agent ${step.agentId} not found for decision step`);
      }

      // Build context for AI decision making
      const decisionContext = this.buildDecisionContext(step, workflow);
      
      // Generate AI prompt for decision making
      const decisionPrompt = this.buildDecisionPrompt(step, decisionContext, workflow);
      
      logger.info(`🧠 [DECISION AI] Making decision for: ${step.action}`);
      
      // Call AI service to make the decision
      const response = await this.workflowEngine.aiService.call(decisionPrompt, agent, 'simple', {}, userId);
      
      if (!response || !response.content) {
        throw new Error('AI decision response was empty');
      }
      
      // Process AI decision response
      const decision = this.processDecisionResponse(step, response.content, workflow);
      
      // Set routing decision based on step type
      const decisionKey = this.getDecisionKey(step);
      
      // Ensure context and routingDecisions exist
      if (!workflow.context) {
        workflow.context = {};
      }
      if (!workflow.context.routingDecisions) {
        workflow.context.routingDecisions = {};
      }
      
      workflow.context.routingDecisions[decisionKey] = decision;
      
      logger.info(`✅ [DECISION COMPLETE] ${step.action} → ${decisionKey}: ${decision}`);
      
      // Send concise decision result to user via live chat
      const decisionMessage = this.formatDecisionMessage(step, decision, response.content);
      
      await this.workflowEngine.communicator.sendMessage(workflowId, {
        from: step.agentId,
        to: 'user',
        type: 'agent_response',
        content: {
          message: decisionMessage,
          agentId: step.agentId,
          stepName: step.step || step.action || 'Decision Step',
          decisionKey: decisionKey,
          decision: decision
        },
        timestamp: new Date()
      });
      
      // Advance to next step
      workflow.currentStep++;
      
      // Save updated workflow state to database
      await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow, userId);
      
      return { success: true, decision, decisionKey };
      
    } catch (error) {
      logger.error(`❌ [DECISION ENGINE] Failed: ${error.message}`);
      
      // Set fallback decision to continue workflow
      const decisionKey = this.getDecisionKey(step);
      const fallbackDecision = this.getFallbackDecision(step);
      
      // Ensure context and routingDecisions exist
      if (!workflow.context) {
        workflow.context = {};
      }
      if (!workflow.context.routingDecisions) {
        workflow.context.routingDecisions = {};
      }
      
      workflow.context.routingDecisions[decisionKey] = fallbackDecision;
      
      logger.warn(`🚫 [DECISION FALLBACK] Using fallback: ${decisionKey}: ${fallbackDecision}`);
      
      workflow.currentStep++;
      
      // Save updated workflow state to database
      await this.workflowEngine.databaseService.saveWorkflow(workflowId, workflow, userId);
      
      return { success: false, error: error.message, decision: fallbackDecision, decisionKey };
    }
  }

  /**
   * Build context for AI decision making
   */
  buildDecisionContext(step, workflow) {
    return {
      userPrompt: workflow.userPrompt,
      currentStep: workflow.currentStep,
      stepAction: step.action,
      stepNotes: step.notes,
      routingDecisions: Object.fromEntries(workflow.context?.routingDecisions || new Map()),
      artifacts: Array.from(workflow.context?.artifacts?.keys() || []),
      elicitationHistory: workflow.context?.elicitationHistory || []
    };
  }

  /**
   * Build AI prompt for decision making
   */
  buildDecisionPrompt(step, context, workflow) {
    const prompt = `You are the ${step.agentId} agent making a workflow decision.

TASK: ${step.action}
STEP NOTES: ${step.notes || 'None provided'}

CONTEXT:
- User's original request: "${context.userPrompt}"
- Current workflow step: ${context.currentStep}
- Previous decisions: ${JSON.stringify(context.routingDecisions || {}, null, 2)}
- Available artifacts: ${context.artifacts.join(', ') || 'None'}
- Recent user responses: ${JSON.stringify(context.elicitationHistory.slice(-3), null, 2)}

INSTRUCTIONS:
1. Analyze the available context and information
2. Make a decision based on the task requirements
3. Respond with a clear, single decision value
4. Be concise and decisive

For "${step.action}":
${this.getDecisionInstructions(step)}

Respond with just the decision value (no explanation needed):`;

    return prompt;
  }

  /**
   * Get decision-specific instructions for AI
   */
  getDecisionInstructions(step) {
    switch (step.action) {
      case 'check existing documentation':
        return `- If user mentioned having documentation, API specs, architecture docs, or existing resources → respond "adequate"
- If user said "no", "none", "don't have", or similar negative responses → respond "inadequate"
- If unclear or mixed information → respond "inadequate" (safer to gather more info)`;
      
      case 'determine if architecture document needed':
        return `- If PRD mentions new architectural patterns, frameworks, or infrastructure changes → respond "needed"
- If following existing patterns with no architectural changes → respond "not_needed"`;
      
      default:
        return 'Analyze the context and respond with an appropriate decision value.';
    }
  }

  /**
   * Process AI decision response
   */
  processDecisionResponse(step, aiResponse, workflow) {
    const response = aiResponse.trim().toLowerCase();
    
    // Clean up common AI response patterns
    const cleanResponse = response
      .replace(/^(the\s+)?(decision\s+is\s*:?\s*)?/i, '')
      .replace(/[.!"']/g, '')
      .trim();
    
    logger.info(`🧙 [AI DECISION] Raw: "${response}" → Clean: "${cleanResponse}"`);
    
    return cleanResponse;
  }

  /**
   * Get the routing decision key for a step
   */
  getDecisionKey(step) {
    switch (step.action) {
      case 'check existing documentation':
        return 'documentation_check';
      case 'determine if architecture document needed':
        return 'architecture_decision';
      default:
        // Generate key from step name or action
        return step.step || step.action?.replace(/\s+/g, '_').toLowerCase() || 'decision';
    }
  }

  /**
   * Get fallback decision if AI fails
   */
  getFallbackDecision(step) {
    switch (step.action) {
      case 'check existing documentation':
        return 'inadequate'; // Conservative: assume we need more documentation
      case 'determine if architecture document needed':
        return 'needed'; // Conservative: create architecture doc when unsure
      default:
        return 'continue'; // Generic fallback
    }
  }

  /**
   * Format decision message for user display
   */
  formatDecisionMessage(step, decision, reasoning) {
    switch (step.action) {
      case 'check existing documentation':
        if (decision === 'adequate') {
          return '✅ Documentation Check: Found adequate existing documentation. Proceeding with PRD creation.';
        } else {
          return '📝 Documentation Check: Insufficient documentation found. Will gather project information first.';
        }
      
      case 'determine if architecture document needed':
        if (decision === 'needed') {
          return '🏢 Architecture Review: Architectural changes required. Will create architecture document.';
        } else {
          return '✅ Architecture Review: No architectural changes needed. Proceeding with current patterns.';
        }
      
      default:
        return `✅ ${step.action || 'Decision'}: ${decision}`;
    }
  }

  /**
   * Process user response from elicitation for decision steps
   * Converts raw user response into proper routing decisions
   */
  async processElicitationResponse(workflowId, step, userResponse, userId) {
    logger.info(`🧠 [DECISION ENGINE] Processing elicitation response for step: ${step.step}`);
    logger.info(`🧠 [DECISION ENGINE] User response: "${userResponse}"`);
    
    // Handle documentation_check step
    if (step.step === 'documentation_check' || step.action === 'check existing documentation') {
      logger.info(`📋 [DOCUMENTATION CHECK] Processing documentation assessment response`);
      
      // Analyze user response to determine if documentation is adequate or inadequate
      const lowerResponse = userResponse.toLowerCase();
      
      // Check for indicators of adequate documentation
      const adequateIndicators = [
        'yes', 'good', 'comprehensive', 'complete', 'adequate', 'sufficient', 
        'up-to-date', 'current', 'detailed', 'thorough', 'exists', 'have'
      ];
      
      // Check for indicators of inadequate documentation  
      const inadequateIndicators = [
        'no', 'none', 'missing', 'incomplete', 'outdated', 'limited', 
        'poor', 'minimal', 'insufficient', 'old', 'lacking', 'partial'
      ];
      
      let hasAdequateIndicators = adequateIndicators.some(indicator => lowerResponse.includes(indicator));
      let hasInadequateIndicators = inadequateIndicators.some(indicator => lowerResponse.includes(indicator));
      
      let decision;
      if (hasInadequateIndicators && !hasAdequateIndicators) {
        decision = 'inadequate';
        logger.info(`📋 [DOCUMENTATION CHECK] Decision: inadequate (user indicated insufficient documentation)`);
      } else if (hasAdequateIndicators && !hasInadequateIndicators) {
        decision = 'adequate';
        logger.info(`📋 [DOCUMENTATION CHECK] Decision: adequate (user indicated sufficient documentation)`);
      } else {
        // Default to inadequate for brownfield workflows to ensure proper documentation
        decision = 'inadequate';
        logger.info(`📋 [DOCUMENTATION CHECK] Decision: inadequate (ambiguous response, defaulting to comprehensive analysis)`);
      }
      
      logger.info(`✅ [DECISION ENGINE] documentation_check routing decision: ${decision}`);
      return decision;
    }
    
    // Handle other decision steps
    logger.warn(`⚠️ [DECISION ENGINE] No specific handler for decision step: ${step.step}`);
    return null;
  }
  
}

export { DecisionEngine };