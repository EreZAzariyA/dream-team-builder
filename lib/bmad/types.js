/**
 * BMAD System Type Definitions
 */

const WorkflowStatus = {
  INITIALIZING: 'initializing',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
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
  WORKFLOW_COMPLETE: 'workflow_complete'
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
  FULL_STACK: [
    { agentId: 'analyst', role: 'Business Analysis', description: 'Analyze requirements and business context' },
    { agentId: 'pm', role: 'Product Management', description: 'Create PRD and define product requirements' },
    { agentId: 'architect', role: 'System Architecture', description: 'Design system architecture' },
    { agentId: 'ux-expert', role: 'UX Design', description: 'Create user experience specifications' },
    { agentId: 'dev', role: 'Development', description: 'Implement the solution' },
    { agentId: 'qa', role: 'Quality Assurance', description: 'Test and validate implementation' }
  ],
  
  BACKEND_SERVICE: [
    { agentId: 'analyst', role: 'Requirements Analysis', description: 'Analyze service requirements' },
    { agentId: 'architect', role: 'Service Architecture', description: 'Design service architecture' },
    { agentId: 'dev', role: 'Implementation', description: 'Develop backend service' },
    { agentId: 'qa', role: 'Testing', description: 'Test service functionality' }
  ],
  
  FRONTEND_APPLICATION: [
    { agentId: 'pm', role: 'Product Definition', description: 'Define product requirements' },
    { agentId: 'ux-expert', role: 'UX Design', description: 'Design user experience' },
    { agentId: 'architect', role: 'Frontend Architecture', description: 'Design frontend architecture' },
    { agentId: 'dev', role: 'Implementation', description: 'Develop frontend application' },
    { agentId: 'qa', role: 'Testing', description: 'Test user interface and functionality' }
  ],

  DOCUMENTATION: [
    { agentId: 'analyst', role: 'Content Analysis', description: 'Analyze documentation requirements' },
    { agentId: 'pm', role: 'Documentation Planning', description: 'Plan documentation structure' },
    { agentId: 'ux-expert', role: 'Information Architecture', description: 'Design information architecture' },
    { agentId: 'dev', role: 'Content Creation', description: 'Create and organize content' }
  ],

  RESEARCH: [
    { agentId: 'analyst', role: 'Research Design', description: 'Design research methodology' },
    { agentId: 'pm', role: 'Research Planning', description: 'Plan research execution' },
    { agentId: 'analyst', role: 'Data Collection', description: 'Collect and analyze data' },
    { agentId: 'pm', role: 'Insights & Recommendations', description: 'Generate insights and recommendations' }
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