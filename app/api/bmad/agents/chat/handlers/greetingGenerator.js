/**
 * AI-powered agent greeting generation
 * Generates personalized greetings based on agent persona
 */

/**
 * Generate AI-powered greeting based on agent persona
 */
export async function generateAIAgentGreeting(agent, user, mockMode, userApiKeys) {
  if (mockMode) {
    return generateMockGreeting(agent, user);
  }

  try {
    // Import AI service dynamically to avoid circular dependencies
    const { aiService } = await import('@/lib/ai/AIService.js');
    
    // Initialize AI service with user API keys if needed
    if (!aiService.initialized && userApiKeys) {
      await aiService.initialize(userApiKeys, user._id.toString());
    }

    // Build greeting prompt based on agent persona
    const persona = agent.persona || {};
    const agentInfo = agent.agent || {};
    const userName = user.profile?.name || user.email.split('@')[0];
    
    let prompt = `Generate a brief, personalized greeting (2-3 sentences max) for the following agent meeting a new user:

Agent Details:
- Name: ${agentInfo.name || agent.id}
- Title: ${agentInfo.title || 'AI Assistant'}
- Role: ${persona.role || 'Assistant'}
- Focus: ${persona.focus || 'General assistance'}`;

    if (persona.identity) {
      prompt += `\n- Identity: ${persona.identity}`;
    }

    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      prompt += `\n- Key principles: ${persona.core_principles.slice(0, 3).join(', ')}`;
    }

    prompt += `\n\nUser: ${userName}

Generate a greeting that:
- Reflects the agent's personality and expertise
- Is warm and professional
- Briefly mentions what you can help with
- Uses the agent's natural voice/tone
- Is concise (2-3 sentences)

Do not include any introductory text, just return the greeting directly.`;

    // Call AI service to generate greeting
    const response = await aiService.call(prompt, agent, 1, { greeting: true }, user._id.toString());
    
    if (response && response.content) {
      return response.content.trim();
    } else {
      console.warn('AI greeting generation returned empty response');
      return generateFallbackGreeting(agent, user);
    }

  } catch (error) {
    console.error('AI greeting generation failed:', error);
    return generateFallbackGreeting(agent, user);
  }
}

/**
 * Generate mock greeting for testing/demo mode
 */
function generateMockGreeting(agent, user) {
  const agentInfo = agent.agent || {};
  const persona = agent.persona || {};
  const userName = user.profile?.name || user.email.split('@')[0];
  const agentName = agentInfo.name || agent.id;
  const agentIcon = agentInfo.icon || '🤖';
  
  const mockGreetings = [
    `Hello ${userName}! I'm ${agentName} ${agentIcon}, your ${agentInfo.title || 'AI assistant'}. I'm here to help you with ${persona.focus || 'your needs'}. What would you like to work on today?`,
    `Hi there, ${userName}! ${agentName} ${agentIcon} here, ready to assist you as your ${persona.role || 'AI assistant'}. I specialize in ${persona.focus || 'various tasks'} and I'm excited to help you succeed. How can I support you?`,
    `Welcome, ${userName}! I'm ${agentName} ${agentIcon}, and I'm thrilled to work with you today. As your ${agentInfo.title || 'assistant'}, I focus on ${persona.focus || 'helping you achieve your goals'}. What can we tackle together?`
  ];
  
  return mockGreetings[Math.floor(Math.random() * mockGreetings.length)];
}

/**
 * Generate fallback greeting when AI generation fails
 */
function generateFallbackGreeting(agent, user) {
  const agentInfo = agent.agent || {};
  const persona = agent.persona || {};
  const userName = user.profile?.name || user.email.split('@')[0];
  const agentName = agentInfo.name || agent.id;
  const agentIcon = agentInfo.icon || '🤖';
  
  return `Hello ${userName}! I'm ${agentName} ${agentIcon}, your ${agentInfo.title || 'AI assistant'}. I'm here to help you with ${persona.focus || 'your needs'}. How can I assist you today?`;
}