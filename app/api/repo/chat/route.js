/**
 * Repository Chat API
 * AI-powered chat about repository code with file citations
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import RepoChatSession from '@/lib/database/models/RepoChatSession.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';

/**
 * POST /api/repo/chat
 * Handle repository chat actions
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    await connectMongoose();

    const body = await request.json();
    const { action, analysisId, repositoryId, sessionId, message } = body;

    switch (action) {
      case 'create_session':
        return await createChatSession(session.user.id, analysisId, repositoryId);
      
      case 'send_message':
        return await sendChatMessage(sessionId, message, analysisId, session.user.id);
      
      case 'get_history':
        return await getChatHistory(sessionId, session.user.id);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('Repository chat error:', error);
    return NextResponse.json({
      success: false,
      error: 'Chat request failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Create new chat session
 */
async function createChatSession(userId, analysisId, repositoryId) {
  try {
    // Verify analysis exists and belongs to user
    const analysis = await RepoAnalysis.findById(analysisId);
    if (!analysis || analysis.userId.toString() !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found or access denied'
      }, { status: 404 });
    }

    // Check for existing active session
    const existingSession = await RepoChatSession.findOne({
      userId,
      repositoryId,
      status: 'active'
    }).sort({ lastActivityAt: -1 });

    if (existingSession) {
      return NextResponse.json({
        success: true,
        sessionId: existingSession.sessionId,
        existing: true
      });
    }

    // Create new session
    const chatSession = await RepoChatSession.createSession(
      userId,
      repositoryId,
      analysisId,
      {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 4000
      }
    );

    return NextResponse.json({
      success: true,
      sessionId: chatSession.sessionId,
      existing: false
    });

  } catch (error) {
    logger.error('Create session error:', error);
    throw error;
  }
}

/**
 * Send chat message and get AI response
 */
async function sendChatMessage(sessionId, message, analysisId, userId) {
  try {
    // Get chat session
    const chatSession = await RepoChatSession.findOne({ sessionId, userId });
    if (!chatSession) {
      return NextResponse.json({
        success: false,
        error: 'Chat session not found'
      }, { status: 404 });
    }

    // Get analysis data
    const analysis = await RepoAnalysis.findById(analysisId);
    if (!analysis) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found'
      }, { status: 404 });
    }

    // Add user message
    chatSession.addMessage('user', message);
    await chatSession.save();

    // Generate AI response
    const aiResponse = await generateAIResponse(message, analysis, chatSession, userId);

    // Add AI message with citations
    const aiMessage = chatSession.addMessage('assistant', aiResponse.content, {
      citations: aiResponse.citations || [],
      tokenUsage: aiResponse.tokenUsage,
      model: aiResponse.model || 'gpt-3.5-turbo',
      processingTime: aiResponse.processingTime
    });

    await chatSession.save();

    return NextResponse.json({
      success: true,
      response: aiResponse.content,
      citations: aiResponse.citations || [],
      tokenUsage: aiResponse.tokenUsage,
      messageId: aiMessage.id
    });

  } catch (error) {
    logger.error('Send message error:', error);
    throw error;
  }
}

/**
 * Get chat history
 */
