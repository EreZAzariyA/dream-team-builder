/**
 * Repository Chat Streaming API
 * Real-time streaming with tool execution progress
 * Supports both LangChain and Vercel AI SDK (feature flag)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import RepoChatSession from '@/lib/database/models/RepoChatSession.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';
import { streamText, stepCountIs } from 'ai';
import { tools } from '@/lib/ai/tools/index.js';
import { langchainTools } from '@/lib/ai/tools/langchain.js';

export const maxDuration = 30;
export const runtime = 'nodejs';

/**
 * POST /api/repo/chat/stream
 * Stream AI responses with real-time tool execution progress
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectMongoose();

    const body = await request.json();
    const { sessionId, message, analysisId, agentId } = body;

    if (!sessionId || !message || !analysisId) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load agent if provided
    let agent = null;
    if (agentId) {
      const { AgentLoader } = await import('@/lib/bmad/AgentLoader.js');
      const agentLoader = new AgentLoader();
      await agentLoader.loadAllAgents();
      agent = await agentLoader.loadAgent(agentId);

      if (!agent) {
        logger.warn(`Agent ${agentId} not found, using default behavior`);
      }
    }

    // Get chat session
    const chatSession = await RepoChatSession.findOne({ sessionId, userId: session.user.id });
    if (!chatSession) {
      return Response.json(
        { success: false, error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Get analysis data
    const analysis = await RepoAnalysis.findById(analysisId);
    if (!analysis) {
      return Response.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Add user message
    chatSession.addMessage('user', message);
    await chatSession.save();

    // Initialize AI service and get model
    const { aiService } = await import('@/lib/ai/AIService.js');
    if (!aiService.initialized && session.user.id) {
      try {
        await aiService.initialize(null, session.user.id);
      } catch (error) {
        logger.error(`Failed to initialize AI service: ${JSON.stringify(error)}`);
        return Response.json(
          { success: false, error: 'AI service unavailable' },
          { status: 503 }
        );
      }
    }

    // Set tool execution context
    const toolExecutor = await import('@/lib/ai/tools/toolExecutor.js');
    toolExecutor.setUserContext(session.user.id);
    toolExecutor.setRepositoryContext({
      owner: analysis.owner,
      name: analysis.name
    });

    // Restore working branch from session
    if (chatSession.metadata?.workingBranch) {
      toolExecutor.setWorkingBranch(chatSession.metadata.workingBranch);
    }

    // Prepare prompt
    const repoContext = buildRepositoryContext(analysis);
    const conversationContext = chatSession.getContext(5);
    const workingBranch = toolExecutor.getCurrentWorkingBranch();
    const systemPrompt = buildSystemPrompt(repoContext, workingBranch, agent);
    const userPrompt = buildUserPrompt(message, conversationContext);

    // Feature flag: Use LangChain or Vercel AI SDK
    const useLangChain = process.env.USE_LANGCHAIN === 'true' || aiService.useLangChain === true;

    logger.info(`🚀 Starting streaming chat with tools using ${useLangChain ? 'LangChain' : 'Vercel AI SDK'}`);

    if (useLangChain) {
      // LangChain streaming
      return await streamWithLangChain({
        aiService,
        chatSession,
        systemPrompt,
        userPrompt,
        toolExecutor,
        session
      });
    } else {
      // Vercel AI SDK streaming (original)
      const model = aiService.aiSdkService.getModel('auto');

      const result = streamText({
        model,
        messages: [{ role: 'user', content: userPrompt }],
        system: systemPrompt,
        tools,
        stopWhen: stepCountIs(5),
        temperature: 0.7,
        maxTokens: 4000,
        onStepFinish({ stepType, finishReason, usage }) {
          logger.info(`✅ Step finished:`, {
            stepType,
            finishReason,
            usage: {
              inputTokens: usage?.inputTokens || 0,
              outputTokens: usage?.outputTokens || 0,
              totalTokens: usage?.totalTokens || 0
            }
          });
        },
        async onFinish({ text, toolCalls, toolResults, steps, usage }) {
          logger.info(`🏁 Stream finished:`, {
            totalSteps: steps?.length || 0,
            totalToolCalls: toolCalls?.length || 0,
            textLength: text?.length || 0,
            usage
          });

          try {
            const aiMessage = chatSession.addMessage('assistant', text || 'Operation completed', {
              toolResults: toolResults || [],
              usage,
              steps: steps?.length || 0
            });

            const currentBranch = toolExecutor.getCurrentWorkingBranch();
            if (currentBranch) {
              if (!chatSession.metadata) {
                chatSession.metadata = {};
              }
              chatSession.metadata.workingBranch = currentBranch;
            }

            await chatSession.save();
            toolExecutor.cleanup();

            logger.info(`💾 Saved message ${aiMessage.id} to chat session`);
          } catch (error) {
            logger.error('Failed to save chat message:', error);
          }
        }
      });

      return result.toUIMessageStreamResponse();
    }

  } catch (error) {
    logger.error('Repository chat stream error:', error);
    return Response.json(
      { success: false, error: 'Stream request failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Build repository context
 */
