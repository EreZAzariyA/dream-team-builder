import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import User from '@/lib/database/models/User';

// Import BMAD system components for proper agent execution
import BmadOrchestrator from '@/lib/bmad/BmadOrchestrator.js';
const { AgentLoader } = require('@/lib/bmad/AgentLoader.js');

/**
 * BMAD Commands Execution API - CORRECTED VERSION
 * 
 * CRITICAL CORRECTION: BMAD commands like *create-prd are AI AGENT INSTRUCTIONS,
 * not user template forms. This API routes commands to the AgentExecutor system
 * where AI agents handle the interactive workflow through conversation.
 * 
 * CORRECT FLOW:
 * 1. User types: @pm *create-prd
 * 2. System: Routes to PM agent with create-prd command
 * 3. PM Agent: Executes create-doc.md task with prd-tmpl.yaml
 * 4. AI Agent: Leads interactive conversation with user (1-9 elicitation format)
 * 5. Result: Document created through conversational workflow
 * 
 * NOT: User fills template form → Document generated
 * ACTUALLY: AI agent leads conversation → Document created interactively
 */

// Global BMAD orchestrator instance (singleton pattern for API routes)
let bmadInstance = null;

export async function POST(request) {
  try {
    const { agent, command, context = {}, workflowId, conversationId } = await request.json();

    // Validate required fields
    if (!agent || !command) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agent and command',
        usage: 'Send { agent: "pm", command: "create-prd", context: {...} }'
      }, { status: 400 });
    }

    console.log(`🎯 BMAD Command Execution: @${agent} *${command}`);

    // Get authenticated user session for API keys
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in to execute BMAD commands'
      }, { status: 401 });
    }

    // Load user and their API keys
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        message: 'User session is invalid'
      }, { status: 404 });
    }

    // Get user's decrypted API keys
    const userApiKeys = user.getApiKeys();
    const hasApiKeys = user.hasApiKeys();
    
    console.log(`🔑 User API Keys Status:`, {
      userId: user._id,
      hasOpenAI: !!userApiKeys.openai,
      hasGemini: !!userApiKeys.gemini,
      mockMode: !hasApiKeys
    });

    // Initialize BMAD orchestrator with user-specific configuration
    if (!bmadInstance) {
      console.log('🔄 Initializing BMAD Orchestrator...');
      
      bmadInstance = new BmadOrchestrator(null, { 
        apiKeys: hasApiKeys ? {
          openai: userApiKeys.openai,
          gemini: userApiKeys.gemini
        } : null,
        userId: user._id.toString()
      });
      
      await bmadInstance.initialize();
      console.log(`✅ BMAD Orchestrator initialized (mockMode: ${shouldUseMockMode})`);
    } else {
      // Update existing orchestrator with user's API keys
      if (hasApiKeys && bmadInstance.workflowEngine?.executor) {
        bmadInstance.workflowEngine.executor.updateApiKeys({
          openai: userApiKeys.openai,
          gemini: userApiKeys.gemini
        });
        console.log('🔄 Updated orchestrator with user API keys');
      }
    }

    // Load and validate agent
    const agentLoader = new AgentLoader();
    await agentLoader.loadAllAgents();
    
    const agentObj = await agentLoader.loadAgent(agent);
    if (!agentObj) {
      return NextResponse.json({
        success: false,
        error: `Agent '${agent}' not found`,
        availableAgents: agentLoader.getAllAgentsMetadata().map(a => a.id)
      }, { status: 404 });
    }

    // Validate command exists for this agent
    // Commands are at root level of agentObj, not nested under agentObj.agent
    const validCommands = agentObj.commands || [];
    
    // Agent loaded successfully with commands
    
    const commandExists = validCommands.some(cmd => 
      (typeof cmd === 'string' && cmd === command) ||
      (typeof cmd === 'object' && Object.keys(cmd)[0] === command)
    );

    if (!commandExists) {
      return NextResponse.json({
        success: false,
        error: `Command '${command}' not available for agent '${agent}'`,
        availableCommands: validCommands.map(cmd => 
          typeof cmd === 'string' ? cmd : Object.keys(cmd)[0]
        )
      }, { status: 400 });
    }

    // Create execution context for BMAD agent
    const executionContext = {
      // Core command info
      command: `*${command}`, // BMAD commands use * prefix
      action: command,
      userPrompt: context.userPrompt || `@${agent} *${command}`,
      
      // Workflow tracking
      workflowId: workflowId || `bmad-cmd-${Date.now()}`,
      conversationId: conversationId || `conv-${Date.now()}`,
      
      // Agent context
      agentId: agent,
      agentName: agentObj.agent?.name || agent,
      
      // User context
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.profile?.name || user.email.split('@')[0],
      
      // API configuration
      apiKeys: hasApiKeys ? {
        openai: userApiKeys.openai,
        gemini: userApiKeys.gemini
      } : null,
      
      // Additional context
      ...context,
      
      // BMAD-specific context
      bmadCommand: true,
      interactiveMode: true,
      elicitationEnabled: true
    };

    console.log(`🚀 Executing BMAD command with context:`, {
      agent: agent,
      command: `*${command}`,
      workflowId: executionContext.workflowId,
      conversationId: executionContext.conversationId,
      userId: executionContext.userId,
      mockMode: executionContext.mockMode,
      hasApiKeys: hasApiKeys
    });

    // Route to BMAD system for proper AI agent execution
    const result = await executeBmadCommand(agentObj, executionContext);

    return NextResponse.json({
      success: true,
      agent,
      command: `*${command}`,
      result,
      executedAt: new Date().toISOString(),
      workflowId: executionContext.workflowId,
      conversationId: executionContext.conversationId,
      userId: executionContext.userId,
      mockMode: executionContext.mockMode,
      bmadExecution: true
    });

  } catch (error) {
    console.error('❌ BMAD command execution error:', error);
    return NextResponse.json({
      success: false,
      error: 'Command execution failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Load agent configuration from .md file
 */
async function loadAgentConfig(agentId) {
  try {
    const agentFilePath = path.join(process.cwd(), '.bmad-core', 'agents', `${agentId}.md`);
    const content = fs.readFileSync(agentFilePath, 'utf8');
    const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
    
    if (!yamlMatch) {
      throw new Error(`No YAML configuration found in ${agentId}.md`);
    }

    return yaml.load(yamlMatch[1]);
  } catch (error) {
    console.error(`Failed to load agent config for ${agentId}:`, error);
    return null;
  }
}

/**
 * Get available agents list
 */
async function getAvailableAgents() {
  try {
    const agentsDir = path.join(process.cwd(), '.bmad-core', 'agents');
    const files = fs.readdirSync(agentsDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''));
  } catch (error) {
    return [];
  }
}

/**
 * Extract command details from agent configuration
 */
async function getCommandDetails(agentConfig, command) {
  const commands = agentConfig.commands || [];
  
  for (const cmd of commands) {
    if (typeof cmd === 'string' && cmd === command) {
      return { name: command, description: '' };
    } else if (typeof cmd === 'object') {
      const [cmdName, cmdDescription] = Object.entries(cmd)[0];
      if (cmdName === command) {
        return { 
          name: cmdName, 
          description: typeof cmdDescription === 'string' ? cmdDescription : ''
        };
      }
    }
  }
  
  return { name: command, description: '' };
}

/**
 * CORE FUNCTION: Execute BMAD command through proper AI agent system
 * 
 * This function routes BMAD commands to the AgentExecutor where AI agents
 * handle the interactive workflow through conversation with the user.
 * 
 * BMAD Command Types:
 * - help: Agent introduces itself and lists commands
 * - create-*: Agent executes create-doc.md task with specific template
 * - shard-*: Agent executes shard-doc.md task 
 * - etc.: Agent executes corresponding task from dependencies
 */
async function executeBmadCommand(agentObj, executionContext) {
  console.log(`🔄 Routing to BMAD AgentExecutor: ${executionContext.command}`);

  try {
    // Use the global BMAD orchestrator to execute the agent
    const result = await bmadInstance.workflowEngine.executor.executeAgent(agentObj, executionContext);

    console.log(`✅ BMAD Agent execution completed:`, {
      success: result.success,
      agentId: result.agentId,
      type: result.type || 'agent_response',
      hasMessages: !!(result.messages && result.messages.length),
      hasArtifacts: !!(result.artifacts && result.artifacts.length)
    });

    // Process the result based on command type
    return processAgentResult(result, executionContext);

  } catch (error) {
    console.error(`❌ Error executing BMAD command: ${executionContext.command}`, error);
    
    // Return user-friendly error for UI
    return {
      type: 'error',
      error: 'Agent execution failed',
      message: `Failed to execute @${executionContext.agentId} ${executionContext.command}`,
      details: error.message,
      bmadError: true,
      suggestedActions: [
        'Check that .bmad-core directory is properly configured',
        'Verify the agent and command are valid',
        'Try the *help command first to test agent connectivity',
        'Check system logs for detailed error information'
      ]
    };
  }
}

/**
 * Process AgentExecutor results into UI-friendly format
 */
function processAgentResult(result, executionContext) {
  const { command, agentId } = executionContext;

  // Handle different result types from AgentExecutor
  if (result.type === 'elicitation') {
    // Agent is requesting user input using BMAD 1-9 format
    return {
      type: 'elicitation_request',
      command,
      agentId,
      agentName: result.agentName || agentId,
      message: result.message || result.elicitationPrompt,
      options: result.options || [],
      context: result.context || {},
      conversationContinuation: true,
      awaitingUserResponse: true
    };
  }

  if (result.type === 'agent_response' || result.success) {
    // Standard agent response
    return {
      type: 'agent_response',
      command,
      agentId,
      agentName: result.agentName || agentId,
      message: result.messages && result.messages.length > 0 
        ? result.messages.join('\n') 
        : result.message || 'Command executed successfully',
      artifacts: result.artifacts || [],
      outputs: result.outputs || [],
      conversationComplete: result.conversationComplete || false,
      nextSteps: result.nextSteps || []
    };
  }

  if (result.type === 'document_created') {
    // Document generation completed
    return {
      type: 'document_created',
      command,
      agentId,
      agentName: result.agentName || agentId,
      message: result.message || 'Document created successfully',
      documentPath: result.documentPath,
      documentType: result.documentType,
      artifacts: result.artifacts || [],
      conversationComplete: true
    };
  }

  // Handle errors or unknown result types
  if (!result.success) {
    return {
      type: 'execution_error',
      command,
      agentId,
      error: result.error || 'Agent execution failed',
      message: result.message || 'The agent encountered an error',
      details: result.details || result.error || 'Unknown error',
      suggestions: result.suggestions || [
        'Try the command again',
        'Use *help to verify agent is working',
        'Check the command syntax'
      ]
    };
  }

  // Fallback for unexpected result format
  return {
    type: 'agent_response',
    command,
    agentId,
    agentName: result.agentName || agentId,
    message: 'Command completed',
    rawResult: result // Include raw result for debugging
  };
}

// Removed old template-based functions - they were incorrectly implementing
// BMAD commands as user forms instead of AI agent conversations

/**
 * Handle GET requests - return corrected API documentation
 */
export async function GET() {
  return NextResponse.json({
    name: 'BMAD Commands Execution API - CORRECTED VERSION',
    version: '2.0.0',
    description: 'Execute BMAD commands through AI agent system (NOT template forms)',
    
    criticalCorrection: {
      incorrect: 'BMAD commands return template forms for users to fill out',
      correct: 'BMAD commands are routed to AI agents who lead interactive conversations',
      workflow: [
        '1. User types: @pm *create-prd',
        '2. System routes to PM AI agent',
        '3. PM agent executes create-doc.md task with prd-tmpl.yaml',
        '4. AI agent leads conversation using BMAD 1-9 elicitation format',
        '5. Document created through interactive agent-user conversation'
      ]
    },

    usage: {
      method: 'POST',
      endpoint: '/api/bmad/commands/execute',
      body: {
        agent: 'Agent ID (pm, architect, dev, etc.)',
        command: 'Command name (create-prd, help, etc.) - NO * prefix needed',
        context: 'Optional context object',
        workflowId: 'Optional workflow ID for tracking',
        conversationId: 'Optional conversation ID for multi-turn dialogs'
      }
    },

    responseTypes: {
      agent_response: 'Standard agent response with message',
      elicitation_request: 'Agent requesting user input with 1-9 options',
      document_created: 'Document generation completed',
      execution_error: 'Agent execution failed',
      error: 'System error occurred'
    },

    examples: [
      {
        description: 'Get help from Product Manager',
        request: { agent: 'pm', command: 'help' },
        expectedResponse: 'Agent introduces itself and lists available commands'
      },
      {
        description: 'Start PRD creation with PM',
        request: { agent: 'pm', command: 'create-prd', context: { userPrompt: 'Create PRD for mobile app' } },
        expectedResponse: 'PM agent begins interactive PRD creation conversation'
      },
      {
        description: 'Create architecture with Architect',
        request: { agent: 'architect', command: 'create-full-stack-architecture', workflowId: 'workflow_123' },
        expectedResponse: 'Architect agent starts interactive architecture design process'
      }
    ],

    bmadIntegration: {
      orchestrator: 'Routes to BmadOrchestrator → WorkflowEngine → AgentExecutor',
      agentExecution: 'AI agents handle commands through conversational workflows',
      elicitation: 'Uses BMAD 1-9 elicitation format for user interaction',
      taskExecution: 'Commands map to tasks in .bmad-core/tasks/ directory',
      templateProcessing: 'AI agents process templates interactively, not as forms'
    }
  });
}