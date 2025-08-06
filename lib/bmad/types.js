/**
 * BMAD System Type Definitions
 */

const WorkflowStatus = {
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  PAUSED: 'paused',
  PAUSED_FOR_ELICITATION: 'PAUSED_FOR_ELICITATION',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
  ROLLING_BACK: 'rolling_back',
  ROLLED_BACK: 'rolled_back'
};

const AgentStatus = {
  IDLE: 'idle',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  TIMEOUT: 'timeout'
};

const MessageType = {
  ACTIVATION: 'activation',
  EXECUTION: 'execution',
  COMPLETION: 'completion',
  ERROR: 'error',
  INTER_AGENT: 'inter_agent',
  USER_INPUT: 'user_input',
  SYSTEM: 'system',
  WORKFLOW_COMPLETE: 'workflow_complete',
  ELICITATION_REQUEST: 'elicitation_request'
};

const ArtifactType = {
  DOCUMENT: 'document',
  CODE: 'code',
  CONFIGURATION: 'configuration',
  TEST: 'test',
  REPORT: 'report',
  ANALYSIS: 'analysis'
};

const DependencyType = {
  TASK: 'tasks',
  TEMPLATE: 'templates',
  CHECKLIST: 'checklists',
  DATA: 'data',
  WORKFLOW: 'workflows'
};

/**
 * Default BMAD workflow sequences
 */
