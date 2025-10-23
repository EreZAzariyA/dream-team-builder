import { NextResponse } from 'next/server';
import { AgentLoader } from '@/lib/bmad/AgentLoader.js';
import logger from '@/lib/utils/logger.js';
import { redisService } from '@/lib/utils/redis.js';

/**
 * GET /api/bmad/agents
 * Returns all available BMAD agents with their metadata (with Redis caching)
 * Used by the agent-chat page and other components that need agent listings
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    const redisKey = 'agents:all';

    // Check Redis cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cachedAgents = await redisService.get(redisKey);
        if (cachedAgents) {
          logger.info('✅ AGENTS CACHE HIT: Loaded from Redis');
          return NextResponse.json({
            ...cachedAgents,
            cached: true,
            source: 'redis'
          });
        }
        logger.info('⚠️ AGENTS CACHE MISS: Loading from filesystem');
      } catch (redisError) {
        logger.error(`Redis GET error for ${redisKey}:`, redisError);
      }
    } else {
      logger.info('🔄 Force refresh requested for agents list');
    }

    logger.info('🔍 Loading all BMAD agents from filesystem');

    // Load agents using AgentLoader (file-based)
    const agentLoader = new AgentLoader();
    await agentLoader.loadAllAgents();
    
    // Get all agent metadata
    const agentsMetadata = agentLoader.getAllAgentsMetadata();
    
    if (!agentsMetadata || agentsMetadata.length === 0) {
      logger.warn('⚠️ No agents found in .bmad-core/agents directory');
      return NextResponse.json({
        success: false,
        error: 'No agents found',
        message: 'No agent definitions found in .bmad-core/agents directory',
        agents: []
      }, { status: 404 });
    }
    
    // Load detailed agent information for each agent
    const agents = [];
    for (const metadata of agentsMetadata) {
      try {
        const agent = await agentLoader.loadAgent(metadata.id);
        if (agent) {
          // Format agent data for the frontend
          const formattedAgent = {
            id: agent.id,
            agentId: agent.id, // alias for compatibility
            name: agent.name,
            title: agent.title || agent.name,
            icon: agent.icon || '🤖',
            description: agent.whenToUse || agent.persona?.role || `${agent.name} agent`,
            persona: agent.persona,
            commands: agent.commands || [],
            dependencies: agent.dependencies,
            
            // Additional metadata for UI
            displayName: agent.title || agent.name,
            category: agent.category || 'core',
            isActive: true,
            isSystemAgent: true,
            
            // Quick actions for the UI
            quickActions: extractQuickActions(agent.commands),
            
            // Capabilities summary
            capabilities: {
              hasCommands: agent.commands && agent.commands.length > 0,
              hasDependencies: agent.dependencies && Object.keys(agent.dependencies).length > 0,
              isConversational: true
            }
          };
          
          agents.push(formattedAgent);
        }
      } catch (error) {
        logger.warn(`⚠️ Failed to load detailed data for agent ${metadata.id}:`, error.message);
        // Still include basic metadata even if detailed loading fails
        agents.push({
          id: metadata.id,
          agentId: metadata.id,
          name: metadata.name,
          title: metadata.name,
          icon: '🤖',
          description: 'Agent description unavailable',
          persona: {},
          commands: [],
          dependencies: {},
          displayName: metadata.name,
          category: 'core',
          isActive: true,
          isSystemAgent: true,
          quickActions: ['Get Help'],
          capabilities: {
            hasCommands: false,
            hasDependencies: false,
            isConversational: true
          }
        });
      }
    }
    
    logger.info(`✅ Successfully loaded ${agents.length} agents for API response`);

    const responseData = {
      success: true,
      agents,
      metadata: {
        totalAgents: agents.length,
        loadedAt: new Date().toISOString(),
        source: 'file-based (.bmad-core/agents)',
        agentIds: agents.map(a => a.id)
      }
    };

    // Cache in Redis (no TTL - persists until server restart)
    try {
      await redisService.set(redisKey, responseData);
      logger.info(`📦 Cached ${agents.length} agents to Redis (no TTL - persists until restart)`);
    } catch (redisError) {
      logger.error(`Redis SET error for ${redisKey}:`, redisError);
    }

    return NextResponse.json({
      ...responseData,
      cached: false,
      source: 'filesystem'
    });
    
  } catch (error) {
    logger.error('❌ Error loading agents for API:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load agents',
      message: error.message,
      agents: [],
      details: 'Check that .bmad-core/agents directory exists and contains valid agent files'
    }, { status: 500 });
  }
}

/**
 * Extract quick action commands from agent commands list
 */
function extractQuickActions(commands) {
  if (!commands || commands.length === 0) {
    return ['Get Help', 'Ask Question'];
  }
  
  // Take first 3-4 commands as quick actions, exclude generic ones
  const filtered = commands
    .filter(cmd => {
      const cmdName = typeof cmd === 'string' ? cmd : Object.keys(cmd)[0];
      return !['help', 'exit', 'status'].includes(cmdName.toLowerCase());
    })
    .slice(0, 3)
    .map(cmd => {
      const cmdName = typeof cmd === 'string' ? cmd : Object.keys(cmd)[0];
      // Capitalize and format command names for display
      return cmdName
        .replace(/-/g, ' ')
        .replace(/^create-/, 'Create ')
        .replace(/^analyze-/, 'Analyze ')
        .replace(/^review-/, 'Review ')
        .replace(/\b\w/g, l => l.toUpperCase());
    });
  
  return filtered.length > 0 ? filtered : ['Get Help', 'Ask Question'];
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}