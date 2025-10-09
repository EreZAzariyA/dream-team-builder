/**
 * Agent Team Deployment API
 * Handles deploying agent teams with workflows and project context
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '@/lib/utils/routeAuth.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import AgentTeam from '@/lib/database/models/AgentTeam.js';
// Workflow model will be used for future team-workflow relationship tracking
import BmadOrchestrator from '@/lib/bmad/BmadOrchestrator.js';
import WorkflowParser from '@/lib/bmad/WorkflowParser.js';
import { pusherServer } from '@/lib/pusher/config.js';
import { WorkflowId } from '@/lib/utils/workflowId.js';
import logger from '@/lib/utils/logger.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Configuration cache has been removed

/**
 * @swagger
 * /api/agent-teams/deploy:
 *   post:
 *     summary: Deploy an agent team with a workflow
 *     description: Creates a team deployment instance and launches a workflow with team constraints
 *     tags:
 *       - Agent Teams
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId]
 *             properties:
 *               teamId:
 *                 type: string
 *                 description: Team configuration ID (e.g., "team-fullstack")
 *               workflowId:
 *                 type: string
 *                 description: Selected workflow ID (optional for story-driven teams)
 *               projectContext:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: Project type (e.g., "web-app", "rest-api")
 *                   scope:
 *                     type: string
 *                     description: Project scope (e.g., "mvp", "feature")
 *               userPrompt:
 *                 type: string
 *                 description: Optional initial project prompt. If omitted, agents will ask for clarification during workflow (following official BMAD methodology)
 *     responses:
 *       201:
 *         description: Team deployed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 teamInstanceId:
 *                   type: string
 *                 workflowInstanceId:
 *                   type: string
 *                 teamStatus:
 *                   type: string
 *                 teamName:
 *                   type: string
 *                 selectedWorkflow:
 *                   type: object
 *       400:
 *         description: Invalid request or validation error
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 */
export async function POST(request) {
  try {
    // Authentication check
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    // Parse and validate request body
    const { teamId, workflowId, projectContext = {}, userPrompt } = await request.json();

    // Validate required fields with security checks
    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'teamId is required and must be a string'
      }, { status: 400 });
    }

    // Security: Validate teamId format to prevent path traversal
    if (!/^[a-zA-Z0-9\-_]+$/.test(teamId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid teamId format. Only alphanumeric characters, hyphens, and underscores are allowed.'
      }, { status: 400 });
    }

    // userPrompt is optional - if empty/null, agents will ask for clarification during workflow
    // This follows the official BMAD methodology where workflows can start without detailed descriptions

    await connectMongoose();

    logger.info(`🚀 [TeamDeploy] Starting deployment for team: ${teamId}, user: ${session.user.id}`);

    // STEP 1: Load team configuration from YAML
    const teamConfig = await loadTeamConfig(teamId);
    if (!teamConfig.success) {
      return NextResponse.json({
        success: false,
        error: teamConfig.error,
        details: 'Team configuration not found or invalid'
      }, { status: 400 });
    }

    logger.info(`✅ [TeamDeploy] Team config loaded: ${teamConfig.data.name}`);

    // STEP 2: Validate workflow selection (if provided)
    let selectedWorkflow = null;
    if (workflowId) {
      const workflowValidation = await validateWorkflowForTeam(workflowId, teamConfig.data);
      if (!workflowValidation.success) {
        return NextResponse.json({
          success: false,
          error: workflowValidation.error,
          details: 'Selected workflow is not compatible with this team'
        }, { status: 400 });
      }
      selectedWorkflow = workflowValidation.workflow;
    }

    logger.info(`🔍 [TeamDeploy] Workflow validation: ${workflowId ? 'Specific workflow' : 'Story-driven'}`);

    // STEP 3: Create team deployment instance
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const teamInstanceId = `team-${teamId}-${timestamp}-${randomId}`;
    
    const teamInstance = new AgentTeam({
      teamId: teamId,
      teamInstanceId: teamInstanceId, // Explicitly set the teamInstanceId
      name: teamConfig.data.name,
      description: teamConfig.data.description,
      icon: teamConfig.data.icon || '🤖',
      userId: session.user.id,
      teamConfig: {
        agentIds: teamConfig.data.agents || [],
        availableWorkflows: teamConfig.data.workflows || [],
        constraints: {
          maxConcurrentWorkflows: teamConfig.data.constraints?.maxConcurrentWorkflows || 1,
          allowedProjectTypes: await extractAllowedProjectTypes(teamConfig.data),
          maxWorkflowDuration: teamConfig.data.constraints?.maxWorkflowDuration || 480, // 8 hours
          requiresApproval: teamConfig.data.constraints?.requiresApproval || false,
        },
        capabilities: {
          complexityLevel: determineComplexityLevel(teamConfig.data),
          estimatedSpeed: determineEstimatedSpeed(teamConfig.data),
        },
      },
      deployment: {
        status: 'pending',
        selectedWorkflow: selectedWorkflow ? {
          workflowId: selectedWorkflow.id,
          workflowFile: selectedWorkflow.filename || `${workflowId}.yaml`,
          workflowName: selectedWorkflow.name,
        } : null,
        projectContext: projectContext,
        userPrompt: userPrompt?.trim() || '',
      },
      settings: {
        notifications: {
          onStart: true,
          onComplete: true,
          onError: true,
        },
        automation: {
          autoRetryOnError: true,
          maxRetries: 3,
          autoAdvanceSteps: true,
        },
      },
    });

    await teamInstance.save();
    logger.info(`✅ [TeamDeploy] Team instance created: ${teamInstance.teamInstanceId}`);

    // STEP 4: Validate team can execute workflow (constraint checking)
    const constraintValidation = await validateTeamConstraints(teamInstance, selectedWorkflow);
    if (!constraintValidation.success) {
      await teamInstance.fail(constraintValidation.error, {
        validationErrors: constraintValidation.details,
      });

      return NextResponse.json({
        success: false,
        error: constraintValidation.error,
        details: constraintValidation.details,
        teamInstanceId: teamInstance.teamInstanceId,
      }, { status: 400 });
    }

    logger.info(`✅ [TeamDeploy] Team constraints validated`);

    // STEP 5: Start workflow execution with team context
    teamInstance.deployment.status = 'deploying';
    await teamInstance.save();

    let workflowResult = null;
    let workflowChannelName = null;
    let teamChannelName = null;

    try {
      const orchestrator = new BmadOrchestrator();
      await orchestrator.initialize();

      // For story-driven teams (no workflow), use a default workflow or direct agent interaction
      const workflowTemplate = workflowId || teamConfig.data.defaultWorkflow || 'greenfield-fullstack';

      // Start workflow - WorkflowLifecycleManager already handles async execution
      let workflowResult;
      try {
        // Use userPrompt if provided, otherwise let agents initiate conversation naturally
        const workflowPrompt = (userPrompt && userPrompt.trim()) || "Hello! I'd like to start working on a project. Can you help me get started?";
        
        workflowResult = await orchestrator.startWorkflow(workflowPrompt, {
          workflowId: null, // Let it generate one
          sequence: workflowTemplate,
          name: `${teamConfig.data.name} - ${projectContext.type || 'Custom'} Project`,
          description: `Team deployment: ${teamConfig.data.name}`,
          userId: session.user.id,
          templateId: workflowTemplate,
          // Team-specific context
          teamContext: {
            teamInstanceId: teamInstance.teamInstanceId,
            teamId: teamId,
            teamName: teamConfig.data.name,
            availableAgents: teamConfig.data.agents,
            projectContext: projectContext,
          },
        });

        logger.info(`✅ [TeamDeploy] Workflow started successfully: ${workflowResult.workflowId}`);
        
      } catch (workflowStartError) {
        logger.error(`❌ [TeamDeploy] Failed to start workflow:`, workflowStartError);
        
        // Enhanced error recovery with proper cleanup
        try {
          await teamInstance.fail(`Failed to start workflow: ${workflowStartError.message}`, {
            workflowError: workflowStartError.message,
            workflowTemplate,
            timestamp: new Date().toISOString(),
            step: 'workflow_start',
          });
          
          // Clean up any orphaned resources
          await cleanupFailedDeployment(teamInstance.teamInstanceId, null);
          
        } catch (cleanupError) {
          logger.error(`❌ [TeamDeploy] Cleanup failed:`, cleanupError);
        }

        return NextResponse.json({
          success: false,
          error: `Failed to start workflow: ${workflowStartError.message}`,
          details: {
            workflowTemplate,
            teamInstanceId: teamInstance.teamInstanceId,
            step: 'workflow_start',
          },
        }, { status: 500 });
      }

      // STEP 6: Update team deployment with workflow instance
      await teamInstance.start(workflowResult.workflowId);

      // STEP 7: Send real-time notifications with error handling
      workflowChannelName = WorkflowId.toChannelName(workflowResult.workflowId);
      teamChannelName = `team-${teamInstance.teamInstanceId}`;
      
      try {
        await Promise.all([
          pusherServer.trigger(workflowChannelName, 'team-deployed', {
            teamInstanceId: teamInstance.teamInstanceId,
            teamName: teamConfig.data.name,
            workflowInstanceId: workflowResult.workflowId,
            status: 'active',
            agents: teamConfig.data.agents,
            selectedWorkflow: selectedWorkflow,
            timestamp: new Date().toISOString(),
          }),
          pusherServer.trigger(teamChannelName, 'deployment-started', {
            teamInstanceId: teamInstance.teamInstanceId,
            workflowInstanceId: workflowResult.workflowId,
            status: 'active',
            message: `${teamConfig.data.name} deployment started successfully`,
            timestamp: new Date().toISOString(),
          })
        ]);
      } catch (notificationError) {
        logger.warn(`⚠️ [TeamDeploy] Notification failed (non-critical):`, notificationError);
        // Continue deployment even if notifications fail
      }

      logger.info(`🎯 [TeamDeploy] Team deployment completed successfully`);

      // Return success response
      return NextResponse.json({
        success: true,
        message: 'Team deployed successfully',
        teamInstanceId: teamInstance.teamInstanceId,
        workflowInstanceId: workflowResult.workflowId,
        teamStatus: 'active',
        teamName: teamConfig.data.name,
        selectedWorkflow: selectedWorkflow,
        realTimeChannels: {
          workflow: workflowChannelName,
          team: teamChannelName,
        },
        deployment: {
          createdAt: teamInstance.deployment.createdAt,
          deployedAt: teamInstance.deployment.deployedAt,
          projectContext: projectContext,
        },
        metadata: {
          bmadEnabled: true,
          teamMode: true,
          agentCount: teamConfig.data.agents?.length || 0,
        },
      }, { status: 201 });

    } catch (orchestratorError) {
      logger.error(`❌ [TeamDeploy] Workflow execution failed:`, orchestratorError);

      // Enhanced error recovery with proper cleanup
      try {
        await teamInstance.fail(orchestratorError.message, {
          orchestratorError: orchestratorError.message,
          timestamp: new Date().toISOString(),
          step: 'workflow_execution',
        });

        // Clean up orphaned resources (channels, workflows, etc.)
        await cleanupFailedDeployment(
          teamInstance.teamInstanceId, 
          workflowResult?.workflowId,
          workflowChannelName,
          teamChannelName
        );

      } catch (cleanupError) {
        logger.error(`❌ [TeamDeploy] Post-failure cleanup failed:`, cleanupError);
      }

      return NextResponse.json({
        success: false,
        error: 'Team deployment failed during workflow execution',
        details: orchestratorError.message,
        teamInstanceId: teamInstance.teamInstanceId,
        teamStatus: 'failed',
        step: 'workflow_execution',
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('❌ [TeamDeploy] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Unexpected server error during team deployment',
      details: error.message,
    }, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve team deployment status
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false,
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamInstanceId = searchParams.get('teamInstanceId');

    if (!teamInstanceId) {
      return NextResponse.json({
        success: false,
        error: 'teamInstanceId parameter is required'
      }, { status: 400 });
    }

    await connectMongoose();

    const teamInstance = await AgentTeam.findOne({ 
      teamInstanceId,
      userId: session.user.id, // Ensure user can only access their own teams
    });

    if (!teamInstance) {
      return NextResponse.json({
        success: false,
        error: 'Team deployment not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      teamInstance: {
        teamInstanceId: teamInstance.teamInstanceId,
        teamId: teamInstance.teamId,
        name: teamInstance.name,
        status: teamInstance.deployment.status,
        workflowInstanceId: teamInstance.deployment.workflowInstanceId,
        selectedWorkflow: teamInstance.deployment.selectedWorkflow,
        projectContext: teamInstance.deployment.projectContext,
        createdAt: teamInstance.deployment.createdAt,
        deployedAt: teamInstance.deployment.deployedAt,
        completedAt: teamInstance.deployment.completedAt,
        duration: teamInstance.duration,
        progress: teamInstance.deploymentProgress,
        hasIssues: teamInstance.hasUnresolvedIssues,
        agents: teamInstance.teamConfig.agentIds,
      }
    });

  } catch (error) {
    logger.error('❌ [TeamDeploy] GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve team deployment status',
      details: error.message,
    }, { status: 500 });
  }
}