function buildRepositoryContext(analysis) {
  return {
    repository: {
      name: analysis.fullName,
      owner: analysis.owner,
      description: analysis.summary || 'No description available'
    },
    metrics: {
      files: analysis.metrics?.fileCount || 0,
      lines: analysis.metrics?.totalLines || 0,
      languages: analysis.metrics?.languages ?
        Array.from(analysis.metrics.languages.entries())
          .sort(([,a], [,b]) => b.percentage - a.percentage)
          .slice(0, 5)
          .map(([lang, stats]) => `${lang} (${stats.percentage.toFixed(1)}%)`)
        : []
    },
    structure: analysis.metrics?.largestFiles ?
      analysis.metrics.largestFiles.slice(0, 10).map(f => ({
        path: f.path,
        language: f.language,
        lines: f.lines
      })) : []
  };
}

/**
 * Build system prompt with agent persona
 */
function buildSystemPrompt(repoContext, workingBranch = null, agent = null) {
  let prompt = '';

  // Add agent persona if available
  if (agent && agent.persona) {
    prompt += `# AGENT PERSONA\n`;
    prompt += `You are ${agent.agent?.name || agent.id}, a ${agent.agent?.title || 'AI Agent'}.\n\n`;

    if (agent.persona.role) {
      prompt += `Role: ${agent.persona.role}\n`;
    }
    if (agent.persona.style) {
      prompt += `Communication Style: ${agent.persona.style}\n`;
    }
    if (agent.persona.identity) {
      prompt += `Identity: ${agent.persona.identity}\n`;
    }
    if (agent.persona.focus) {
      prompt += `Focus: ${agent.persona.focus}\n`;
    }

    // Add core principles
    if (agent.persona.core_principles && Array.isArray(agent.persona.core_principles)) {
      prompt += `\nCore Principles:\n`;
      agent.persona.core_principles.forEach(principle => {
        prompt += `- ${principle}\n`;
      });
    }

    prompt += `\n`;
  } else {
    prompt += `You are an AI assistant helping developers work with the GitHub repository "${repoContext.repository.name}".\n\n`;
  }

  // Add working branch context
  if (workingBranch) {
    prompt += `🌿 CURRENT WORKING BRANCH: ${workingBranch}\n`;
    prompt += `All file operations will automatically use this branch.\n\n`;
  }

  // Add repository context
  prompt += `# REPOSITORY CONTEXT\n`;
  prompt += `- Name: ${repoContext.repository.name}\n`;
  prompt += `- Description: ${repoContext.repository.description}\n`;
  prompt += `- Languages: ${repoContext.metrics.languages.join(', ') || 'Not detected'}\n`;
  prompt += `- Total Files: ${repoContext.metrics.files.toLocaleString()}\n`;
  prompt += `- Lines of Code: ${repoContext.metrics.lines.toLocaleString()}\n\n`;

  // Add key files
  prompt += `# KEY FILES\n`;
  prompt += repoContext.structure.map(f => `- ${f.path} (${f.language}, ${f.lines} lines)`).join('\n');
  prompt += `\n\n`;

  // Add tool usage rules
  prompt += `# AVAILABLE TOOLS\n`;
  prompt += `You have access to tools for reading files, creating/updating files, managing branches, and making commits.\n\n`;

  prompt += `# CRITICAL TOOL USAGE RULES\n`;
  prompt += `- When using createOrUpdateFile, you MUST provide the COMPLETE file content in the 'content' parameter\n`;
  prompt += `- Do NOT skip the content parameter or provide placeholders\n`;
  prompt += `- Do NOT say "see above" or "use the previous content" - always provide the full content\n`;
  prompt += `- Read existing files first if you need to modify them\n`;
  prompt += `- Always provide a meaningful commit message\n\n`;

  prompt += `# WORKFLOW BEST PRACTICES\n`;
  prompt += `1. To modify existing files: Read from default branch FIRST → parse/modify content → create feature branch → write complete updated content\n`;
  prompt += `2. To create new files: Create branch first → write files with COMPLETE content\n`;
  prompt += `3. When adding dependencies to package.json:\n`;
  prompt += `   Step 1: Read package.json from default branch\n`;
  prompt += `   Step 2: Parse the JSON and add new dependencies\n`;
  prompt += `   Step 3: Create feature branch\n`;
  prompt += `   Step 4: Write COMPLETE updated package.json (entire file, not just changes)\n\n`;

  prompt += `Be helpful, accurate, and explain what you're doing when performing git operations.`;

  return prompt;
}

