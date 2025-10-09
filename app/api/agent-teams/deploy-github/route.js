/**
 * GitHub Agent Team Deployment API
 * Handles deploying agent teams with GitHub repository integration
 */

import { NextResponse } from 'next/server';
import { authenticateRoute } from '@/lib/utils/routeAuth.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import AgentTeam from '@/lib/database/models/AgentTeam.js';
import BmadOrchestrator from '@/lib/bmad/BmadOrchestrator.js';
import WorkflowParser from '@/lib/bmad/WorkflowParser.js';
import { pusherServer } from '@/lib/pusher/config.js';
import { WorkflowId } from '@/lib/utils/workflowId.js';
import logger from '@/lib/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

// Configuration cache has been removed

/**
 * @swagger
 * /api/agent-teams/deploy-github:
 *   post:
 *     summary: Deploy an agent team with GitHub repository integration
 *     description: Creates a GitHub-integrated team deployment that can analyze repos, create branches, and commit changes
 *     tags:
 *       - Agent Teams
 *       - GitHub Integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teamId, projectContext]
 *             properties:
 *               teamId:
 *                 type: string
 *                 description: Team configuration ID (e.g., "team-fullstack")
 *               workflowId:
 *                 type: string
 *                 description: Selected workflow ID (optional for story-driven teams)
 *               projectContext:
 *                 type: object
 *                 required: [githubMode, repository]
 *                 properties:
 *                   type:
 *                     type: string
 *                     description: Project type (e.g., "web-app", "rest-api")
 *                   scope:
 *                     type: string
 *                     description: Project scope (e.g., "mvp", "feature")
 *                   githubMode:
 *                     type: boolean
 *                     description: Must be true for GitHub deployment
 *                   repository:
 *                     type: object
 *                     required: [id, name, full_name, owner]
 *                     properties:
 *                       id:
 *                         type: number
 *                         description: GitHub repository ID
 *                       name:
 *                         type: string
 *                         description: Repository name
 *                       full_name:
 *                         type: string
 *                         description: Full repository name (owner/name)
 *                       owner:
 *                         type: object
 *                         required: [login]
 *                         properties:
 *                           login:
 *                             type: string
 *                             description: Repository owner username
 *                       private:
 *                         type: boolean
 *                         description: Whether repository is private
 *                       language:
 *                         type: string
 *                         description: Primary repository language
 *                   targetBranch:
 *                     type: string
 *                     description: Branch to work on (default: main)
 *               userPrompt:
 *                 type: string
 *                 description: Optional initial project prompt with repository-specific instructions
 *     responses:
 *       201:
 *         description: GitHub team deployed successfully
 *       400:
 *         description: Invalid request or validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: GitHub access required
 *       500:
 *         description: Server error
 */