// Helper Functions

/**
 * Load team configuration from YAML file with caching and security
 */
async function loadTeamConfig(teamId) {
  try {
    const teamConfigPath = path.join(process.cwd(), '.bmad-core', 'agent-teams', `${teamId}.yaml`);
    
    // Use async file operations to prevent blocking
    try {
      await fs.access(teamConfigPath);
    } catch (accessError) {
      return {
        success: false,
        error: `Team configuration not found: ${teamId}`,
      };
    }

    const yamlContent = await fs.readFile(teamConfigPath, 'utf8');
    
    // Security: Use safe YAML loading to prevent YAML bombs
    const teamData = yaml.load(yamlContent, { 
      schema: yaml.FAILSAFE_SCHEMA,
      json: false 
    });

    if (!teamData || !teamData.bundle) {
      return {
        success: false,
        error: `Invalid team configuration format: ${teamId}`,
      };
    }

    const result = {
      success: true,
      data: {
        name: teamData.bundle.name,
        description: teamData.bundle.description,
        icon: teamData.bundle.icon,
        agents: teamData.agents || [],
        workflows: teamData.workflows || [],
        defaultWorkflow: teamData.bundle.defaultWorkflow,
        constraints: teamData.bundle.constraints,
      },
    };

    return result;

  } catch (error) {
    logger.error(`Failed to load team config ${teamId}:`, error);
    return {
      success: false,
      error: `Failed to load team configuration: ${error.message}`,
    };
  }
}

