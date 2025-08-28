import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../../lib/utils/routeAuth.js';
import { BmadOrchestrator } from '../../../../../lib/bmad/BmadOrchestrator.js';
import { connectMongoose } from '../../../../../lib/database/mongodb.js';
import Workflow from '../../../../../lib/database/models/Workflow.js';
import RepoAnalysis from '../../../../../lib/database/models/RepoAnalysis.js';
import { pusherServer } from '../../../../../lib/pusher/config.js';
import { WorkflowId } from '../../../../../lib/utils/workflowId.js';
import logger from '@/lib/utils/logger.js';
import { WorkflowStatus } from '@/lib/bmad/types.js';

/**
 * Wait for repository analysis to complete with timeout
 */
async function waitForAnalysis(analysisId, timeout = 120000) { // 2 minute timeout
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const analysis = await RepoAnalysis.findById(analysisId);
    
    if (analysis?.status === 'completed') {
      logger.info(`✅ [REPO ANALYSIS] Analysis completed: ${analysis.metrics?.fileCount || 0} files indexed`);
      return analysis;
    } else if (analysis?.status === 'failed') {
      throw new Error(`Repository analysis failed: ${analysis.error || 'Unknown error'}`);
    }
    
    // Wait 3 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (Date.now() - startTime > timeout / 2) {
      logger.info(`⏳ [REPO ANALYSIS] Still waiting for analysis ${analysisId}...`);
    }
  }
  
  throw new Error('Repository analysis timeout - taking too long to complete');
}

