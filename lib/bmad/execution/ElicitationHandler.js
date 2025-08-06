import logger from '@/lib/utils/logger.js';

class ElicitationHandler {
  constructor(aiService) {
    this.aiService = aiService;
  }

  async handle(agent, section, context, initialElicitationText = null) {
    const { parsedContext } = context;

    logger.info('🔍 [ELICITATION HANDLER DEBUG] Starting handle method', {
      agentId: agent.id,
      sectionTitle: section.title,
      sectionId: section.id,
      hasAiService: !!this.aiService,
      hasInitialText: !!initialElicitationText,
      initialTextLength: initialElicitationText?.length,
      parsedContextKeys: parsedContext ? Object.keys(parsedContext) : 'null'
    });

    // If we have initial elicitation text from the agent, process it to create user-facing response
    if (initialElicitationText && initialElicitationText.trim().length > 0) {
      logger.info('🤖 [ELICITATION HANDLER] Processing agent-generated text:', {
        textLength: initialElicitationText.length,
        textPreview: initialElicitationText.substring(0, 200) + (initialElicitationText.length > 200 ? '...' : '')
      });

      // Defensive check for aiService
      if (!this.aiService) {
        logger.warn(`⚠️ [ELICITATION] No aiService available to process agent text, using it directly`);
        return {
          type: 'elicitation_required',
          sectionId: section.id,
          sectionTitle: section.title,
          instruction: initialElicitationText.trim(),
          originalInstruction: section.instruction,
          context: parsedContext,
          agentId: agent.id
        };
      }

      try {
        // Create a prompt to process the agent's detailed text into a user-friendly question
        const processingPrompt = `You are helping convert a detailed agent response into a clear, user-friendly question.

The agent generated this detailed text:
"${initialElicitationText}"

Your job is to extract the key question or request from this text and present it in a clear, conversational way that a user can easily understand and respond to.

Keep the essence of what the agent is asking for, but make it:
1. Clear and concise
2. User-friendly (not technical jargon)
3. Actionable - the user knows exactly what to provide
4. Conversational tone

Generate a user-friendly version of this request:`;

        logger.info('🔍 [ELICITATION HANDLER DEBUG] Processing agent text with AI');

        // Extract userId from multiple possible locations
        const userId = context?.userId || context?.parsedContext?.userId || context?.workflowContext?.initiatedBy;
        
        const aiResponse = await this.aiService.call(processingPrompt, agent, 1, context, userId);
        
        logger.info('🔍 [ELICITATION HANDLER DEBUG] AI Processing Response:', {
          hasResponse: !!aiResponse,
          hasContent: !!(aiResponse?.content),
          contentLength: aiResponse?.content?.length,
          contentPreview: aiResponse?.content?.substring(0, 100) + (aiResponse?.content?.length > 100 ? '...' : '')
        });

        if (aiResponse && aiResponse.content && aiResponse.content.trim().length > 0) {
          return {
            type: 'elicitation_required',
            sectionId: section.id,
            sectionTitle: section.title,
            instruction: aiResponse.content.trim(),
            originalInstruction: section.instruction,
            originalAgentText: initialElicitationText,
            context: parsedContext,
            agentId: agent.id
          };
        } else {
          // If AI processing fails, use the original agent text
          logger.warn(`⚠️ [ELICITATION] Failed to process agent text, using original`);
          return {
            type: 'elicitation_required',
            sectionId: section.id,
            sectionTitle: section.title,
            instruction: initialElicitationText.trim(),
            originalInstruction: section.instruction,
            context: parsedContext,
            agentId: agent.id
          };
        }
      } catch (error) {
        logger.error(`❌ [ELICITATION] Error processing agent text:`, error);
        // Fall back to using the original agent text
        return {
          type: 'elicitation_required',
          sectionId: section.id,
          sectionTitle: section.title,
          instruction: initialElicitationText.trim(),
          originalInstruction: section.instruction,
          context: parsedContext,
          agentId: agent.id
        };
      }
    }

    // Defensive check for aiService
    if (!this.aiService) {
      logger.warn(`⚠️ [ELICITATION] No aiService available for ${section.title}, using fallback`);
      return this.fallback(section, parsedContext, agent);
    }

    try {
      // Create a more targeted prompt based on the step type
      let elicitationPrompt;
      
      if (section.id === 'enhancement_classification' || section.title?.includes('classification')) {
        // Special prompt for classification steps - focus on scope, not detailed requirements
        elicitationPrompt = `You are a ${agent.agent?.title || agent.agent?.name || agent.id} helping classify the scope of a project enhancement.

The user described their project as: "${parsedContext?.projectDescription || 'User is working on a project'}"

Your job is to ask a simple classification question to determine if this is:
- A simple/small task (single story, quick implementation)
- A medium feature (few related stories)  
- A complex/major enhancement (comprehensive planning needed)

Generate a friendly, conversational question that helps classify the scope. Keep it simple and focused on understanding the complexity level, NOT gathering detailed requirements.

Example: "That sounds great! To help me route this to the right workflow - is this something simple you need quickly, or a more comprehensive feature that needs careful planning?"

Generate a similar classification question:`;
      } else {
        // Default prompt for other elicitation steps
        elicitationPrompt = `You are a ${agent.agent?.title || agent.agent?.name || agent.id} working on a project. You need to gather information from the user for the \"${section.title}\" section.\n\nThe internal template instruction for this section is:\n\"${section.instruction}\"\n\nBased on this template instruction, create a clear, conversational question or set of questions to ask the user. Make it:\n1. User-friendly and conversational (not technical instructions)\n2. Specific about what information you need\n3. Include examples if helpful\n4. Keep it concise but clear\n\nContext about the project: ${parsedContext?.projectDescription || 'User is working on a project'}\n\nGenerate a user-friendly question/prompt:`;
      }

      logger.info('🔍 [ELICITATION HANDLER DEBUG] Generated prompt length:', elicitationPrompt.length);
      logger.info('🔍 [ELICITATION HANDLER DEBUG] Calling aiService.call with context:', {
        hasContext: !!context,
        contextKeys: context ? Object.keys(context) : [],
        hasUserId: !!(context?.userId || context?.parsedContext?.userId)
      });

      // Extract userId from multiple possible locations
      const userId = context?.userId || context?.parsedContext?.userId || context?.workflowContext?.initiatedBy;
      logger.info('🔍 [ELICITATION HANDLER DEBUG] Extracted userId:', userId);

      const aiResponse = await this.aiService.call(elicitationPrompt, agent, 1, context, userId);
      
      logger.info('🔍 [ELICITATION HANDLER DEBUG] AI Response received:', {
        hasResponse: !!aiResponse,
        hasContent: !!(aiResponse?.content),
        contentLength: aiResponse?.content?.length,
        contentPreview: aiResponse?.content?.substring(0, 100) + (aiResponse?.content?.length > 100 ? '...' : '')
      });

      if (aiResponse && aiResponse.content && aiResponse.content.trim().length > 0) {
        return {
          type: 'elicitation_required',
          sectionId: section.id,
          sectionTitle: section.title,
          instruction: aiResponse.content.trim(),
          originalInstruction: section.instruction,
          context: parsedContext,
          agentId: agent.id
        };
      } else {
        logger.warn(`⚠️ [ELICITATION] Failed to generate user-friendly question for ${section.title}, using fallback`);
        return this.fallback(section, parsedContext, agent);
      }
    } catch (error) {
      logger.error(`❌ [ELICITATION] Error generating user-friendly question for ${section.title}:`, error);
      
      // Check if this is an API keys issue
      if (error.message && error.message.includes('API keys')) {
        return {
          type: 'elicitation_required',
          sectionId: section.id,
          sectionTitle: section.title,
          instruction: `I need your input for the "${section.title}" section, but I'm unable to generate a personalized question because your AI API keys aren't configured. Please go to Settings to add your OpenAI or Google Gemini API keys, then try again.\n\nFor now, here's what I need: ${section.instruction}`,
          originalInstruction: section.instruction,
          context: parsedContext,
          agentId: agent.id,
          error: 'missing_api_keys'
        };
      }
      
      return this.fallback(section, parsedContext, agent);
    }
  }

  fallback(section, parsedContext, agent) {
    return {
      type: 'elicitation_required',
      sectionId: section.id,
      sectionTitle: section.title,
      instruction: `I need your input for the \"${section.title}\" section. Could you provide more details about your project requirements for this area?`,
      originalInstruction: section.instruction,
      context: parsedContext,
      agentId: agent.id
    };
  }
}

module.exports = { ElicitationHandler };