/**
 * Validate that a workflow is compatible with a team
 */
async function validateWorkflowForTeam(workflowId, teamConfig) {
  try {
    // Check if workflow is in team's available workflows list
    const workflowFile = `${workflowId}.yaml`;
    if (!teamConfig.workflows.includes(workflowFile)) {
      return {
        success: false,
        error: `Workflow ${workflowId} is not available for this team`,
      };
    }

    // Load workflow metadata to get more details
    const workflowParser = new WorkflowParser();
    const workflowExists = await workflowParser.workflowExists(workflowId);
    
    if (!workflowExists) {
      return {
        success: false,
        error: `Workflow ${workflowId} does not exist`,
      };
    }

    // Parse workflow to check agent requirements
    const workflowData = await workflowParser.parseWorkflowFile(workflowId);
    
    return {
      success: true,
      workflow: {
        id: workflowId,
        name: workflowData.name,
        description: workflowData.description,
        type: workflowData.type,
        projectTypes: workflowData.projectTypes,
        requiredAgents: extractCoreRequiredAgents(workflowData.steps || []),
        filename: workflowFile,
      },
    };

  } catch (error) {
    logger.error(`Workflow validation error for ${workflowId}:`, error);
    return {
      success: false,
      error: `Failed to validate workflow: ${error.message}`,
    };
  }
}

