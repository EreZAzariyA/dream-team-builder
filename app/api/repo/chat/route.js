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
      toolResults: aiResponse.toolResults || [],
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

  // Check memory usage and force cleanup if high
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (memUsagePercent > 80) {
    logger.warn(`High memory usage detected: ${memUsagePercent.toFixed(1)}% - forcing cleanup`);
    if (global.gc) {
      global.gc();
    }
  }

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
    
    // Get recent conversation context (reduced to save memory)
    const conversationContext = chatSession.getContext(5);

    // Restore branch context from chat session metadata
    const toolExecutor = await import('@/lib/ai/tools/toolExecutor.js');
    if (chatSession.metadata?.workingBranch) {
      toolExecutor.setWorkingBranch(chatSession.metadata.workingBranch);
      logger.info(`🔄 Restored working branch context: ${chatSession.metadata.workingBranch}`);
    }

    // Build comprehensive prompt with branch context
    const workingBranch = toolExecutor.getCurrentWorkingBranch();
    const prompt = buildAIPrompt(userMessage, repoContext, conversationContext, workingBranch);

    // Call AI service with tools enabled for git operations  
    const response = await aiService.callWithTools(prompt, null, 1, {
      action: 'repository_chat',
      repositoryId: analysis.repositoryId,
      analysisId: analysis._id.toString(),
      repository: {
        owner: analysis.owner,
        name: analysis.name,
        fullName: analysis.fullName
      }
    }, chatSession.userId.toString()); // Enable tools

    // Extract citations from response (if AI includes file references)
    const citations = extractCitations(response.content || response.text, analysis);

    // Handle tool executions - process ALL steps, not just final toolCalls
    let toolResults = [];

    // Check if we have multiple steps (AI SDK v5 returns steps array)
    if (response.steps && response.steps.length > 0) {
      logger.info(`🔍 Processing ${response.steps.length} execution steps`);

      // Extract all tool calls from all steps
      response.steps.forEach((step, stepIndex) => {
        if (step.toolCalls && step.toolCalls.length > 0) {
          step.toolCalls.forEach(toolCall => {
            // Log the full structure to debug
            logger.info(`🔍 Full toolCall structure for step ${stepIndex + 1}:`, {
              keys: Object.keys(toolCall),
              toolName: toolCall.toolName,
              type: toolCall.type,
              hasArgs: !!toolCall.args,
              hasResult: !!toolCall.result
            });

            const result = toolCall.result || toolCall.output || toolCall.response || toolCall.returnValue || toolCall.data;

            // Try to get args from different possible locations
            const args = toolCall.args || toolCall.arguments || toolCall.parameters || toolCall.input;

            toolResults.push({
              step: stepIndex + 1,
              tool: toolCall.toolName,
              result: result,
              success: true,
              args: args,
              toolCall: toolCall // Store entire toolCall for debugging
            });

            logger.info(`📝 Step ${stepIndex + 1}: ${toolCall.toolName}`, {
              args: args,
              hasResult: !!result
            });
          });
        }
      });

      logger.info(`✅ Extracted ${toolResults.length} tool executions from ${response.steps.length} steps`);
    }
    // Fallback to old method if steps not available
    else if (response.toolCalls && response.toolCalls.length > 0) {
      logger.info(`🔍 Debug toolCalls structure:`, response.toolCalls);

      toolResults = response.toolCalls.map(toolCall => {
        logger.info(`🔍 Individual toolCall:`, {
          toolName: toolCall.toolName,
          result: toolCall.result,
          keys: Object.keys(toolCall)
        });

        const result = toolCall.result || toolCall.output || toolCall.response || toolCall.returnValue || toolCall.data;

        return {
          tool: toolCall.toolName,
          result: result,
          success: true
        };
      });
    }

    // Generate appropriate response content with tool-specific messaging
    let content = response.content || response.text;

    // If we have multiple tool results, prepend a summary
    if (toolResults.length > 1) {
      const operationsSummary = toolResults.map((tool, index) => {
        const stepLabel = tool.step ? `Step ${tool.step}` : `${index + 1}`;

        // Format based on tool type
        if (tool.tool === 'createOrUpdateFile') {
          // Try multiple ways to get the file path
          const filePath = tool.args?.filePath ||
                          tool.result?.path ||
                          tool.result?.filePath ||
                          tool.toolCall?.args?.filePath ||
                          (typeof tool.result?.message === 'string' && tool.result.message.match(/file ([^\s]+)/)?.[1]) ||
                          'file';
          const action = tool.result?.action || 'modified';
          return `${stepLabel}. ✅ ${action === 'created' ? 'Created' : 'Updated'} **${filePath}**`;
        } else if (tool.tool === 'createBranch') {
          const branchName = tool.args?.branchName ||
                            tool.toolCall?.args?.branchName ||
                            (typeof tool.result === 'string' && tool.result.match(/branch ([^\s]+)/)?.[1]) ||
                            'branch';
          return `${stepLabel}. 🌿 Created branch **${branchName}**`;
        } else if (tool.tool === 'readFile') {
          const filePath = tool.args?.path ||
                          tool.result?.path ||
                          tool.toolCall?.args?.path ||
                          'file';
          return `${stepLabel}. 📄 Read **${filePath}**`;
        } else if (tool.tool === 'switchWorkingBranch') {
          const branchName = tool.args?.branchName ||
                            tool.toolCall?.args?.branchName ||
                            'branch';
          return `${stepLabel}. 🔀 Switched to branch **${branchName}**`;
        } else {
          return `${stepLabel}. ✅ ${tool.tool}`;
        }
      }).join('\n');

      // Prepend summary to content
      const summaryHeader = `**Completed ${toolResults.length} operations:**\n\n${operationsSummary}\n\n---\n\n`;
      content = summaryHeader + (content || 'All operations completed successfully.');
    }
    // If no text response but tools were executed successfully, provide meaningful feedback
    else if (!content && toolResults.length > 0) {
      const successfulTools = toolResults.filter(tool => tool.success);
      if (successfulTools.length > 0) {
        const toolMessages = successfulTools.map(tool => {
          if (tool.tool === 'listBranches') {
            const result = tool.result;
            
            // Debug logging to see what we're getting
            logger.info(`🔍 listBranches result structure:`, { result: result, type: typeof result });
            
            if (result && result.branches) {
              const branchList = result.branches.map(branch => 
                `- ${branch.name}${branch.isDefault ? ' (default)' : ''}${branch.protected ? ' (protected)' : ''}`
              ).join('\n');
              return `**Branches in ${result.repository}:**\n\n${branchList}\n\n**Total:** ${result.totalBranches} branches\n**Default branch:** ${result.defaultBranch}`;
            }
            
            // Try to handle if result is a string
            if (typeof result === 'string') {
              return result;
            }
            
            // Try to handle if result has message property
            if (result && result.message) {
              return result.message;
            }
            
            return `Successfully retrieved branch information. Debug: ${JSON.stringify(result)}`;
          } else if (tool.tool === 'getWorkflowStatus') {
            const result = tool.result;
            return `**Current Git Workflow Status:**\n- Working branch: ${result?.currentWorkingBranch || 'None set'}\n- Repository: ${result?.repository || 'Unknown'}\n\n${result?.message || ''}`;
          } else if (tool.tool === 'deleteBranch') {
            return `✅ Branch deleted successfully. ${tool.result?.message || tool.result}`;
          } else if (tool.tool === 'createBranch') {
            return `✅ Branch created successfully. ${tool.result?.message || tool.result}`;
          } else if (tool.tool === 'readFile') {
            const result = tool.result;
            if (result && result.content) {
              return `**File: ${result.path}**\n\n\`\`\`\n${result.content.substring(0, 1000)}${result.content.length > 1000 ? '\n...(truncated)' : ''}\n\`\`\`\n\n**Size:** ${result.size} bytes`;
            }
            return `Successfully read file. ${tool.result?.message || tool.result}`;
          } else if (tool.tool === 'createOrUpdateFile') {
            return `✅ File operation completed successfully. ${tool.result?.message || tool.result}`;
          } else {
            return `✅ ${tool.tool} completed successfully. ${tool.result?.message || tool.result}`;
          }
        });
        content = toolMessages.join('\n\n');
      } else {
        content = 'Tool execution completed, but some operations may have failed. Please check the results below.';
      }
    }
    
    // Final fallback
    if (!content) {
      content = 'Operation completed successfully.';
    }

    // Save updated working branch context to chat session and cleanup
    const currentBranch = toolExecutor.getCurrentWorkingBranch();
    if (currentBranch) {
      if (!chatSession.metadata) {
        chatSession.metadata = {};
      }
      chatSession.metadata.workingBranch = currentBranch;
      logger.info(`💾 Saved working branch context to session: ${currentBranch}`);
      await chatSession.save();
    }

    // Clean up context to prevent memory leaks
    toolExecutor.cleanup();

    return {
      content,
      citations,
      toolResults,
      tokenUsage: response.usage || { total: 0 },
      model: response.model || 'gpt-3.5-turbo',
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('AI response generation failed:', error);
    
    // Clean up context even on error
    try {
      const toolExecutorCleanup = await import('@/lib/ai/tools/toolExecutor.js');
      toolExecutorCleanup.cleanup();
    } catch (cleanupError) {
      logger.error('Cleanup failed:', cleanupError);
    }
    
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
function buildAIPrompt(userMessage, repoContext, conversationContext, workingBranch = null) {
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

  const prompt = `You are an AI assistant helping developers understand and work with a GitHub repository. You have access to repository analysis data and can perform git operations when requested.

${workingBranch ? `🌿 CURRENT WORKING BRANCH: ${workingBranch}
All file operations (readFile, createOrUpdateFile) will automatically use this branch unless you specify otherwise.` : ''}

AVAILABLE TOOLS:
- readFile: Read file contents from the repository
  Usage: readFile({ path: "path/to/file.js" })
- writeFile: Write or modify files in the repository
- createBranch: Create new git branches in ${repoContext.repository.name}
  Usage: createBranch({ branchName: "feature-name" })
  Note: After creating a branch, it becomes your active working branch for all file operations
- deleteBranch: Delete git branches from ${repoContext.repository.name} (protected branches cannot be deleted)
  Usage: deleteBranch({ branchName: "feature-name" })
- createOrUpdateFile: Create or update files directly in ${repoContext.repository.name}
  Usage: createOrUpdateFile({ filePath: "path/to/file.js", content: "file content", message: "commit message" })
  Note: Files will be committed to your current working branch (${workingBranch || 'main'})
- createCommit: Create commits with multiple file changes in ${repoContext.repository.name}
- createPullRequest: Create pull requests on GitHub for ${repoContext.repository.name}
- getRepositoryInfo: Get repository information (clone URLs, default branch, etc)
- switchWorkingBranch: Switch to a different existing branch as your working branch
  Usage: switchWorkingBranch({ branchName: "existing-branch" })
- getWorkflowStatus: Check your current working branch and git workflow status
  Usage: getWorkflowStatus()
- listBranches: List all branches in the repository with their details
  Usage: listBranches()

BRANCH WORKFLOW BEST PRACTICES:
1. When creating files or making changes, first create a feature branch: createBranch({ branchName: "feature/your-feature" })
2. All subsequent file operations will automatically use your working branch
3. After making changes, you can create a pull request to merge back to main
4. The system maintains branch context throughout our conversation

IMPORTANT WORKFLOW EXAMPLES:
Example 1 - Adding a dependency to package.json:
  Step 1: readFile({ path: "package.json" }) - Read from DEFAULT branch to get current content
  Step 2: Parse JSON, add the new dependency to dependencies object
  Step 3: createBranch({ branchName: "feature/add-react" })
  Step 4: createOrUpdateFile({ filePath: "package.json", content: updatedJSON, message: "Add React dependency" })

  IMPORTANT: Always read files from the default branch BEFORE creating the feature branch!
  Once you create a branch, it becomes your working branch and newly created branches don't have files yet.

Example 2 - Creating a new feature file:
  Step 1: createBranch({ branchName: "feature/new-component" })
  Step 2: createOrUpdateFile({ filePath: "src/components/NewComponent.js", content: componentCode, message: "Add new component" })

CRITICAL WORKFLOW RULES:
1. To modify existing files: ALWAYS read from default branch FIRST, then create feature branch, then write
2. To create new files: Create branch first, then write new files
3. When user asks to "add [dependency]" or "install [package]":
   - Read package.json from default branch
   - Parse and modify the JSON
   - Create feature branch
   - Write updated package.json to feature branch
4. Do NOT create a branch and stop - complete the entire workflow!

Note: Git operations will be performed on the repository "${repoContext.repository.name}" owned by "${repoContext.repository.owner || 'the user'}".

${contextSection}

${conversationContext.messages.length > 0 ? `
CONVERSATION HISTORY:
${conversationContext.messages.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
` : ''}

USER QUESTION: ${userMessage}

Please provide a helpful response about this repository. You can:
- Answer questions about the code and its structure
- Read and analyze specific files when asked
- Make code changes and commit them when requested
- Create branches, commits, and pull requests as needed
- Explain what you're doing when performing git operations

If analysis data is missing or limited, explain what information is available and offer general guidance. If you reference specific files, mention their paths. When making changes, always explain what you're doing and why.`;

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