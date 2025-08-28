/**
 * GitHub Workflow Execution API
 * Executes BMAD workflows on connected GitHub repositories
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import User from '@/lib/database/models/User';
import Workflow from '@/lib/database/models/Workflow';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import { BmadOrchestrator } from '@/lib/bmad/BmadOrchestrator.js';
import logger from '@/lib/utils/logger.js';

/**
 * POST /api/github/workflows/execute
 * Execute a BMAD workflow on a GitHub repository
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

    const {
      repositoryId,
      owner,
      repo,
      workflowId = 'brownfield-fullstack',
      branch = 'main',
      parameters = {}
    } = await request.json();

    // Validate required fields
    if (!owner || !repo) {
      return NextResponse.json({
        success: false,
        error: 'Repository owner and name are required',
        usage: 'Send { owner: "username", repo: "repository-name", workflowId?: "brownfield-fullstack" }'
      }, { status: 400 });
    }

    // Load user
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Check if user has GitHub token
    if (!user.githubAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'GitHub authentication required',
        message: 'Please connect your GitHub account first'
      }, { status: 401 });
    }

    // Initialize Git Integration Service
    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    // Verify repository access
    try {
      const repoInfo = await gitService.getRepositoryContext(owner, repo);
      logger.info(`✅ Repository access verified: ${owner}/${repo}`);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Repository access denied',
        message: `Cannot access repository ${owner}/${repo}. Please check permissions.`
      }, { status: 403 });
    }

    // Create workflow execution record
    const workflowExecutionId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow = new Workflow({
      workflowId: workflowExecutionId,
      title: `${workflowId} on ${owner}/${repo}`,
      description: `BMAD workflow execution on GitHub repository`,
      userId: user._id,
      prompt: `Execute ${workflowId} workflow on repository ${owner}/${repo}`,
      template: workflowId,
      status: 'RUNNING',
      startedAt: new Date(),
      
      // GitHub-specific metadata
      'metadata.github': {
        owner,
        name: repo,
        targetBranch: branch,
        repositoryUrl: `https://github.com/${owner}/${repo}`,
        repositoryId: repositoryId || `${owner}/${repo}`
      },

      // Initialize BMAD workflow data
      bmadWorkflowData: {
        sequence: [],
        currentStep: 0,
        totalSteps: 0,
        messages: [],
        artifacts: [],
        checkpoints: [],
        githubContext: {
          owner,
          repo,
          branch,
          repositoryId: repositoryId || `${owner}/${repo}`,
          executionStarted: new Date()
        }
      }
    });

    await workflow.save();

    // Initialize BMAD orchestrator with GitHub context
    const orchestrator = new BmadOrchestrator();
    
    // Create GitHub-enhanced execution context
    const executionContext = {
      workflowId: workflowExecutionId,
      userId: user._id.toString(),
      userName: user.profile?.name || user.email.split('@')[0],
      githubContext: {
        owner,
        repo,
        branch,
        repositoryId: repositoryId || `${owner}/${repo}`,
        gitService: gitService // Pass the initialized git service
      },
      parameters: {
        ...parameters,
        github_repo: `${owner}/${repo}`,
        target_branch: branch
      }
    };

    // Start workflow execution (asynchronous)
    orchestrator.startWorkflow(`Execute ${workflowId} on GitHub repository ${owner}/${repo}`, executionContext)
      .then((result) => {
        logger.info(`✅ GitHub workflow execution completed: ${workflowExecutionId}`);
      })
      .catch((error) => {
        logger.error(`❌ GitHub workflow execution failed: ${workflowExecutionId}`, error);
        // Update workflow status to ERROR
        Workflow.findOneAndUpdate(
          { workflowId: workflowExecutionId },
          { 
            status: 'ERROR',
            'errors': [{
              agentId: 'orchestrator',
              agentName: 'BMAD Orchestrator',
              error: error.message,
              timestamp: new Date()
            }]
          }
        ).catch(updateError => {
          logger.error(`Failed to update workflow error status: ${updateError.message}`);
        });
      });

    return NextResponse.json({
      success: true,
      executionId: workflowExecutionId,
      workflowId: workflowExecutionId,
      githubExecution: {
        repositoryId: repositoryId || `${owner}/${repo}`,
        owner,
        repo,
        branch,
        status: 'running'
      },
      message: `Started ${workflowId} workflow execution on ${owner}/${repo}`,
      
      // Real-time tracking URLs
      tracking: {
        workflowUrl: `/agent-teams/${workflowExecutionId}/live`,
        repositoryUrl: `https://github.com/${owner}/${repo}/tree/${branch}`
      }
    });

  } catch (error) {
    logger.error('GitHub workflow execution API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start workflow execution',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * GET handler for API documentation
 */
export async function GET() {
  return NextResponse.json({
    service: 'GitHub Workflow Execution API',
    version: '1.0.0',
    description: 'Execute BMAD workflows directly on GitHub repositories',
    
    endpoints: {
      'POST /api/github/workflows/execute': {
        description: 'Start a BMAD workflow execution on a GitHub repository',
        body: {
          owner: 'required - GitHub repository owner username',
          repo: 'required - GitHub repository name', 
          workflowId: 'optional - BMAD workflow to execute (default: brownfield-fullstack)',
          branch: 'optional - Target branch (default: main)',
          repositoryId: 'optional - Custom repository identifier',
          parameters: 'optional - Additional workflow parameters'
        },
        response: {
          success: 'boolean',
          executionId: 'string - Unique workflow execution identifier',
          githubExecution: 'object - GitHub execution details',
          tracking: 'object - URLs for monitoring progress'
        }
      }
    },

    availableWorkflows: [
      'brownfield-fullstack - Complete full-stack analysis and enhancement',
      'brownfield-backend - Backend service analysis and improvement',
      'brownfield-frontend - Frontend application analysis and enhancement',
      'brownfield-api - API documentation and improvement workflow'
    ],

    features: [
      'Execute BMAD workflows on any accessible GitHub repository',
      'Real-time progress tracking via existing chat interface',  
      'Automatic commit of generated artifacts to repository',
      'Multi-agent collaboration with GitHub API integration',
      'Workflow state persistence and recovery'
    ],

    requirements: [
      'GitHub OAuth authentication required',
      'Repository must be accessible to authenticated user',
      'User must have appropriate repository permissions for workflow type'
    ]
  });
}