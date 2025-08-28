
import { NextResponse } from 'next/server';
import { withRouteAuth } from '../../../lib/utils/routeAuth.js';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth/config.js';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from '@/lib/utils/logger.js';
import { compose, withMethods, withDatabase, withErrorHandling, withLogging } from '../../../lib/api/middleware.js';
import WorkflowTemplate from '../../../lib/database/models/WorkflowTemplate.js';
import { connectMongoose } from '../../../lib/database/mongodb.js';
import WorkflowParser from '@/lib/bmad/WorkflowParser.js';

const handler = async (req) => {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source'); // 'templates', 'bmad', or default (both)
  const templates = searchParams.get('templates') === 'true';
  const workflowFiles = searchParams.get('workflowFiles');
  
  try {
    let result = [];
    
    // If templates requested, get MongoDB templates
    if (source === 'templates' || templates || (!source && !workflowFiles)) {
      await connectMongoose();
      const dbTemplates = await WorkflowTemplate.find({});
      result = result.concat(dbTemplates.map(t => ({
        ...t.toObject(),
        source: 'database'
      })));
    }
    
    // If BMAD workflows requested, get from files
    if (source === 'bmad' || source === 'files' || !source) {
      const workflowsDir = path.join(process.cwd(), '.bmad-core', 'workflows');
      
      try {
        const files = await fs.readdir(workflowsDir);
        const workflowFilesList = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
        
        logger.info(`Found ${workflowFilesList.length} workflow files: ${workflowFilesList.join(', ')}`);

        for (const file of workflowFilesList) {
          try {
            const filePath = path.join(workflowsDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const workflowData = yaml.load(content);
            
            if (workflowData && workflowData.workflow) {
              const workflow = workflowData.workflow;
              
              // Extract unique agents from workflow sequence
              const agents = extractAgentsFromSequence(workflow.sequence || []);
              
              // Calculate complexity and estimated time
              const complexity = calculateComplexity(workflow.sequence || []);
              const estimatedTime = calculateEstimatedTime(workflow.sequence || []);
              
              const template = {
                id: workflow.id || file.replace(/\.(yaml|yml)$/, ''),
                name: workflow.name || 'Untitled Workflow',
                description: workflow.description || 'No description available',
                type: workflow.type || 'general',
                project_types: workflow.project_types || [],
                sequence: workflow.sequence || [],
                agents: agents,
                complexity: complexity,
                estimatedTime: estimatedTime,
                stepCount: workflow.sequence?.length || 0,
                filename: file,
                handoff_prompts: workflow.handoff_prompts || {},
                decision_guidance: workflow.decision_guidance || {},
                source: 'bmad-core'
              };

              result.push(template);
              logger.info(`✅ Processed workflow: ${template.name} (${template.agents.length} agents, ${template.stepCount} steps)`);
            }
          } catch (error) {
            logger.error(`❌ Error processing workflow file ${file}:`, error.message);
          }
        }
      } catch (error) {
        logger.warn('Workflows directory not found or inaccessible:', workflowsDir);
      }
    }
    
    // Sort by type and name
    result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });

    logger.info(`Successfully loaded ${result.length} workflows`);
    return NextResponse.json({
      success: true,
      workflows: result,
      templates: result, // For backward compatibility
      meta: {
        total: result.length,
        database: result.filter(w => w.source === 'database').length,
        bmadCore: result.filter(w => w.source === 'bmad-core').length
      }
    });
    
  } catch (error) {
    logger.error('Error fetching workflows:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch workflows', 
        details: error.message 
      },
      { status: 500 }
    );
  }
};

// POST handler for creating templates and filtered workflows
export const POST = async (request) => {
  const { pathname, searchParams } = new URL(request.url);
  
  // Handle filtered workflows
  if (searchParams.get('filtered') === 'true') {
    try {
      const { user, session, error } = await authenticateRoute(request);
      if (error) return error;

      const { workflowFiles, projectContext } = await request.json();

      logger.info(`🔍 [FilteredWorkflows] Processing ${workflowFiles?.length || 0} workflows with context:`, projectContext);

      if (!workflowFiles || !Array.isArray(workflowFiles)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'workflowFiles array is required' 
          },
          { status: 400 }
        );
      }

      const parser = new WorkflowParser();
      const filteredWorkflows = await parser.getFilteredWorkflows(workflowFiles, projectContext || {});

      const recommendedCount = filteredWorkflows.filter(w => w.recommended).length;

      logger.info(`✅ [FilteredWorkflows] Returning ${filteredWorkflows.length} workflows (${recommendedCount} recommended)`);

      return NextResponse.json({
        success: true,
        workflows: filteredWorkflows,
        meta: {
          total: workflowFiles.length,
          filtered: filteredWorkflows.length,
          recommended: recommendedCount,
          projectContext: projectContext || {}
        }
      });

    } catch (error) {
      logger.error('❌ [FilteredWorkflows] Error filtering workflows:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to filter workflows', 
          details: error.message 
        },
        { status: 500 }
      );
    }
  }
  
  // Handle template creation
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();
    const body = await request.json();
    const { 
      name, 
      description, 
      type, 
      project_types, 
      sequence, 
      decision_guidance, 
      handoff_prompts 
    } = body;

    if (!name || !sequence || sequence.length === 0) {
      return NextResponse.json(
        { error: 'Name and sequence are required' },
        { status: 400 }
      );
    }

    const newTemplate = new WorkflowTemplate({
      name,
      description,
      type: type || 'general',
      project_types: project_types || [],
      sequence,
      decision_guidance: decision_guidance || {},
      handoff_prompts: handoff_prompts || {},
      createdBy: session.user.id,
    });

    await newTemplate.save();
    return NextResponse.json({ success: true, data: newTemplate }, { status: 201 });
  } catch (error) {
    logger.error('Error creating workflow template:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow template', details: error.message },
      { status: 500 }
    );
  }
};

const authenticateRoute = async (request) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }
  return { user: session.user, session };
};

/**
 * Extract unique agents from workflow sequence
 */
function extractAgentsFromSequence(sequence) {
  const agents = new Set();
  
  for (const step of sequence) {
    if (step.agent) {
      // Handle single agent or multiple agents separated by '/'
      const stepAgents = step.agent.split('/');
      stepAgents.forEach(agent => agents.add(agent.trim()));
    }
  }
  
  return Array.from(agents);
}

/**
 * Calculate workflow complexity based on sequence
 */
function calculateComplexity(sequence) {
  const stepCount = sequence.length;
  const uniqueAgents = extractAgentsFromSequence(sequence).length;
  
  if (stepCount <= 3 && uniqueAgents <= 2) return 'Simple';
  if (stepCount <= 8 && uniqueAgents <= 4) return 'Moderate';
  return 'Complex';
}

/**
 * Estimate completion time based on workflow complexity
 */
function calculateEstimatedTime(sequence) {
  const stepCount = sequence.length;
  const uniqueAgents = extractAgentsFromSequence(sequence).length;
  
  // Base time per step (minutes)
  const baseTimePerStep = 5;
  const agentSwitchTime = 2;
  
  const totalTime = (stepCount * baseTimePerStep) + (uniqueAgents * agentSwitchTime);
  
  if (totalTime <= 15) return '10-15 minutes';
  if (totalTime <= 30) return '20-30 minutes';
  if (totalTime <= 60) return '45-60 minutes';
  return '60+ minutes';
}

export const GET = compose(
  withMethods(['GET']),
  withDatabase,
  withLogging,
  withErrorHandling
)(withRouteAuth(handler));