export async function POST(request) {
  try {
    // Authentication check
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    // Check GitHub access
    if (!session?.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'GitHub access required',
        details: 'This feature requires GitHub OAuth authentication'
      }, { status: 403 });
    }

    // Parse and validate request body
    const { teamId, workflowId, projectContext = {}, userPrompt } = await request.json();

    // Validate required fields
    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'teamId is required and must be a string'
      }, { status: 400 });
    }

    // Validate GitHub mode
    if (!projectContext.githubMode) {
      return NextResponse.json({
        success: false,
        error: 'GitHub mode is required for this endpoint'
      }, { status: 400 });
    }

    // Validate repository information
    if (!projectContext.repository || !projectContext.repository.id || !projectContext.repository.full_name) {
      return NextResponse.json({
        success: false,
        error: 'Repository information is required for GitHub deployment'
      }, { status: 400 });
    }

    // Security: Validate teamId format to prevent path traversal
    if (!/^[a-zA-Z0-9\-_]+$/.test(teamId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid teamId format'
      }, { status: 400 });
    }

    await connectMongoose();

    logger.info(`🐙 [GitHubDeploy] Starting GitHub deployment for team: ${teamId}, repo: ${projectContext.repository.full_name}, user: ${session.user.id}`);

    // STEP 1: Load team configuration from YAML
    const teamConfig = await loadTeamConfig(teamId);
    if (!teamConfig.success) {
      return NextResponse.json({
        success: false,
        error: teamConfig.error,
        details: 'Team configuration not found or invalid'
      }, { status: 400 });
    }

    logger.info(`✅ [GitHubDeploy] Team config loaded: ${teamConfig.data.name}`);

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

    // STEP 3: Validate GitHub repository access
    const repoValidation = await validateGitHubRepository(projectContext.repository, session.accessToken);
    if (!repoValidation.success) {
      return NextResponse.json({
        success: false,
        error: repoValidation.error,
        details: 'GitHub repository validation failed'
      }, { status: 400 });
    }

    logger.info(`✅ [GitHubDeploy] Repository validated: ${projectContext.repository.full_name}`);

    // STEP 4: Create GitHub team deployment instance
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const teamInstanceId = `github-team-${teamId}-${timestamp}-${randomId}`;
    
    const teamInstance = new AgentTeam({
      teamId: teamId,
      teamInstanceId: teamInstanceId,
      name: `${teamConfig.data.name} + GitHub`,
      description: `${teamConfig.data.description} with GitHub integration for ${projectContext.repository.full_name}`,
      icon: '🐙', // GitHub octopus
      userId: session.user.id,
      teamConfig: {
        agentIds: teamConfig.data.agents || [],
        availableWorkflows: teamConfig.data.workflows || [],
        githubIntegration: {
          enabled: true,
          repository: projectContext.repository,
          targetBranch: projectContext.targetBranch || 'main',
          accessToken: session.accessToken, // Store securely
          capabilities: getGitHubCapabilities(teamConfig.data.agents)
        },
        constraints: {
          maxConcurrentWorkflows: teamConfig.data.constraints?.maxConcurrentWorkflows || 1,
          allowedProjectTypes: await extractAllowedProjectTypes(teamConfig.data),
          maxWorkflowDuration: teamConfig.data.constraints?.maxWorkflowDuration || 480,
          requiresApproval: teamConfig.data.constraints?.requiresApproval || false,
        },
        capabilities: {
          complexityLevel: determineComplexityLevel(teamConfig.data),
          estimatedSpeed: determineEstimatedSpeed(teamConfig.data),
          githubCapabilities: getGitHubCapabilities(teamConfig.data.agents)
        },
      },
      deployment: {
        status: 'pending',
        mode: 'github',
        selectedWorkflow: selectedWorkflow ? {
          workflowId: selectedWorkflow.id,
          workflowFile: selectedWorkflow.filename || `${workflowId}.yaml`,
          workflowName: selectedWorkflow.name,
        } : null,
        projectContext: {
          ...projectContext,
          repository: {
            id: projectContext.repository.id,
            name: projectContext.repository.name,
            full_name: projectContext.repository.full_name,
            owner: projectContext.repository.owner.login,
            private: projectContext.repository.private,
            language: projectContext.repository.language
          }
        },
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
    logger.info(`✅ [GitHubDeploy] GitHub team instance created: ${teamInstance.teamInstanceId}`);

    // STEP 5: Validate team constraints
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

    // STEP 6: Start GitHub-enhanced workflow execution
    teamInstance.deployment.status = 'deploying';
    await teamInstance.save();

    let workflowResult = null;
    let workflowChannelName = null;
    let teamChannelName = null;

    try {
      const orchestrator = new BmadOrchestrator();
      await orchestrator.initialize();

      // Enhanced workflow template selection for GitHub
      const workflowTemplate = workflowId || teamConfig.data.defaultWorkflow || 'greenfield-fullstack';

      // Create GitHub-aware workflow prompt
      const githubContextPrompt = createGitHubWorkflowPrompt(
        userPrompt,
        projectContext.repository,
        projectContext.targetBranch,
        teamConfig.data.name
      );

      workflowResult = await orchestrator.startWorkflow(githubContextPrompt, {
        workflowId: null,
        sequence: workflowTemplate,
        name: `GitHub: ${teamConfig.data.name} - ${projectContext.repository.name}`,
        description: `GitHub-integrated team deployment for ${projectContext.repository.full_name}`,
        userId: session.user.id,
        templateId: workflowTemplate,
        // Enhanced team context with GitHub integration
        teamContext: {
          teamInstanceId: teamInstance.teamInstanceId,
          teamId: teamId,
          teamName: teamConfig.data.name,
          availableAgents: teamConfig.data.agents,
          projectContext: projectContext,
          githubIntegration: {
            enabled: true,
            repository: projectContext.repository,
            targetBranch: projectContext.targetBranch || 'main',
            accessToken: session.accessToken,
            capabilities: getGitHubCapabilities(teamConfig.data.agents)
          }
        },
      });

      logger.info(`✅ [GitHubDeploy] GitHub workflow started successfully: ${workflowResult.workflowId}`);
      
    } catch (workflowStartError) {
      logger.error(`❌ [GitHubDeploy] Failed to start GitHub workflow:`, workflowStartError);
      
      try {
        await teamInstance.fail(`Failed to start GitHub workflow: ${workflowStartError.message}`, {
          workflowError: workflowStartError.message,
          workflowTemplate,
          repository: projectContext.repository.full_name,
          timestamp: new Date().toISOString(),
          step: 'github_workflow_start',
        });
        
        await cleanupFailedDeployment(teamInstance.teamInstanceId, null);
        
      } catch (cleanupError) {
        logger.error(`❌ [GitHubDeploy] Cleanup failed:`, cleanupError);
      }

      return NextResponse.json({
        success: false,
        error: `Failed to start GitHub workflow: ${workflowStartError.message}`,
        details: {
          workflowTemplate,
          teamInstanceId: teamInstance.teamInstanceId,
          repository: projectContext.repository.full_name,
          step: 'github_workflow_start',
        },
      }, { status: 500 });
    }

    // STEP 7: Update team deployment with workflow instance
    await teamInstance.start(workflowResult.workflowId);

    // STEP 8: Send GitHub-specific real-time notifications
    workflowChannelName = WorkflowId.toChannelName(workflowResult.workflowId);
    teamChannelName = `team-${teamInstance.teamInstanceId}`;
    
    try {
      await Promise.all([
        pusherServer.trigger(workflowChannelName, 'github-team-deployed', {
          teamInstanceId: teamInstance.teamInstanceId,
          teamName: `${teamConfig.data.name} + GitHub`,
          workflowInstanceId: workflowResult.workflowId,
          status: 'active',
          agents: teamConfig.data.agents,
          selectedWorkflow: selectedWorkflow,
          repository: projectContext.repository,
          targetBranch: projectContext.targetBranch,
          githubCapabilities: getGitHubCapabilities(teamConfig.data.agents),
          timestamp: new Date().toISOString(),
        }),
        pusherServer.trigger(teamChannelName, 'github-deployment-started', {
          teamInstanceId: teamInstance.teamInstanceId,
          workflowInstanceId: workflowResult.workflowId,
          status: 'active',
          message: `${teamConfig.data.name} + GitHub deployment started for ${projectContext.repository.full_name}`,
          repository: projectContext.repository,
          timestamp: new Date().toISOString(),
        })
      ]);
    } catch (notificationError) {
      logger.warn(`⚠️ [GitHubDeploy] Notification failed (non-critical):`, notificationError);
    }

    logger.info(`🎯 [GitHubDeploy] GitHub team deployment completed successfully`);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'GitHub team deployed successfully',
      teamInstanceId: teamInstance.teamInstanceId,
      workflowInstanceId: workflowResult.workflowId,
      teamStatus: 'active',
      teamName: `${teamConfig.data.name} + GitHub`,
      selectedWorkflow: selectedWorkflow,
      repository: projectContext.repository,
      githubCapabilities: getGitHubCapabilities(teamConfig.data.agents),
      realTimeChannels: {
        workflow: workflowChannelName,
        team: teamChannelName,
      },
      deployment: {
        createdAt: teamInstance.deployment.createdAt,
        deployedAt: teamInstance.deployment.deployedAt,
        projectContext: projectContext,
        mode: 'github'
      },
      metadata: {
        bmadEnabled: true,
        teamMode: true,
        githubMode: true,
        agentCount: teamConfig.data.agents?.length || 0,
      },
    }, { status: 201 });

  } catch (error) {
    logger.error('❌ [GitHubDeploy] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Unexpected server error during GitHub team deployment',
      details: error.message,
    }, { status: 500 });
  }
}

