/**
 * BMAD System Type Definitions
 */

const WorkflowStatus = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED', 
  PAUSED: 'PAUSED',
  PAUSED_FOR_ELICITATION: 'PAUSED_FOR_ELICITATION',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED'
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
  ELICITATION_REQUEST: 'elicitation_request',
  WORKFLOW_STEP_UPDATE: 'workflow:step-update',
  WORKFLOW_PROGRESS: 'workflow_progress',
  PRODUCTION_ENHANCEMENT: 'production_enhancement',
  AGENT_RESPONSE: 'agent_response'
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



// AgentRoles removed - ALL agent definitions are now loaded from .bmad-core folder

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
    optional_fields: ['description', 'timeout', 'retry_count', 'user_prompt'],
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
  ValidationSchemas
};