/**
 * Validate team constraints and capabilities
 */
async function validateTeamConstraints(teamInstance, selectedWorkflow) {
  try {
    const teamAgents = teamInstance.teamConfig.agentIds;
    
    // For teams without a specific workflow, skip agent validation (story-driven)
    if (!selectedWorkflow || !selectedWorkflow.requiredAgents || selectedWorkflow.requiredAgents.length === 0) {
      logger.info(`✅ [TeamValidation] Story-driven team validation (no specific workflow requirements)`);
      return { success: true, message: 'Story-driven team - no specific agent requirements' };
    }
    
    // Team-friendly validation: Focus on capability rather than exact agent matching
    const teamCapabilities = analyzeTeamCapabilities(teamAgents);
    const workflowNeeds = analyzeWorkflowNeeds(selectedWorkflow.requiredAgents);
    
    logger.info(`🔍 [TeamValidation] Team: ${JSON.stringify(teamCapabilities.agents)}`);
    logger.info(`🔍 [TeamValidation] Workflow needs: ${JSON.stringify(workflowNeeds)}`);
    
    const missingCapabilities = [];
    const satisfiedRequirements = [];
    
    // Check compound agent requirements flexibly
    if (workflowNeeds.compoundOptions && workflowNeeds.compoundOptions.length > 0) {
      for (const options of workflowNeeds.compoundOptions) {
        const hasAnyOption = options.some(option => teamAgents.includes(option));
        if (hasAnyOption) {
          satisfiedRequirements.push(`Has one of: ${options.join(' OR ')}`);
        } else {
          // Only fail if this is a truly critical requirement
          const isCritical = options.some(opt => ['dev', 'qa'].includes(opt));
          if (isCritical) {
            missingCapabilities.push(`Missing any of: ${options.join(' OR ')}`);
          }
        }
      }
    }
    
    // Check individual agent requirements flexibly
    const individualRequirements = workflowNeeds.requiredAgents.filter(agent => 
      !workflowNeeds.compoundOptions.some(compound => compound.includes(agent))
    );
    
    for (const requiredAgent of individualRequirements) {
      if (teamAgents.includes(requiredAgent)) {
        satisfiedRequirements.push(`Has ${requiredAgent}`);
      } else {
        // Only fail for truly critical individual agents
        if (['dev', 'qa'].includes(requiredAgent)) {
          missingCapabilities.push(`Missing ${requiredAgent}`);
        }
      }
    }
    
    // Handle wildcard teams (team-all with '*')
    const hasWildcard = teamAgents.includes('*');
    
    // Very lenient validation - accept teams with wildcard or basic capability
    const hasCoreDevCapability = hasWildcard || teamAgents.some(agent => ['dev', 'sm', 'qa'].includes(agent));
    const hasBasicCapability = hasWildcard || teamAgents.some(agent => ['architect', 'pm', 'analyst', 'po'].includes(agent));
    
    // Accept teams that have either development capability OR basic planning/architecture capability
    // The BMAD system can adapt and assign development tasks appropriately
    if (!hasCoreDevCapability && !hasBasicCapability) {
      logger.error(`❌ [TeamValidation] Team capability check failed - hasDev: ${hasCoreDevCapability}, hasBasic: ${hasBasicCapability}`);
      return {
        success: false,
        error: 'Team has insufficient capability for development workflows',
        details: {
          reason: 'Team needs either development agents (dev, sm, qa) or planning agents (architect, pm, analyst, po)',
          availableAgents: teamAgents,
          suggestion: 'Teams should have some form of development or planning capability',
        },
      };
    }
    
    // Log successful validation
    logger.info(`✅ [TeamValidation] Team validation passed - hasDev: ${hasCoreDevCapability}, hasBasic: ${hasBasicCapability}`);
    logger.info(`✅ [TeamValidation] Satisfied requirements: ${satisfiedRequirements.join(', ')}`);
    
    // Check if user has any other active team deployments (constraint)
    const activeDeployments = await AgentTeam.find({
      userId: teamInstance.userId,
      'deployment.status': { $in: ['validating', 'deploying', 'active'] },
      teamInstanceId: { $ne: teamInstance.teamInstanceId },
    });

    const maxConcurrent = teamInstance.teamConfig.constraints.maxConcurrentWorkflows || 1;
    if (activeDeployments.length >= maxConcurrent) {
      return {
        success: false,
        error: `Maximum concurrent deployments reached (${maxConcurrent}). Please complete or cancel existing deployments.`,
        details: {
          maxConcurrent,
          currentActive: activeDeployments.length,
          activeDeployments: activeDeployments.map(d => ({
            teamInstanceId: d.teamInstanceId,
            teamName: d.name,
            status: d.deployment.status,
          })),
        },
      };
    }

    return {
      success: true,
      message: 'Team capabilities are compatible with workflow requirements',
      details: {
        satisfiedRequirements,
        teamCapabilities,
        workflowNeeds,
        validation: 'flexible-capability-based',
      },
    };

  } catch (error) {
    logger.error('Constraint validation error:', error);
    return {
      success: false,
      error: `Constraint validation failed: ${error.message}`,
    };
  }
}