/**
 * Build user prompt with conversation history
 */
function buildUserPrompt(message, conversationContext) {
  let prompt = '';

  if (conversationContext.messages.length > 0) {
    prompt += 'CONVERSATION HISTORY:\n';
    prompt += conversationContext.messages.slice(-3).map(msg =>
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    prompt += '\n\n';
  }

  prompt += `USER REQUEST: ${message}`;

  return prompt;
}

/**
 * Stream with LangChain
 */
async function streamWithLangChain({ aiService, chatSession, systemPrompt, userPrompt, toolExecutor, session }) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const stream = await aiService.langchainService.streamWithTools(messages, langchainTools, {
    maxTokens: 4000,
    temperature: 0.7,
    maxIterations: 5
  });

  // Create readable stream for SSE
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        let fullText = '';
        let toolResults = [];

        for await (const chunk of stream) {
          if (chunk.type === 'tool_call') {
            // Tool execution event
            const event = {
              type: 'tool_call',
              toolName: chunk.toolName,
              toolInput: chunk.toolInput,
              toolResult: chunk.toolResult,
              stepIndex: chunk.stepIndex
            };

            logger.info(`🔧 Tool executed: ${chunk.toolName}`, { stepIndex: chunk.stepIndex });
            toolResults.push(event);

            // Send tool event to client
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

          } else if (chunk.type === 'text') {
            // Final text output
            fullText = chunk.content;

            const event = {
              type: 'text',
              content: chunk.content,
              done: true
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

            // Save to database
            try {
              const aiMessage = chatSession.addMessage('assistant', fullText, {
                toolResults,
                steps: toolResults.length
              });

              const currentBranch = toolExecutor.getCurrentWorkingBranch();
              if (currentBranch) {
                if (!chatSession.metadata) {
                  chatSession.metadata = {};
                }
                chatSession.metadata.workingBranch = currentBranch;
              }

              await chatSession.save();
              toolExecutor.cleanup();

              logger.info(`💾 LangChain: Saved message ${aiMessage.id} to chat session`);
            } catch (error) {
              logger.error('Failed to save LangChain chat message:', error);
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();

      } catch (error) {
        logger.error('LangChain streaming error:', error);
        controller.error(error);
      }
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
