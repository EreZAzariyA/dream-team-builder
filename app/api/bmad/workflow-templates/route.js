/**
 * BMAD Workflow Templates API
 * Serves workflow templates from .bmad-core/workflows/ directory
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from '@/lib/utils/logger.js';

const WORKFLOWS_DIR = path.join(process.cwd(), '.bmad-core', 'workflows');

/**
 * @swagger
 * /api/bmad/workflow-templates:
 *   get:
 *     summary: Get available BMAD workflow templates
 *     description: Returns all workflow templates from .bmad-core/workflows/ with their metadata
 *     tags:
 *       - BMAD Templates
 *     responses:
 *       200:
 *         description: Successfully retrieved workflow templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 templates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       project_types:
 *                         type: array
 *                         items:
 *                           type: string
 *                       sequence:
 *                         type: array
 *                       agents:
 *                         type: array
 *                       complexity:
 *                         type: string
 *                       estimatedTime:
 *                         type: string
 */
export async function GET() {
  try {
    logger.info('🔍 Fetching BMAD workflow templates...');

    // Read all workflow files from .bmad-core/workflows/
    const files = await fs.readdir(WORKFLOWS_DIR);
    const workflowFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
    
    logger.info(`📁 Found ${workflowFiles.length} workflow files: ${workflowFiles.join(', ')}`);

    const templates = [];

    for (const file of workflowFiles) {
      try {
        const filePath = path.join(WORKFLOWS_DIR, file);
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
            decision_guidance: workflow.decision_guidance || {}
          };

          templates.push(template);
          logger.info(`✅ Processed workflow: ${template.name} (${template.agents.length} agents, ${template.stepCount} steps)`);
        } else {
          logger.warn(`⚠️ Invalid workflow structure in ${file}`);
        }
      } catch (error) {
        logger.error(`❌ Error processing workflow file ${file}:`, error.message);
        // Continue processing other files
      }
    }

    // Sort templates by type and name
    templates.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });

    logger.info(`🚀 Successfully processed ${templates.length} BMAD workflow templates`);

    return NextResponse.json({
      success: true,
      templates: templates,
      meta: {
        total: templates.length,
        greenfield: templates.filter(t => t.type === 'greenfield').length,
        brownfield: templates.filter(t => t.type === 'brownfield').length,
        source: 'bmad-core'
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching BMAD workflow templates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch workflow templates', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

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