/**
 * Extract allowed project types from team configuration
 */
async function extractAllowedProjectTypes(teamConfig) {
  const workflowProjectTypes = new Set();
  const workflowParser = new WorkflowParser();

  if (teamConfig.workflows) {
    for (const workflowFile of teamConfig.workflows) {
      const workflowId = workflowFile.replace('.yaml', '');
      try {
        const workflowData = await workflowParser.parseWorkflowFile(workflowId);
        if (workflowData.projectTypes) {
          workflowData.projectTypes.forEach(pt => workflowProjectTypes.add(pt));
        }
      } catch (error) {
        logger.warn(`Could not parse workflow ${workflowId} to extract project types:`, error.message);
      }
    }
  }

  return Array.from(workflowProjectTypes);
}

/**
 * Determine complexity level based on team configuration
 */
function determineComplexityLevel(teamConfig) {
  const agentCount = teamConfig.agents?.length || 0;
  const workflowCount = teamConfig.workflows?.length || 0;
  
  if (agentCount <= 3 && workflowCount <= 2) return 'simple';
  if (agentCount <= 6 && workflowCount <= 4) return 'moderate';
  if (agentCount <= 8 && workflowCount <= 6) return 'complex';
  return 'enterprise';
}

/**
 * Determine estimated speed based on team configuration
 */