async function getChatHistory(sessionId, userId) {
  try {
    const chatSession = await RepoChatSession.findOne({ sessionId, userId });
    if (!chatSession) {
      return NextResponse.json({
        success: false,
        error: 'Chat session not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      messages: chatSession.messages,
      sessionInfo: {
        id: chatSession.sessionId,
        totalMessages: chatSession.totalMessages,
        totalTokens: chatSession.totalTokens,
        lastActivity: chatSession.lastActivityAt,
        created: chatSession.createdAt
      }
    });

  } catch (error) {
    logger.error('Get history error:', error);
    throw error;
  }
}

/**
 * Generate AI response with repository context
 */
async function generateAIResponse(userMessage, analysis, chatSession, userId) {
  const startTime = Date.now();

  try {
    // Import AI service
    const { aiService } = await import('@/lib/ai/AIService.js');
    
    if (!aiService.initialized && userId) {
      try {
        await aiService.initialize(null, userId);
      } catch {
        return {
          content: 'I apologize, but the AI service is currently unavailable. Please try again later.',
          citations: [],
          processingTime: Date.now() - startTime
        };
      }
    }

    // Prepare repository context
    const repoContext = buildRepositoryContext(analysis, userMessage);
    
    // Get recent conversation context
    const conversationContext = chatSession.getContext(10);

    // Build comprehensive prompt
    const prompt = buildAIPrompt(userMessage, repoContext, conversationContext);

    // Call AI service
    const response = await aiService.call(prompt, null, 1, {
      action: 'repository_chat',
      repositoryId: analysis.repositoryId,
      analysisId: analysis._id.toString()
    }, chatSession.userId.toString());

    // Extract citations from response (if AI includes file references)
    const citations = extractCitations(response.content, analysis);

    return {
      content: response.content || 'I apologize, but I was unable to generate a response.',
      citations,
      tokenUsage: response.usage || { total: 0 },
      model: response.model || 'gpt-3.5-turbo',
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('AI response generation failed:', error);
    
    return {
      content: 'I encountered an error while processing your message. Please try asking your question in a different way.',
      citations: [],
      processingTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Build repository context for AI
 */
function buildRepositoryContext(analysis, userMessage) {
  const hasMetrics = analysis.metrics && analysis.metrics.fileCount > 0;
  const hasFileIndex = analysis.fileIndex && analysis.fileIndex.length > 0;
  
  const context = {
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
        : [],
      size: analysis.metrics?.totalSize || 0
    },
    structure: analysis.metrics?.largestFiles ? 
      analysis.metrics.largestFiles.slice(0, 10).map(f => ({
        path: f.path,
        language: f.language,
        lines: f.lines
      })) : [],
    analysisStatus: {
      hasMetrics,
      hasFileIndex,
      totalIndexedFiles: analysis.fileIndex?.length || 0,
      analysisComplete: analysis.status === 'completed'
    }
  };

  return context;
}

/**
 * Build AI prompt with context
 */
function buildAIPrompt(userMessage, repoContext, conversationContext) {
  const analysisStatus = repoContext.analysisStatus;
  
  let contextSection;
  
  if (!analysisStatus.hasMetrics && !analysisStatus.hasFileIndex) {
    // No analysis data available
    contextSection = `
REPOSITORY CONTEXT:
Repository: ${repoContext.repository.name}
Description: ${repoContext.repository.description}
Analysis Status: The repository analysis was completed but no code metrics were collected. This could mean:
- The repository is empty or contains only non-code files
- The analysis had issues accessing the repository content
- All files were filtered out due to size or type restrictions

Total Files Found: ${analysisStatus.totalIndexedFiles}
Analysis Complete: ${analysisStatus.analysisComplete}

IMPORTANT: Since no code analysis data is available, I cannot provide specific details about the repository's implementation, but I can offer general guidance about the repository or help with other questions.`;
  } else if (repoContext.metrics.files === 0) {
    // Analysis completed but found no files
    contextSection = `
REPOSITORY CONTEXT:
Repository: ${repoContext.repository.name}
Description: ${repoContext.repository.description}
Analysis Status: Analysis completed but found no code files (0 lines of code)
Files Indexed: ${analysisStatus.totalIndexedFiles}

This suggests the repository may be:
- A documentation-only repository
- Contains only configuration files
- Has files that were filtered out during analysis
- Currently empty or contains only binary files`;
  } else {
    // Normal analysis with data
    contextSection = `
REPOSITORY CONTEXT:
Repository: ${repoContext.repository.name}
Description: ${repoContext.repository.description}
Languages: ${repoContext.metrics.languages.join(', ') || 'Not detected'}
Total Files: ${repoContext.metrics.files.toLocaleString()}
Lines of Code: ${repoContext.metrics.lines.toLocaleString()}

KEY FILES:
${repoContext.structure.map(f => `- ${f.path} (${f.language}, ${f.lines} lines)`).join('\n')}`;
  }

  const prompt = `You are an AI assistant helping developers understand a GitHub repository. You have access to repository analysis data and should provide helpful, accurate responses about the code.

${contextSection}

${conversationContext.messages.length > 0 ? `
CONVERSATION HISTORY:
${conversationContext.messages.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
` : ''}

USER QUESTION: ${userMessage}

Please provide a helpful response about this repository. If analysis data is missing or limited, explain what information is available and offer general guidance. If you reference specific files, mention their paths. Keep responses concise but informative.`;

  return prompt;
}

/**
 * Extract file citations from AI response
 */
function extractCitations(content, analysis) {
  const citations = [];
  
  // Look for file path patterns in the response
  const filePathRegex = /(?:^|[\s])([a-zA-Z0-9._/-]+\.(js|jsx|ts|tsx|py|java|go|rs|cpp|c|cs|php|rb|swift|kt|html|css|scss|json|yaml|yml|md|txt|sh))/gm;
  
  let match;
  while ((match = filePathRegex.exec(content)) !== null) {
    const filePath = match[1];
    
    // Check if file exists in analysis
    const fileExists = analysis.fileIndex?.some(f => f.path === filePath);
    
    if (fileExists) {
      // Avoid duplicate citations
      if (!citations.some(c => c.filePath === filePath)) {
        citations.push({
          filePath,
          relevance: 0.8 // Default relevance score
        });
      }
    }
  }

  return citations.slice(0, 5); // Limit to 5 citations
}