/**
 * BMAD Dynamic Workflow Parser
 * Loads workflow definitions from .bmad-core folder and converts them to executable workflow objects
 */

import logger from '../utils/logger.js';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

class WorkflowParser {
  constructor() {
    this.workflowsDir = path.join(process.cwd(), '.bmad-core', 'workflows');
  }

  /**
   * Load workflow from BMAD core folder and return executable workflow object
   * @param {string} workflowId - The workflow ID (e.g., 'brownfield-fullstack')
   * @returns {Object} Parsed and validated workflow object
   */
  async parseWorkflowFile(workflowId) {
    try {
      logger.info(`📋 [WorkflowParser] Loading workflow from BMAD core: ${workflowId}`);
      
      // Try different file extensions
      const possibleFiles = [
        `${workflowId}.yaml`,
        `${workflowId}.yml`
      ];
      
      let workflowData = null;
      let foundFile = null;
      
      for (const fileName of possibleFiles) {
        try {
          const filePath = path.join(this.workflowsDir, fileName);
          const content = await fs.readFile(filePath, 'utf8');
          workflowData = yaml.load(content);
          foundFile = fileName;
          break;
        } catch (error) {
          // Try next file extension
          continue;
        }
      }
      
      if (!workflowData || !foundFile) {
        throw new Error(`Workflow template '${workflowId}' not found in .bmad-core/workflows/`);
      }

      if (!workflowData.workflow) {
        throw new Error(`Invalid workflow format: missing 'workflow' section in ${foundFile}`);
      }

      // Build executable workflow object
      const executableWorkflow = await this.buildExecutableWorkflow(workflowData.workflow, workflowId);
      
      logger.info(`🎯 [WorkflowParser] Workflow loaded from BMAD core successfully. Steps: ${executableWorkflow.steps.length}`);
      
      return executableWorkflow;
    } catch (error) {
      logger.error(`❌ [WorkflowParser] Failed to load workflow ${workflowId}:`, error.message);
      throw new Error(`Failed to load workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Convert BMAD workflow structure to executable format
   * @param {Object} workflowConfig - Workflow config from YAML file
   * @param {string} workflowId - Workflow identifier
   * @returns {Object} Executable workflow object
   */
  async buildExecutableWorkflow(workflowConfig, workflowId) {
    const executableWorkflow = {
      id: workflowConfig.id || workflowId,
      name: workflowConfig.name,
      description: workflowConfig.description,
      type: workflowConfig.type || 'standard',
      projectTypes: workflowConfig.project_types || [],
      steps: [],
      handoffPrompts: workflowConfig.handoff_prompts || {},
      decisionGuidance: workflowConfig.decision_guidance || {},
      flowDiagram: workflowConfig.flow_diagram || '',
      source: 'bmad-core',
      originalConfig: workflowConfig
    };

    // Parse sequence into executable steps
    if (workflowConfig.sequence && Array.isArray(workflowConfig.sequence)) {
      for (let i = 0; i < workflowConfig.sequence.length; i++) {
        const sequenceItem = workflowConfig.sequence[i];
        const step = await this.parseSequenceStep(sequenceItem, i);
        executableWorkflow.steps.push(step);
      }
    }


    // Validate the workflow
    this.validateWorkflow(executableWorkflow);

    logger.debug(`🎯 [WorkflowParser] buildExecutableWorkflow - Final executableWorkflow.steps:`, executableWorkflow.steps);

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

    // Handle different step formats for agent steps
    if (sequenceItem.step) {
      // Step with metadata (e.g., step: enhancement_classification)
      step.step = sequenceItem.step;  // Use 'step' field consistently 
      step.stepName = sequenceItem.step; // Keep both for compatibility
      step.action = sequenceItem.action;
      step.notes = sequenceItem.notes; // ADDED: Explicitly assign notes
      // REMOVED HARDCODING: Let DynamicWorkflowHandler detect step type dynamically
      // step.type = 'step';  // This was preventing DecisionEngine from working
      
      // Handle routing steps specifically
      if (sequenceItem.routes) {
        step.routes = sequenceItem.routes;
        step.type = 'routing';
        step.routingOptions = Object.keys(sequenceItem.routes);
        // Do NOT assign agent for routing steps
      } else {
        // Only assign agent for non-routing steps
        step.agent = sequenceItem.agent || this.inferAgentFromStep(sequenceItem.step);
      }
    } else if (sequenceItem.agent) {
      // Direct agent reference (e.g., agent: pm)
      step.agent = sequenceItem.agent;
      step.type = 'agent';
    } else {
      // Handle other formats
      const keys = Object.keys(sequenceItem);
      if (keys.length === 1 && typeof sequenceItem[keys[0]] === 'string') {
        step.agent = keys[0];
        step.role = sequenceItem[keys[0]];
      } else if (keys.length === 1 && typeof sequenceItem[keys[0]] === 'object') {
        // This might be a workflow control step we didn't catch above
        step.agent = keys[0];
        step.role = sequenceItem[keys[0]];
      }
    }

    // Check if this is a non-agent workflow control step
    const workflowControlPatterns = [
      'project_setup_guidance',
      'development_order_guidance', 
      'repeat_development_cycle',
      'workflow_end'
    ];
    
    const stepKeys = Object.keys(sequenceItem);
    
    const isWorkflowControl = stepKeys.some(key => {
      const isPattern = workflowControlPatterns.some(pattern => key.includes(pattern));
      const hasActionNoAgent = sequenceItem[key] && 
                               typeof sequenceItem[key] === 'object' && 
                               sequenceItem[key].action && 
                               !sequenceItem[key].agent;
      
      return isPattern || hasActionNoAgent;
    });
    
    if (isWorkflowControl) {
      step.type = 'workflow_control';
      step.skip = true;
      step.agent = 'bmad-orchestrator'; // Use bmad-orchestrator for workflow control
      step.controlAction = stepKeys[0];
      step.description = sequenceItem[stepKeys[0]]?.notes || sequenceItem[stepKeys[0]]?.action || 'Workflow control step';
      return step; // Return early for workflow control steps
    }
    
    // Validate that we have a valid agent for agent steps
    if (step.type === 'agent' && (!step.agent || step.agent === 'undefined')) {
      logger.warn(`⚠️ [WorkflowParser] Step ${index} has invalid agent: '${step.agent}', treating as workflow control step`);
      step.type = 'workflow_control';
      step.skip = true;
      step.agent = null;
      step.controlAction = stepKeys[0] || 'unknown_control';
      step.description = sequenceItem.notes || 'Workflow control step (invalid agent specified)';
    }

    // Parse step properties
    step.role = sequenceItem.role || step.role || this.generateRoleFromStep(step);
    step.description = sequenceItem.description || sequenceItem.notes || '';
    step.condition = sequenceItem.condition;
    if (!step.routes) {
      step.routes = sequenceItem.routes;
    }
    step.optional = sequenceItem.optional || false;
    step.creates = sequenceItem.creates;
    step.requires = sequenceItem.requires;
    step.uses = sequenceItem.uses;
    step.repeats = sequenceItem.repeats;
    step.timeout = sequenceItem.timeout || 120000;
    step.command = sequenceItem.command; // Add this line to parse the command

    // Phase 3: Parse conditional pathing directives
    if (sequenceItem.onSuccess) {
      step.onSuccess = { goto: sequenceItem.onSuccess.goto };
    }
    if (sequenceItem.onFailure) {
      step.onFailure = { goto: sequenceItem.onFailure.goto };
    }

    // Handle routing decisions
    if (step.routes) {
      step.type = 'routing';
      step.routingOptions = Object.keys(step.routes);
    }

    // Handle repeat cycles
    if (step.repeats) {
      step.type = 'cycle';
    }

    // logger.info(`📝 [WorkflowParser] Parsed step ${index}: ${step.agent || step.stepName} (${step.type})`);

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
      // 'routing_decision': null, // Routing steps should not have agents - handled by routing engine
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
      return step.stepName?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase());
    }
    if (step.agent && typeof step.agent === 'string') {
      return `${step.agent.toUpperCase()} Agent`;
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
    for (const step of workflow.steps) {
      if (step.agent && !this.validateAgent(step.agent)) {
        logger.warn(`⚠️ [WorkflowParser] Unknown agent: ${step.agent} in step ${step.index}`);
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
        const creates = Array.isArray(step.creates) ? step.creates : [step.creates];
        creates.forEach(artifact => createdArtifacts.add(artifact));
      }
    }

    logger.info(`✅ [WorkflowParser] Workflow validation complete: ${workflow.steps.length} steps, ${createdArtifacts.size} artifacts`);
  }

  validateAgent(agent) {
    const baseAgents = ['analyst', 'pm', 'architect', 'ux-expert', 'dev', 'qa', 'sm', 'po', 'system', 'bmad-orchestrator', 'various'];

    if (agent.includes('/')) {
        const agents = agent.split('/');
        return agents.every(agentName => baseAgents.includes(agentName.trim()));
    }

    return baseAgents.includes(agent);
  }

  /**
   * Resolve template and task references in workflow - deprecated
   * @param {Object} workflow - Workflow object
   * @returns {Object} Workflow with resolved references
   */
  async resolveReferences(workflow) {
    logger.warn(`⚠️ [WorkflowParser] resolveReferences is deprecated. Templates and tasks should be embedded in workflow config.`);
    return workflow;
  }

  /**
   * Resolve "uses:" reference - deprecated
   * @param {string} usesRef - Reference string
   * @returns {Object} Null - references should be embedded
   */
  async resolveUsesReference(usesRef) {
    logger.warn(`⚠️ [WorkflowParser] resolveUsesReference is deprecated. Reference '${usesRef}' should be embedded in workflow config.`);
    return null;
  }

  /**
   * Check if a workflow template exists in BMAD core folder
   * @param {string} workflowTemplate - Workflow template ID
   * @returns {boolean} True if workflow template exists
   */
  async workflowExists(workflowTemplate) {
    try {
      const possibleFiles = [
        `${workflowTemplate}.yaml`,
        `${workflowTemplate}.yml`
      ];
      
      for (const fileName of possibleFiles) {
        try {
          const filePath = path.join(this.workflowsDir, fileName);
          await fs.access(filePath);
          return true;
        } catch (error) {
          // Try next file extension
          continue;
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`❌ [WorkflowParser] Error checking workflow existence: ${error.message}`);
      return false;
    }
  }

  /**
   * List all available workflows from BMAD core folder
   * @returns {Array<string>} Array of workflow IDs
   */
  async listAvailableWorkflows() {
    try {
      const files = await fs.readdir(this.workflowsDir);
      const workflowFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
      
      const workflows = [];
      for (const file of workflowFiles) {
        try {
          const filePath = path.join(this.workflowsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const workflowData = yaml.load(content);
          
          if (workflowData && workflowData.workflow && workflowData.workflow.id) {
            workflows.push(workflowData.workflow.id);
          }
        } catch (fileError) {
          logger.warn(`⚠️ [WorkflowParser] Could not parse workflow file ${file}: ${fileError.message}`);
        }
      }
      
      return workflows;
    } catch (error) {
      logger.warn(`⚠️ [WorkflowParser] Could not list workflows: ${error.message}`);
      return [];
    }
  }

  /**
   * Get filtered workflows based on project context from BMAD core folder
   * @param {Array<string>} workflowIds - Array of workflow IDs
   * @param {Object} projectContext - Project context with type and scope
   * @returns {Array<Object>} Filtered and scored workflow objects
   */
  async getFilteredWorkflows(workflowIds, projectContext = {}) {
    logger.info(`🔍 [WorkflowParser] Filtering workflows for context:`, projectContext);
    
    const workflows = [];

    for (const workflowId of workflowIds) {
      try {
        const workflowData = await this.parseWorkflowFile(workflowId);
        
        // Create workflow object with metadata
        const workflow = {
          id: workflowData.id,
          name: workflowData.name,
          description: workflowData.description,
          type: workflowData.type,
          projectTypes: workflowData.projectTypes,
          steps: workflowData.steps?.length || 0,
          agents: this.extractAgentsFromSteps(workflowData.steps),
          complexity: this.calculateComplexity(workflowData.steps),
          estimatedDuration: this.calculateEstimatedTime(workflowData.steps),
          templateId: workflowId,
          recommended: false
        };

        workflows.push(workflow);
      } catch (error) {
        logger.warn(`⚠️ [WorkflowParser] Failed to process workflow ${workflowId}:`, error.message);
      }
    }

    // Apply filtering if project context is provided
    let filteredWorkflows = workflows;
    
    if (projectContext.type) {
      filteredWorkflows = workflows.filter(workflow =>
        workflow.projectTypes && workflow.projectTypes.includes(projectContext.type)
      );
      
      logger.info(`🎯 [WorkflowParser] Filtered ${workflows.length} workflows to ${filteredWorkflows.length} matching '${projectContext.type}'`);
    }

    // Apply recommendation scoring
    filteredWorkflows = filteredWorkflows.map(workflow => ({
      ...workflow,
      recommended: this.calculateRecommendationScore(workflow, projectContext) >= 0.8
    }));

    // Sort by recommendation first, then name
    filteredWorkflows.sort((a, b) => {
      if (a.recommended !== b.recommended) {
        return b.recommended ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    logger.info(`✅ [WorkflowParser] Returning ${filteredWorkflows.length} workflows, ${filteredWorkflows.filter(w => w.recommended).length} recommended`);

    return filteredWorkflows;
  }

  /**
   * Extract unique agents from workflow steps
   * @param {Array} steps - Workflow steps
   * @returns {Array<string>} Array of agent IDs
   */
  extractAgentsFromSteps(steps) {
    const agents = new Set();
    if (!steps) return [];
    
    steps.forEach(step => {
      if (step.agent && step.agent !== 'bmad-orchestrator') {
        agents.add(step.agent);
      }
    });
    
    return Array.from(agents);
  }

  /**
   * Calculate workflow complexity based on steps
   * @param {Array} steps - Workflow steps
   * @returns {string} Complexity level
   */
  calculateComplexity(steps) {
    const stepCount = steps?.length || 0;
    const uniqueAgents = this.extractAgentsFromSteps(steps).length;
    
    if (stepCount <= 3 && uniqueAgents <= 2) return 'Simple';
    if (stepCount <= 8 && uniqueAgents <= 4) return 'Moderate';
    return 'Complex';
  }

  /**
   * Calculate estimated duration based on steps
   * @param {Array} steps - Workflow steps  
   * @returns {string} Estimated duration
   */
  calculateEstimatedTime(steps) {
    const stepCount = steps?.length || 0;
    const uniqueAgents = this.extractAgentsFromSteps(steps).length;
    
    const baseTimePerStep = 5; // minutes
    const agentSwitchTime = 2; // minutes
    
    const totalTime = (stepCount * baseTimePerStep) + (uniqueAgents * agentSwitchTime);
    
    if (totalTime <= 15) return '10-15 minutes';
    if (totalTime <= 30) return '20-30 minutes';
    if (totalTime <= 60) return '45-60 minutes';
    return '60+ minutes';
  }

  /**
   * Calculate recommendation score for a workflow based on project context
   * Dynamic scoring based on actual workflow data - NO hardcoded mappings
   * @param {Object} workflow - Workflow object
   * @param {Object} projectContext - Project context
   * @returns {number} Score between 0 and 1
   */
  calculateRecommendationScore(workflow, projectContext) {
    let score = 0;
    
    if (!projectContext.type) {
      return 0; // No context to score against
    }
    
    // Primary match: Exact project type match (highest weight)
    if (workflow.projectTypes?.includes(projectContext.type)) {
      score += 0.7; // Higher weight for exact matches
    }
    
    // Secondary match: Related project types
    if (workflow.projectTypes?.length > 0 && projectContext.type) {
      const relatedScore = this.calculateProjectTypeRelatedness(workflow.projectTypes, projectContext.type);
      score += relatedScore * 0.2; // Lower weight for related matches
    }
    
    // Scope alignment scoring (dynamic based on workflow type)
    if (projectContext.scope && workflow.type) {
      const scopeAlignment = this.calculateScopeAlignment(workflow.type, projectContext.scope);
      score += scopeAlignment * 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate relatedness between project types without hardcoded mappings
   * @param {Array} workflowProjectTypes - Project types supported by workflow
   * @param {string} userProjectType - User's selected project type
   * @returns {number} Relatedness score between 0 and 1
   */
  calculateProjectTypeRelatedness(workflowProjectTypes, userProjectType) {
    // API-related types
    const apiTypes = ['rest-api', 'graphql-api', 'microservice', 'backend-service', 'api-prototype', 'simple-service'];
    const webTypes = ['web-app', 'saas', 'enterprise-app', 'prototype', 'mvp'];
    const enhancementTypes = ['feature-addition', 'refactoring', 'modernization', 'integration-enhancement'];
    
    const typeCategories = [apiTypes, webTypes, enhancementTypes];
    
    // Find which category the user's type belongs to
    const userCategory = typeCategories.find(category => category.includes(userProjectType));
    if (!userCategory) return 0;
    
    // Check if workflow supports any types in the same category
    const hasRelatedType = workflowProjectTypes.some(type => userCategory.includes(type));
    return hasRelatedType ? 0.5 : 0;
  }

  /**
   * Calculate alignment between workflow type and scope
   * @param {string} workflowType - Workflow type (greenfield/brownfield)
   * @param {string} scope - Project scope (mvp/feature/enterprise/modernization)
   * @returns {number} Alignment score between 0 and 1
   */
  calculateScopeAlignment(workflowType, scope) {
    const alignments = {
      'mvp': workflowType?.includes('greenfield') ? 1.0 : 0.3,
      'feature': workflowType?.includes('brownfield') ? 1.0 : 0.2,
      'enterprise': workflowType?.includes('fullstack') ? 1.0 : 0.5,
      'modernization': workflowType?.includes('brownfield') ? 1.0 : 0.1
    };
    
    return alignments[scope] || 0.5; // Default moderate alignment
  }
}

export default WorkflowParser;