function determineEstimatedSpeed(teamConfig) {
  const agentCount = teamConfig.agents?.length || 0;
  
  // More agents generally means more comprehensive but slower
  if (agentCount <= 4) return 'fast';
  if (agentCount <= 7) return 'medium';
  return 'comprehensive';
}

/**
 * Extract core required agents from workflow steps, ignoring optional and flexible agents
 */
function extractCoreRequiredAgents(workflowSteps) {
  const coreAgents = new Set();
  
  for (const step of workflowSteps) {
    if (!step.agentId) continue;
    
    // Skip system and orchestration agents
    if (step.agentId === 'bmad-orchestrator' || step.agentId === 'system') {
      continue;
    }
    
    // Skip flexible agent assignments
    if (step.agentId === 'various') {
      continue;
    }
    
    // Skip optional steps (teams can adapt without these)
    if (step.optional === true) {
      continue;
    }
    
    // Skip workflow control steps
    if (step.type === 'workflow_control' || step.skip === true) {
      continue;
    }
    
    // For compound agents (pm/architect), extract all options
    if (step.agentId.includes('/')) {
      // Don't add compound agents as "required" - teams should be flexible
      // The validation logic will handle checking if team has ANY of the options
      continue;
    }
    
    // Add core single-agent requirements
    coreAgents.add(step.agentId);
  }
  
  return Array.from(coreAgents);
}

/**
 * Analyze team capabilities by grouping agents into capability categories
 */
function analyzeTeamCapabilities(teamAgents) {
  const planningAgents = ['analyst', 'pm', 'po'];
  const architectureAgents = ['architect'];
  const developmentAgents = ['dev', 'sm', 'qa'];
  const uxAgents = ['ux-expert'];
  
  return {
    hasPlanning: teamAgents.some(agent => planningAgents.includes(agent)),
    hasArchitecture: teamAgents.some(agent => architectureAgents.includes(agent)),
    hasDevelopment: teamAgents.some(agent => developmentAgents.includes(agent)),
    hasUX: teamAgents.some(agent => uxAgents.includes(agent)),
    agentCount: teamAgents.length,
    agents: teamAgents,
    
    // Specific agent availability
    hasAnalyst: teamAgents.includes('analyst'),
    hasPM: teamAgents.includes('pm'),
    hasArchitect: teamAgents.includes('architect'),
    hasDev: teamAgents.includes('dev'),
    hasSM: teamAgents.includes('sm'),
    hasQA: teamAgents.includes('qa'),
  };
}