export async function POST(request, { params }) {
  const { workflowId: workflowTemplate } = await params;

  try {
    // Validate workflow template parameter
    if (!workflowTemplate || typeof workflowTemplate !== 'string' || !workflowTemplate.trim()) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid workflow template',
        details: 'workflowId parameter is required and must be a non-empty string'
      }, { status: 400 });
    }

    // Get authenticated session
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    await connectMongoose();

    // Get and validate request body
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      logger.error('Invalid JSON in request body:', jsonError.message);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: jsonError.message 
      }, { status: 400 });
    }

    // Validate required fields
    const { userPrompt, name, description, githubRepository } = body || {};
    
    if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
      return NextResponse.json({ 
        error: 'userPrompt is required and must be a non-empty string' 
      }, { status: 400 });
    }

    // Validate optional fields
    if (name && typeof name !== 'string') {
      return NextResponse.json({ 
        error: 'name must be a string if provided' 
      }, { status: 400 });
    }

    if (description && typeof description !== 'string') {
      return NextResponse.json({ 
        error: 'description must be a string if provided' 
      }, { status: 400 });
    }

    // Validate GitHub repository context (optional)
    if (githubRepository && (typeof githubRepository !== 'object' || !githubRepository.owner || !githubRepository.name)) {
      return NextResponse.json({ 
        error: 'githubRepository must include owner and name if provided' 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedUserPrompt = userPrompt.trim();
    const sanitizedName = name ? name.trim() : '';
    const sanitizedDescription = description ? description.trim() : '';

    // Create workflow record in database with proper error handling
    let savedWorkflow;
    let finalWorkflowInstanceId;
    
    try {
      // Generate a unique BMAD workflow ID  
      const bmadWorkflowId = WorkflowId.generate();
      
      const workflowDoc = new Workflow({
        workflowId: bmadWorkflowId, // REQUIRED: String-based workflow ID for BMAD system
        title: sanitizedName || `${workflowTemplate} Workflow`,
        description: sanitizedDescription || `Automated execution of ${workflowTemplate} workflow`,
        prompt: sanitizedUserPrompt,
        template: workflowTemplate,
        status: WorkflowStatus.INITIALIZING,
        userId: session.user.id,
        metadata: {
          priority: 'medium',
          tags: [workflowTemplate],
          category: 'workflow-template',
          createdAt: new Date().toISOString(),
          // GitHub repository context (matches orchestrator expectation and schema)
          ...(githubRepository && {
            github: {
              owner: githubRepository.owner,
              name: githubRepository.name,
              repositoryUrl: githubRepository.html_url,
              targetBranch: githubRepository.default_branch || 'main',
              capabilities: ['read', 'write'] // Default capabilities for repository workflows
            }
          })
        }
      });

      savedWorkflow = await workflowDoc.save();
      finalWorkflowInstanceId = bmadWorkflowId; // Use BMAD workflow ID (string-based)
      logger.info(`✅ Workflow record created: ${finalWorkflowInstanceId} (MongoDB ID: ${savedWorkflow._id})`);
      
      // Workflow created with running status, ready to start orchestrator
      
    } catch (dbError) {
      logger.error('Database error creating workflow:', dbError);
      return NextResponse.json({ 
        error: 'Failed to create workflow record',
        details: dbError.message 
      }, { status: 500 });
    }

    // Start workflow with proper orchestration layer
    try {
      logger.info(`🚀 Starting workflow ${finalWorkflowInstanceId}...`);
      
      // Get orchestrator singleton
      const { getOrchestrator } = require('../../../../../lib/bmad/BmadOrchestrator.js');
      const orchestrator = await getOrchestrator();
      logger.info(`✅ BmadOrchestrator initialized for ${finalWorkflowInstanceId}`);

      const channelName = WorkflowId.toChannelName(finalWorkflowInstanceId);

      // Send immediate test event to verify Pusher connection
      await pusherServer.trigger(channelName, 'agent-activated', {
        agentId: 'test-agent',
        status: 'active',
        message: 'Test agent activation for debugging',
        timestamp: new Date().toISOString(),
        workflowId: finalWorkflowInstanceId
      });
      logger.info(`🧪 Test agent activation event sent for ${finalWorkflowInstanceId}`);
      
      // Use repo-explorer analysis pipeline for comprehensive repository context
      let gitService = null;
      let repositoryAnalysis = null;
      
      if (githubRepository) {
        const { GitIntegrationService } = await import('../../../../../lib/integrations/GitIntegrationService.js');
        
        gitService = new GitIntegrationService(session.user);
        await gitService.initialize();
        
        // Use comprehensive repo-explorer analysis (same as repo chat interface)
        try {
          logger.info(`🔍 [REPO ANALYSIS] Using repo-explorer pipeline for ${githubRepository.owner}/${githubRepository.name}`);
          
          // Check for existing completed analysis
          let repoAnalysis = await RepoAnalysis.findOne({
            repositoryId: githubRepository.id?.toString(),
            userId: session.user.id,
            status: 'completed'
          }).sort({ createdAt: -1 });
          
          // If not found by repository ID, try by owner/name
          if (!repoAnalysis) {
            repoAnalysis = await RepoAnalysis.findOne({
              owner: githubRepository.owner,
              name: githubRepository.name,
              userId: session.user.id,
              status: 'completed'
            }).sort({ createdAt: -1 });
          }
          
          // Check if analysis is stale (older than 24 hours)
          const isStale = repoAnalysis && 
            (Date.now() - new Date(repoAnalysis.createdAt).getTime() > 24 * 60 * 60 * 1000);
          
          if (!repoAnalysis || isStale) {
            logger.info(`🔄 [REPO ANALYSIS] ${!repoAnalysis ? 'No existing' : 'Stale'} analysis found, starting new analysis`);
            
            // Start new analysis using repo-explorer API internally
            const analysisData = {
              repositoryId: githubRepository.id?.toString() || `${githubRepository.owner}/${githubRepository.name}`,
              owner: githubRepository.owner,
              name: githubRepository.name,
              fullName: `${githubRepository.owner}/${githubRepository.name}`,
              branch: githubRepository.default_branch || 'main',
              userId: session.user.id,
              status: 'pending',
              maxFileSize: 1024 * 1024, // 1MB
              maxFiles: 5000, // Reasonable limit for workflow context
              includeTests: true,
              includeDocs: true
            };

            const analysis = new RepoAnalysis(analysisData);
            await analysis.save();
            
            // Import and run the same analysis function used by repo-explorer
            const { performRepositoryAnalysis } = await import('@/app/api/repo/analyze/route.js');
            
            // Run analysis in background but wait for completion (with timeout)
            const analysisPromise = performRepositoryAnalysis(analysis._id.toString(), session.user)
              .catch(error => {
                logger.error('Repository analysis failed:', error);
                throw error;
              });
            
            // Wait for completion with timeout
            try {
              await Promise.race([
                analysisPromise,
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Analysis timeout')), 120000) // 2 minute timeout
                )
              ]);
              
              // Get the completed analysis
              repoAnalysis = await RepoAnalysis.findById(analysis._id);
            } catch (timeoutError) {
              logger.warn(`⏳ [REPO ANALYSIS] Analysis timeout, continuing with basic context`);
              repoAnalysis = null;
            }
          } else {
            logger.info(`✅ [REPO ANALYSIS] Using existing analysis with ${repoAnalysis.metrics?.fileCount || 0} files`);
          }
          
          if (repoAnalysis && repoAnalysis.status === 'completed') {
            repositoryAnalysis = {
              // Convert RepoAnalysis format to match what agents expect
              repository: {
                name: githubRepository.name,
                owner: githubRepository.owner,
                fullName: `${githubRepository.owner}/${githubRepository.name}`,
                description: repoAnalysis.summary || githubRepository.description
              },
              analysis: repoAnalysis,
              fileIndex: repoAnalysis.fileIndex || [],
              metrics: repoAnalysis.metrics || {},
              summary: repoAnalysis.summary || `Repository analysis for ${githubRepository.name}`,
              insights: repoAnalysis.insights || {},
              // Add compatibility fields
              development: {
                framework: repoAnalysis.metrics?.languages ? 
                  Object.keys(repoAnalysis.metrics.languages)[0] : 'Unknown',
                languages: repoAnalysis.metrics?.languages || {},
                fileCount: repoAnalysis.metrics?.fileCount || 0,
                totalLines: repoAnalysis.metrics?.totalLines || 0
              }
            };
            
            logger.info(`✅ [REPO ANALYSIS] Complete context prepared: ${repositoryAnalysis.metrics.fileCount} files, ${repositoryAnalysis.metrics.totalLines} lines`);
          }
          
        } catch (analysisError) {
          logger.error(`❌ [REPO ANALYSIS] Failed for ${githubRepository.owner}/${githubRepository.name}:`, analysisError.message);
          // Continue with basic metadata - better than nothing
          repositoryAnalysis = {
            repository: {
              name: githubRepository.name,
              owner: githubRepository.owner,
              fullName: `${githubRepository.owner}/${githubRepository.name}`,
              description: githubRepository.description || 'No description available'
            },
            development: { framework: 'Unknown', languages: {}, fileCount: 0, totalLines: 0 },
            analysis: null,
            fileIndex: [],
            metrics: {},
            summary: `Basic repository metadata for ${githubRepository.name} (full analysis unavailable)`
          };
        }
      }

      // Start workflow through proper orchestration layer
      const workflowResult = await orchestrator.startWorkflow(sanitizedUserPrompt, {
        workflowId: finalWorkflowInstanceId,
        sequence: workflowTemplate,
        name: sanitizedName || `${workflowTemplate} Project`,
        description: sanitizedDescription || `AI-generated project using ${workflowTemplate} workflow`,
        userId: session.user.id,
        priority: 'medium',
        tags: [workflowTemplate],
        
        // GitHub integration context
        ...(githubRepository && gitService && {
          githubContext: {
            repository: githubRepository,
            gitService: gitService,
            targetBranch: githubRepository.default_branch || 'main'
          }
        }),
        
        // Repository analysis data
        ...(repositoryAnalysis && {
          repositoryAnalysis: repositoryAnalysis
        })
      });
      logger.info(`✅ Workflow ${finalWorkflowInstanceId} started successfully:`, workflowResult.workflowId);

    } catch (workflowError) {
      logger.error(`❌ Workflow ${finalWorkflowInstanceId} failed:`, workflowError.message || JSON.stringify(workflowError));
      logger.error('Full error details:', workflowError);
      
      // Update workflow status to error with proper error handling
      try {
        await Workflow.findOneAndUpdate(
          { workflowId: finalWorkflowInstanceId }, // Find by BMAD workflowId (string)
          { 
            status: 'ERROR', // BMAD standardized status
            'metadata.errorAt': new Date().toISOString(),
            'metadata.errorMessage': workflowError.message || 'Unknown error'
          }
        );
      } catch (updateError) {
        logger.error('Failed to update workflow status to error:', updateError);
      }
      
      // Send error event via Pusher
      try {
        const channelName = WorkflowId.toChannelName(finalWorkflowInstanceId);
        await pusherServer.trigger(channelName, 'workflow-update', {
          workflowId: finalWorkflowInstanceId,
          status: 'ERROR', // BMAD standardized status
          message: `Workflow failed: ${workflowError.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          error: true,
          errorDetails: {
            type: workflowError.name || 'WorkflowError',
            code: workflowError.code || 'WORKFLOW_EXECUTION_FAILED'
          }
        });
      } catch (pusherError) {
        logger.error('Failed to send error event via Pusher:', pusherError);
      }
      
      // Return error response but don't throw - workflow was created successfully even if execution failed
      return NextResponse.json({ 
        success: false,
        error: 'Workflow execution failed',
        details: workflowError.message || 'Unknown error',
        workflowInstanceId: finalWorkflowInstanceId,
        workflowId: finalWorkflowInstanceId
      }, { status: 500 });
    }

    // Trigger initial Pusher event for workflow start
    try {
      const channelName = WorkflowId.toChannelName(finalWorkflowInstanceId);
      await pusherServer.trigger(channelName, 'workflow-update', {
        workflowId: finalWorkflowInstanceId,
        workflowInstanceId: finalWorkflowInstanceId, // Consistent field naming
        status: 'RUNNING', // BMAD standardized status
        message: 'Workflow started successfully',
        timestamp: new Date().toISOString(),
        agents: ['pm', 'architect', 'ux-expert', 'developer', 'qa'],
        templateId: workflowTemplate
      });
      logger.info(`🚀 Workflow started event sent for: ${finalWorkflowInstanceId}`);
    } catch (pusherError) {
      logger.warn('Failed to send workflow start event:', pusherError.message);
      // Don't fail the request if Pusher fails - workflow is still created
    }

    // Consistent response structure
    const responseData = { 
      success: true,
      message: 'Workflow started successfully', 
      workflowInstanceId: finalWorkflowInstanceId,
      workflowId: finalWorkflowInstanceId, // Include both for backward compatibility
      templateId: workflowTemplate,
      bmadEnabled: true,
      realTimeChannel: WorkflowId.toChannelName(finalWorkflowInstanceId),
      metadata: {
        createdAt: new Date().toISOString(),
        userId: session.user.id,
        status: 'RUNNING' // BMAD standardized status
      }
    };
    
    logger.info('Sending successful response:', responseData);
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    logger.error(`Error starting workflow template ${workflowTemplate}:`, error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to start workflow',
      details: error.message || 'Unknown server error',
      metadata: {
        timestamp: new Date().toISOString(),
        templateId: workflowTemplate,
        errorType: error.name || 'ServerError'
      }
    }, { status: 500 });
  }
}