const WorkflowSequences = {
  'brownfield-fullstack': [
    { agentId: 'analyst', role: 'Enhancement Classification', description: 'Classify enhancement scope and determine routing' },
    { agentId: 'pm', role: 'Product Requirements', description: 'Create brownfield PRD with existing system analysis' },
    { agentId: 'architect', role: 'Architecture Planning', description: 'Create architecture for significant architectural changes' },
    { agentId: 'po', role: 'Validation & Sharding', description: 'Validate all artifacts and shard documents for development' },
    { agentId: 'sm', role: 'Story Creation', description: 'Create stories from sharded docs or brownfield docs' },
    { agentId: 'analyst', role: 'Project Analysis', description: 'Create project brief with optional brainstorming and research' },
    { agentId: 'dev', role: 'Implementation', description: 'Implement approved stories' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Review implementation with refactoring ability' }
  ],
  
  'brownfield-service': [
    { agentId: 'architect', role: 'Service Analysis', description: 'Analyze existing service and document current state' },
    { agentId: 'pm', role: 'Service Requirements', description: 'Create brownfield PRD focused on service enhancement' },
    { agentId: 'architect', role: 'Service Analysis', description: 'Analyze existing service and document current state' },
    { agentId: 'po', role: 'Validation & Sharding', description: 'Validate all artifacts and shard documents for development' },
    { agentId: 'analyst', role: 'Project Analysis', description: 'Create project brief with optional brainstorming and research' },
    { agentId: 'sm', role: 'Story Creation', description: 'Create stories from sharded docs' },
    { agentId: 'dev', role: 'Implementation', description: 'Implement approved stories' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Review implementation with refactoring ability' }
  ],
  
  'brownfield-ui': [
    { agentId: 'architect', role: 'UI Analysis', description: 'Analyze existing frontend and document current state' },
    { agentId: 'pm', role: 'UI Requirements', description: 'Create brownfield PRD focused on UI enhancement' },
    { agentId: 'ux-expert', role: 'UI/UX Specification', description: 'Create UI/UX spec that integrates with existing design patterns' },
    { agentId: 'architect', role: 'UI Analysis', description: 'Analyze existing frontend and document current state' },
    { agentId: 'po', role: 'Validation & Sharding', description: 'Validate all artifacts and shard documents for development' },
    { agentId: 'sm', role: 'Story Creation', description: 'Create stories from sharded docs' },
    { agentId: 'analyst', role: 'Project Analysis', description: 'Create project brief with optional brainstorming and research' },
    { agentId: 'dev', role: 'Implementation', description: 'Implement approved stories' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Review implementation with refactoring ability' }
  ],

  'greenfield-fullstack': [
    { agentId: 'analyst', role: 'Project Analysis', description: 'Create project brief with optional brainstorming and research' },
    { agentId: 'pm', role: 'Product Requirements', description: 'Create PRD from project brief' },
    { agentId: 'ux-expert', role: 'UI/UX Design', description: 'Create UI/UX specification and optional v0 prompts' },
    { agentId: 'architect', role: 'Full-Stack Architecture', description: 'Create comprehensive architecture with optional technical research' },
    { agentId: 'po', role: 'Validation & Sharding', description: 'Validate all artifacts and shard documents for development' },
    { agentId: 'sm', role: 'Story Creation', description: 'Create stories from sharded docs' },
    { agentId: 'pm', role: 'UI Requirements', description: 'Create PRD focused on UI/frontend requirements' },
    { agentId: 'dev', role: 'Implementation', description: 'Implement approved stories' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Review implementation with refactoring ability' }
  ],

  'greenfield-service': [
    { agentId: 'analyst', role: 'Service Analysis', description: 'Create project brief with optional brainstorming and research' },
    { agentId: 'pm', role: 'Service Requirements', description: 'Create PRD focused on API/service requirements' },
    { agentId: 'architect', role: 'Service Architecture', description: 'Create backend/service architecture with optional technical research' },
    { agentId: 'po', role: 'Validation & Sharding', description: 'Validate all artifacts and shard documents for development' },
    { agentId: 'sm', role: 'Story Creation', description: 'Create stories from sharded docs' },
    { agentId: 'pm', role: 'UI Requirements', description: 'Create PRD focused on UI/frontend requirements' },
    { agentId: 'dev', role: 'Implementation', description: 'Implement approved stories' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Review implementation with refactoring ability' }
  ],

  'greenfield-ui': [
    { agentId: 'analyst', role: 'UI Analysis', description: 'Create project brief with optional brainstorming and research' },
    { agentId: 'pm', role: 'UI Requirements', description: 'Create PRD focused on UI/frontend requirements' },
    { agentId: 'ux-expert', role: 'UI/UX Design', description: 'Create UI/UX specification and optional v0 prompts' },
    { agentId: 'architect', role: 'Frontend Architecture', description: 'Create frontend architecture with optional technical research' },
    { agentId: 'po', role: 'Validation & Sharding', description: 'Validate all artifacts and shard documents for development' },
    { agentId: 'sm', role: 'Story Creation', description: 'Create stories from sharded docs' },
    { agentId: 'dev', role: 'Implementation', description: 'Implement approved stories' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Review implementation with refactoring ability' }
  ]
};

/**
 * Agent role definitions
 */
const AgentRoles = {
  ANALYST: {
    id: 'analyst',
    name: 'Business Analyst',
    icon: '📊',
    primary_capabilities: ['requirements_analysis', 'business_research', 'stakeholder_analysis'],
    typical_outputs: ['requirements_document', 'analysis_report', 'stakeholder_map']
  },
  
  PM: {
    id: 'pm',
    name: 'Product Manager',
    icon: '📋',
    primary_capabilities: ['product_strategy', 'roadmap_planning', 'prd_creation'],
    typical_outputs: ['prd', 'user_stories', 'acceptance_criteria', 'roadmap']
  },
  
  ARCHITECT: {
    id: 'architect',
    name: 'System Architect',
    icon: '🏗️',
    primary_capabilities: ['system_design', 'technology_selection', 'architecture_documentation'],
    typical_outputs: ['architecture_document', 'technical_specifications', 'design_patterns']
  },
  
  UX_EXPERT: {
    id: 'ux-expert',
    name: 'UX Expert',
    icon: '🎨',
    primary_capabilities: ['user_research', 'interface_design', 'usability_testing'],
    typical_outputs: ['wireframes', 'user_flows', 'design_system', 'usability_report']
  },
  
  DEVELOPER: {
    id: 'dev',
    name: 'Developer',
    icon: '💻',
    primary_capabilities: ['code_implementation', 'technical_problem_solving', 'code_review'],
    typical_outputs: ['source_code', 'configuration_files', 'implementation_notes']
  },
  
  QA: {
    id: 'qa',
    name: 'Quality Assurance',
    icon: '🧪',
    primary_capabilities: ['test_planning', 'test_execution', 'quality_validation'],
    typical_outputs: ['test_plan', 'test_cases', 'test_results', 'quality_report']
  },
  
  SCRUM_MASTER: {
    id: 'sm',
    name: 'Scrum Master',
    icon: '⚡',
    primary_capabilities: ['process_facilitation', 'team_coordination', 'impediment_removal'],
    typical_outputs: ['sprint_plan', 'retrospective_notes', 'process_improvements']
  },
  
  PRODUCT_OWNER: {
    id: 'po',
    name: 'Product Owner',
    icon: '🎯',
    primary_capabilities: ['backlog_management', 'stakeholder_communication', 'priority_setting'],
    typical_outputs: ['backlog', 'user_stories', 'acceptance_criteria', 'priority_matrix']
  }
};

/**
 * Validation schemas for workflow configuration
 */
const ValidationSchemas = {
  WORKFLOW_CONFIG: {
    required_fields: ['name', 'userPrompt'],
    optional_fields: ['description', 'sequence', 'context', 'metadata'],
    validation_rules: {
      name: { type: 'string', min_length: 1, max_length: 100 },
      userPrompt: { type: 'string', min_length: 10, max_length: 5000 },
      sequence: { type: 'array', min_items: 1, max_items: 10 }
    }
  },
  
  AGENT_STEP: {
    required_fields: ['agentId', 'role'],
    optional_fields: ['description', 'timeout', 'retry_count'],
    validation_rules: {
      agentId: { type: 'string', pattern: /^[a-z-]+$/ },
      role: { type: 'string', min_length: 1, max_length: 50 },
      timeout: { type: 'number', min: 10000, max: 300000 } // 10s to 5min
    }
  }
};

module.exports = {
  WorkflowStatus,
  AgentStatus,
  MessageType,
  ArtifactType,
  DependencyType,
  WorkflowSequences,
  AgentRoles,
  ValidationSchemas
};