/**
 * Analyze what capabilities a workflow needs based on its required agents
 */
function analyzeWorkflowNeeds(requiredAgents) {
  if (!requiredAgents || requiredAgents.length === 0) {
    return {
      needsPlanning: false,
      needsArchitecture: false,
      needsDevelopment: false,
      requiredAgents: [],
    };
  }

  const planningAgents = ['analyst', 'pm', 'po'];
  const architectureAgents = ['architect'];
  const developmentAgents = ['dev', 'sm', 'qa'];
  
  const flatAgents = [];
  const compoundOptions = [];
  
  // Process each required agent
  for (const agent of requiredAgents) {
    // Skip flexible/optional agents
    if (agent === 'various' || agent === 'system' || agent === 'bmad-orchestrator') {
      continue;
    }
    
    if (agent.includes('/')) {
      // Handle compound agents (pm/architect -> team needs either pm OR architect)
      const options = agent.split('/').map(a => a.trim());
      compoundOptions.push(options);
      flatAgents.push(...options); // Add all options for capability analysis
    } else {
      flatAgents.push(agent);
    }
  }
  
  return {
    needsPlanning: flatAgents.some(agent => planningAgents.includes(agent)),
    needsArchitecture: flatAgents.some(agent => architectureAgents.includes(agent)),
    needsDevelopment: flatAgents.some(agent => developmentAgents.includes(agent)),
    requiredAgents: flatAgents,
    compoundOptions, // For flexible validation
  };
}

/**
 * Clean up resources from failed deployments
 */
async function cleanupFailedDeployment(teamInstanceId, workflowId = null, workflowChannel = null, teamChannel = null) {
  try {
    logger.info(`🧹 [Cleanup] Starting cleanup for failed deployment: ${teamInstanceId}`);

    const cleanupTasks = [];

    // Clean up Pusher channels if they were created
    if (workflowChannel) {
      cleanupTasks.push(
        pusherServer.trigger(workflowChannel, 'deployment-failed', {
          teamInstanceId,
          status: 'cleanup',
          message: 'Deployment failed - cleaning up resources',
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('Failed to send cleanup notification to workflow channel:', err))
      );
    }

    if (teamChannel) {
      cleanupTasks.push(
        pusherServer.trigger(teamChannel, 'deployment-failed', {
          teamInstanceId,
          status: 'cleanup',
          message: 'Deployment failed - cleaning up resources',
          timestamp: new Date().toISOString(),
        }).catch(err => logger.warn('Failed to send cleanup notification to team channel:', err))
      );
    }

    // If workflow was started but deployment failed, try to cancel it
    if (workflowId) {
      try {
        const orchestrator = new BmadOrchestrator();
        await orchestrator.initialize();
        await orchestrator.cancelWorkflow(workflowId);
        logger.info(`✅ [Cleanup] Cancelled orphaned workflow: ${workflowId}`);
      } catch (workflowCleanupError) {
        logger.warn(`⚠️ [Cleanup] Failed to cancel workflow ${workflowId}:`, workflowCleanupError);
      }
    }

    // Wait for all cleanup tasks to complete
    await Promise.allSettled(cleanupTasks);
    
    logger.info(`✅ [Cleanup] Completed cleanup for: ${teamInstanceId}`);

  } catch (cleanupError) {
    logger.error(`❌ [Cleanup] Cleanup failed for ${teamInstanceId}:`, cleanupError);
  }
}

/**
 * Cache invalidation helper
 */
function invalidateConfigCache(teamId = null) {
  if (teamId) {
    const cacheKey = `team-config-${teamId}`;
    configCache.delete(cacheKey);
    logger.info(`🗑️ [Cache] Invalidated cache for team: ${teamId}`);
  } else {
    // Clear entire cache
    configCache.clear();
    logger.info(`🗑️ [Cache] Cleared entire configuration cache`);
  }
}