// Helper Functions (reusing from deploy/route.js with GitHub enhancements)

/**
 * Load team configuration from YAML file with caching and security
 */
async function loadTeamConfig(teamId) {
  try {
    const teamConfigPath = path.join(process.cwd(), '.bmad-core', 'agent-teams', `${teamId}.yaml`);
    
    try {
      await fs.access(teamConfigPath);
    } catch (accessError) {
      return {
        success: false,
        error: `Team configuration not found: ${teamId}`,
      };
    }

    const yamlContent = await fs.readFile(teamConfigPath, 'utf8');
    
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
 * Validate GitHub repository access and information
 */
async function validateGitHubRepository(repository, accessToken) {
  try {
    // Basic validation of repository object
    if (!repository.id || !repository.full_name || !repository.owner?.login) {
      return {
        success: false,
        error: 'Invalid repository information provided'
      };
    }

    // For now, trust the repository info since it came from GitHub API
    // In production, you might want to verify access by making a GitHub API call
    
    logger.info(`🔍 [GitHubValidation] Repository validated: ${repository.full_name} (${repository.private ? 'private' : 'public'})`);
    
    return {
      success: true,
      repository: {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: repository.owner.login,
        private: repository.private,
        language: repository.language
      }
    };

  } catch (error) {
    logger.error(`GitHub repository validation failed:`, error);
    return {
      success: false,
      error: `Repository validation failed: ${error.message}`
    };
  }
}

/**
 * Get GitHub-specific capabilities based on team agents
 */
function getGitHubCapabilities(agents) {
  const capabilities = ['repository-analysis', 'branch-creation', 'file-commits'];
  
  if (agents?.includes('developer') || agents?.includes('dev')) {
    capabilities.push('code-generation', 'automated-testing');
  }
  
  if (agents?.includes('architect')) {
    capabilities.push('system-design', 'documentation-generation');
  }
  
  if (agents?.includes('analyst')) {
    capabilities.push('requirements-analysis', 'issue-creation');
  }
  
  if (agents?.includes('qa')) {
    capabilities.push('test-automation', 'quality-assurance');
  }
  
  return capabilities;
}

/**
 * Create GitHub-aware workflow prompt
 */
function createGitHubWorkflowPrompt(userPrompt, repository, targetBranch, teamName) {
  const basePrompt = userPrompt?.trim() || "Hello! I'd like to start working on a GitHub repository project.";
  
  const githubContext = `

🐙 GitHub Repository Context:
- Repository: ${repository.full_name}
- Primary Language: ${repository.language || 'Not specified'}
- Repository Type: ${repository.private ? 'Private' : 'Public'}
- Target Branch: ${targetBranch || 'main'}
- Team: ${teamName}

The team has GitHub integration capabilities and can:
- Analyze the repository structure and codebase
- Create and work with branches
- Make commits and push changes
- Generate documentation and tests
- Create issues and pull requests

Please analyze the repository and work with the user on their requirements.`;

  return basePrompt + githubContext;
}

// Import additional helper functions from deploy/route.js
async function validateWorkflowForTeam(workflowId, teamConfig) {
  try {
    const workflowFile = `${workflowId}.yaml`;
    if (!teamConfig.workflows.includes(workflowFile)) {
      return {
        success: false,
        error: `Workflow ${workflowId} is not available for this team`,
      };
    }

    const workflowParser = new WorkflowParser();
    const workflowExists = await workflowParser.workflowExists(workflowId);
    
    if (!workflowExists) {
      return {
        success: false,
        error: `Workflow ${workflowId} does not exist`,
      };
    }

    const workflowData = await workflowParser.parseWorkflowFile(workflowId);
    
    return {
      success: true,
      workflow: {
        id: workflowId,
        name: workflowData.name,
        description: workflowData.description,
        type: workflowData.type,
        projectTypes: workflowData.projectTypes,
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

async function validateTeamConstraints(teamInstance, selectedWorkflow) {
  // Simplified validation for GitHub teams
  try {
    const activeDeployments = await AgentTeam.find({
      userId: teamInstance.userId,
      'deployment.status': { $in: ['validating', 'deploying', 'active'] },
      teamInstanceId: { $ne: teamInstance.teamInstanceId },
    });

    const maxConcurrent = teamInstance.teamConfig.constraints.maxConcurrentWorkflows || 1;
    if (activeDeployments.length >= maxConcurrent) {
      return {
        success: false,
        error: `Maximum concurrent deployments reached (${maxConcurrent})`,
        details: {
          maxConcurrent,
          currentActive: activeDeployments.length,
        },
      };
    }

    return { success: true };

  } catch (error) {
    logger.error('GitHub constraint validation error:', error);
    return {
      success: false,
      error: `Constraint validation failed: ${error.message}`,
    };
  }
}

async function extractAllowedProjectTypes(teamConfig) {
  // Basic implementation - return common project types for GitHub teams
  return ['web-app', 'saas', 'rest-api', 'microservice', 'enterprise-app', 'prototype'];
}

function determineComplexityLevel(teamConfig) {
  const agentCount = teamConfig.agents?.length || 0;
  if (agentCount <= 3) return 'simple';
  if (agentCount <= 6) return 'moderate';
  return 'complex';
}

function determineEstimatedSpeed(teamConfig) {
  const agentCount = teamConfig.agents?.length || 0;
  if (agentCount <= 4) return 'fast';
  if (agentCount <= 7) return 'medium';
  return 'comprehensive';
}

async function cleanupFailedDeployment(teamInstanceId, workflowId = null) {
  try {
    logger.info(`🧹 [GitHubCleanup] Starting cleanup for failed GitHub deployment: ${teamInstanceId}`);
    
    if (workflowId) {
      try {
        const orchestrator = new BmadOrchestrator();
        await orchestrator.initialize();
        await orchestrator.cancelWorkflow(workflowId);
        logger.info(`✅ [GitHubCleanup] Cancelled orphaned workflow: ${workflowId}`);
      } catch (workflowCleanupError) {
        logger.warn(`⚠️ [GitHubCleanup] Failed to cancel workflow ${workflowId}:`, workflowCleanupError);
      }
    }
    
    logger.info(`✅ [GitHubCleanup] Completed cleanup for: ${teamInstanceId}`);

  } catch (cleanupError) {
    logger.error(`❌ [GitHubCleanup] Cleanup failed for ${teamInstanceId}:`, cleanupError);
  }
}