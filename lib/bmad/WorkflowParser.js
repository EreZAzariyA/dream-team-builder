/**
 * BMAD Dynamic Workflow Parser
 * Parses YAML workflow definitions and converts them to executable workflow objects
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from '../utils/logger.js';

class WorkflowParser {
  constructor() {
    this.workflowsPath = path.join(process.cwd(), '.bmad-core', 'workflows');
    this.templatesPath = path.join(process.cwd(), '.bmad-core', 'templates');
    this.tasksPath = path.join(process.cwd(), '.bmad-core', 'tasks');
    this.checklistsPath = path.join(process.cwd(), '.bmad-core', 'checklists');
    this.agentsPath = path.join(process.cwd(), '.bmad-core', 'agents');
  }

  /**
   * Parse a YAML workflow file and return executable workflow object
   * @param {string} workflowId - The workflow ID (e.g., 'brownfield-fullstack')
   * @returns {Object} Parsed and validated workflow object
   */
  async parseWorkflowFile(workflowId) {
    try {
      logger.info(`📋 [WorkflowParser] Loading workflow: ${workflowId}`);
      
      const workflowPath = path.join(this.workflowsPath, `${workflowId}.yaml`);
      const yamlContent = await fs.readFile(workflowPath, 'utf8');
      
      logger.info(`✅ [WorkflowParser] YAML file loaded: ${workflowPath}`);
      
      // Parse YAML content
      const yamlData = yaml.load(yamlContent);
      
      if (!yamlData.workflow) {
        throw new Error(`Invalid workflow format: missing 'workflow' root key in ${workflowId}.yaml`);
      }

      // Build executable workflow object
      const executableWorkflow = await this.buildExecutableWorkflow(yamlData.workflow, workflowId);
      
      logger.info(`🎯 [WorkflowParser] Workflow parsed successfully. Steps: ${executableWorkflow.steps.length}`);
      
      return executableWorkflow;
    } catch (error) {
      logger.error(`❌ [WorkflowParser] Failed to parse workflow ${workflowId}:`, error.message);
      throw new Error(`Failed to parse workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Convert YAML workflow structure to executable format
   * @param {Object} yamlWorkflow - Parsed YAML workflow object
   * @param {string} workflowId - Workflow identifier
   * @returns {Object} Executable workflow object
   */
  async buildExecutableWorkflow(yamlWorkflow, workflowId) {
    const executableWorkflow = {
      id: yamlWorkflow.id || workflowId,
      name: yamlWorkflow.name,
      description: yamlWorkflow.description,
      type: yamlWorkflow.type || 'standard',
      projectTypes: yamlWorkflow.project_types || [],
      steps: [],
      handoffPrompts: yamlWorkflow.handoff_prompts || {},
      decisionGuidance: yamlWorkflow.decision_guidance || {},
      flowDiagram: yamlWorkflow.flow_diagram || '',
      source: 'yaml',
      originalYaml: yamlWorkflow
    };

    // Parse sequence into executable steps
    if (yamlWorkflow.sequence && Array.isArray(yamlWorkflow.sequence)) {
      for (let i = 0; i < yamlWorkflow.sequence.length; i++) {
        const sequenceItem = yamlWorkflow.sequence[i];
        const step = await this.parseSequenceStep(sequenceItem, i);
        executableWorkflow.steps.push(step);
      }
    }

    // Validate the workflow
    this.validateWorkflow(executableWorkflow);

    return executableWorkflow;
  }

  /**
   * Parse individual sequence step from YAML
   * @param {Object} sequenceItem - Individual sequence item from YAML
   * @param {number} index - Step index in sequence
   * @returns {Object} Parsed step object
   */
  async parseSequenceStep(sequenceItem, index) {
    const step = {
      id: `step_${index}`,
      index,
      type: 'agent', // Default type
      original: sequenceItem
    };

    // Handle different step formats
    if (sequenceItem.step) {
      // Step with metadata (e.g., step: enhancement_classification)
      step.stepName = sequenceItem.step;
      step.agentId = sequenceItem.agent || this.inferAgentFromStep(sequenceItem.step);
      step.action = sequenceItem.action;
      step.type = 'step';
    } else if (sequenceItem.agent) {
      // Direct agent reference (e.g., agent: pm)
      step.agentId = sequenceItem.agent;
      step.type = 'agent';
    } else {
      // Handle other formats
      const keys = Object.keys(sequenceItem);
      if (keys.length === 1 && typeof sequenceItem[keys[0]] === 'string') {
        step.agentId = keys[0];
        step.role = sequenceItem[keys[0]];
      }
    }

    // Parse step properties
    step.role = sequenceItem.role || step.role || this.generateRoleFromStep(step);
    step.description = sequenceItem.description || sequenceItem.notes || '';
    step.condition = sequenceItem.condition;
    step.routes = sequenceItem.routes;
    step.optional = sequenceItem.optional || false;
    step.creates = sequenceItem.creates;
    step.requires = sequenceItem.requires;
    step.uses = sequenceItem.uses;
    step.repeats = sequenceItem.repeats;
    step.timeout = sequenceItem.timeout || 120000;
    step.command = sequenceItem.command; // Add this line to parse the command

    logger.info('WorkflowParser - Parsed step:', step); // DEBUG LOG

    // Handle routing decisions
    if (step.routes) {
      step.type = 'routing';
      step.routingOptions = Object.keys(step.routes);
    }

    // Handle repeat cycles
    if (step.repeats) {
      step.type = 'cycle';
    }

    logger.info(`📝 [WorkflowParser] Parsed step ${index}: ${step.agentId || step.stepName} (${step.type})`);

    return step;
  }

  /**
   * Infer agent ID from step name
   * @param {string} stepName - Step name (e.g., 'enhancement_classification')
   * @returns {string} Inferred agent ID
   */
  inferAgentFromStep(stepName) {
    const stepToAgentMap = {
      'enhancement_classification': 'analyst',
      'routing_decision': 'system',
      'documentation_check': 'analyst',
      'project_analysis': 'architect',
      'architecture_decision': 'architect'
    };

    return stepToAgentMap[stepName] || 'analyst';
  }

  /**
   * Generate role description from step
   * @param {Object} step - Step object
   * @returns {string} Generated role description
   */
  generateRoleFromStep(step) {
    if (step.stepName) {
      return step.stepName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (step.agentId) {
      return `${step.agentId.toUpperCase()} Agent`;
    }
    return 'Workflow Step';
  }

  /**
   * Validate workflow structure and dependencies
   * @param {Object} workflow - Executable workflow object
   */
  validateWorkflow(workflow) {
    logger.info(`🧪 [WorkflowParser] Validating workflow: ${workflow.id}`);

    // Basic validation
    if (!workflow.name) {
      throw new Error('Workflow missing required field: name');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    // Validate agent references
    const validAgents = ['analyst', 'pm', 'architect', 'ux-expert', 'dev', 'qa', 'sm', 'po', 'system'];
    for (const step of workflow.steps) {
      if (step.agentId && !validAgents.includes(step.agentId)) {
        logger.warn(`⚠️ [WorkflowParser] Unknown agent: ${step.agentId} in step ${step.index}`);
      }
    }

    // Validate artifact dependencies
    const createdArtifacts = new Set();
    for (const step of workflow.steps) {
      // Check if required artifacts exist
      if (step.requires) {
        const requires = Array.isArray(step.requires) ? step.requires : [step.requires];
        for (const artifact of requires) {
          if (!createdArtifacts.has(artifact)) {
            logger.warn(`⚠️ [WorkflowParser] Step ${step.index} requires '${artifact}' but it's not created by any previous step`);
          }
        }
      }

      // Track created artifacts
      if (step.creates) {
        const creates = Array.isArray(step.creates) ? creates : [step.creates];
        creates.forEach(artifact => createdArtifacts.add(artifact));
      }
    }

    logger.info(`✅ [WorkflowParser] Workflow validation complete: ${workflow.steps.length} steps, ${createdArtifacts.size} artifacts`);
  }

  /**
   * Resolve template and task references in workflow
   * @param {Object} workflow - Workflow object
   * @returns {Object} Workflow with resolved references
   */
  async resolveReferences(workflow) {
    logger.info(`🔗 [WorkflowParser] Resolving references for workflow: ${workflow.id}`);

    for (const step of workflow.steps) {
      if (step.uses) {
        try {
          step.resolvedTemplate = await this.resolveUsesReference(step.uses);
          logger.info(`✅ [WorkflowParser] Resolved '${step.uses}' for step ${step.index}`);
        } catch (error) {
          logger.warn(`⚠️ [WorkflowParser] Failed to resolve '${step.uses}' for step ${step.index}: ${error.message}`);
          step.resolvedTemplate = null;
        }
      }
    }

    return workflow;
  }

  /**
   * Resolve "uses:" reference to actual template or task
   * @param {string} usesRef - Reference string (e.g., 'brownfield-prd-tmpl')
   * @returns {Object} Resolved template or task object
   */
  async resolveUsesReference(usesRef) {
    logger.info(`🔍 [WorkflowParser] Resolving reference: "${usesRef}" (length: ${usesRef.length})`);
    
    // Check if it's a template reference
    if (usesRef.endsWith('-tmpl') || usesRef.includes('template')) {
      const templatePath = path.join(this.templatesPath, `${usesRef}.yaml`);
      try {
        const templateContent = await fs.readFile(templatePath, 'utf8');
        return {
          type: 'template',
          path: templatePath,
          content: yaml.load(templateContent)
        };
      } catch {
        // Template not found, might be a task
      }
    }

    // Check if it's a task reference (YAML)
    const taskPath = path.join(this.tasksPath, `${usesRef}.yaml`);
    try {
      const taskContent = await fs.readFile(taskPath, 'utf8');
      return {
        type: 'task',
        path: taskPath,
        content: yaml.load(taskContent)
      };
    } catch (taskError) {
      // Task not found, try markdown tasks
      const taskMdPath = path.join(this.tasksPath, `${usesRef}.md`);
      try {
        const taskMdContent = await fs.readFile(taskMdPath, 'utf8');
        return {
          type: 'task',
          path: taskMdPath,
          content: taskMdContent
        };
      } catch (taskMdError) {
        // Neither YAML nor MD task found, try checklist
      }
    }

    // Check if it's a checklist reference
    const checklistPath = path.join(this.checklistsPath, `${usesRef}.md`);
    try {
      const checklistContent = await fs.readFile(checklistPath, 'utf8');
      return {
        type: 'checklist',
        path: checklistPath,
        content: checklistContent
      };
    } catch (checklistError) {
      throw new Error(`Could not resolve reference '${usesRef}' as template, task, or checklist`);
    }
  }

  /**
   * Check if a dynamic workflow exists for the given workflow ID
   * @param {string} workflowId - Workflow identifier
   * @returns {boolean} True if dynamic workflow exists
   */
  async workflowExists(workflowId) {
    try {
      const workflowPath = path.join(this.workflowsPath, `${workflowId}.yaml`);
      await fs.access(workflowPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all available dynamic workflows
   * @returns {Array<string>} Array of workflow IDs
   */
  async listAvailableWorkflows() {
    try {
      const files = await fs.readdir(this.workflowsPath);
      return files
        .filter(file => file.endsWith('.yaml'))
        .map(file => file.replace('.yaml', ''));
    } catch (error) {
      logger.warn(`⚠️ [WorkflowParser] Could not list workflows: ${error.message}`);
      return [];
    }
  }
}

export default WorkflowParser;