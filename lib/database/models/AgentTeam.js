import mongoose from 'mongoose';
import logger from '../../utils/logger.js';

const AgentTeamSchema = new mongoose.Schema({
  // Team Identity
  teamId: {
    type: String,
    required: [true, 'Team ID is required'],
    index: true,
    // e.g., "team-fullstack", "team-no-ui", etc.
  },
  
  teamInstanceId: {
    type: String,
    required: [true, 'Team instance ID is required'],
    unique: true,
    index: true,
    // Unique identifier for this deployment instance
    default: function() {
      return `team-${this.teamId || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters'],
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: '',
  },
  
  icon: {
    type: String,
    default: '🤖',
    maxlength: [10, 'Icon cannot exceed 10 characters'],
  },
  
  // User Association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  
  // Team Configuration (from YAML)
  teamConfig: {
    // Available agents in this team
    agentIds: [{
      type: String,
      required: true,
      trim: true,
    }],
    
    // Workflows this team can execute
    availableWorkflows: [{
      type: String,
      required: true,
      // e.g., "greenfield-fullstack.yaml"
    }],
    
    // Team operational constraints
    constraints: {
      maxConcurrentWorkflows: {
        type: Number,
        default: 1,
        min: 1,
        max: 10,
      },
      
      allowedProjectTypes: [{
        type: String,
        // e.g., ["web-app", "rest-api", "microservice"]
      }],
      
      maxWorkflowDuration: {
        type: Number, // in minutes
        default: 480, // 8 hours default
      },
      
      requiresApproval: {
        type: Boolean,
        default: false,
      },
    },
    
    // Team capabilities metadata
    capabilities: {
      supportedTechnologies: [String],
      complexityLevel: {
        type: String,
        enum: ['simple', 'moderate', 'complex', 'enterprise'],
        default: 'moderate',
      },
      
      estimatedSpeed: {
        type: String,
        enum: ['fast', 'medium', 'comprehensive'],
        default: 'medium',
      },
    },
  },
  
  // Active Deployment State
  deployment: {
    status: {
      type: String,
      enum: [
        'pending',      // Team instance created, waiting to deploy
        'validating',   // Checking team/workflow compatibility
        'deploying',    // Starting workflow execution
        'active',       // Workflow running with this team
        'paused',       // Team deployment paused
        'completing',   // Workflow finishing up
        'completed',    // Team deployment finished successfully
        'failed',       // Team deployment failed
        'cancelled',    // User cancelled deployment
      ],
      default: 'pending',
      index: true,
    },
    
    // Link to active workflow
    workflowInstanceId: {
      type: String,
      // References Workflow._id (indexed via schema.index below)
    },
    
    selectedWorkflow: {
      workflowId: String,     // e.g., "greenfield-fullstack"
      workflowFile: String,   // e.g., "greenfield-fullstack.yaml"
      workflowName: String,   // Human-readable name
    },
    
    // User's project context
    projectContext: {
      type: {
        type: String,
        // e.g., "web-app", "rest-api", etc.
      },
      
      scope: {
        type: String,
        // e.g., "mvp", "feature", "enterprise"
      },
      
      // Additional context from user
      customContext: mongoose.Schema.Types.Mixed,
    },
    
    // User's initial prompt/requirements
    userPrompt: {
      type: String,
      maxlength: [5000, 'User prompt cannot exceed 5000 characters'],
    },
    
    // Deployment timing
    createdAt: {
      type: Date,
      default: Date.now,
    },
    
    deployedAt: Date,
    pausedAt: Date,
    completedAt: Date,
    
    // Deployment results
    result: {
      success: Boolean,
      errorMessage: String,
      artifacts: [{
        name: String,
        type: String,
        path: String,
        size: Number,
        createdAt: Date,
      }],
      
      metrics: {
        totalDuration: Number,  // in milliseconds
        agentExecutionTime: Map, // agentId -> execution time
        stepsCompleted: Number,
        stepsSkipped: Number,
        errorsEncountered: Number,
      },
    },
  },
  
  // Team Resource Management
  resources: {
    // Track agent utilization during deployment
    agentUtilization: {
      type: Map,
      of: {
        status: {
          type: String,
          enum: ['available', 'busy', 'error', 'offline'],
          default: 'available',
        },
        
        currentTask: String,
        lastUsed: Date,
        totalUsageTime: {
          type: Number,
          default: 0, // in milliseconds
        },
        
        performanceScore: {
          type: Number,
          min: 0,
          max: 100,
          default: 100,
        },
      },
    },
    
    // Resource limits and quotas
    resourceLimits: {
      cpuLimit: {
        type: Number,
        default: 100, // percentage
      },
      
      memoryLimit: {
        type: Number,
        default: 1024, // MB
      },
      
      concurrentAgents: {
        type: Number,
        default: 5,
      },
      
      maxExecutionTime: {
        type: Number,
        default: 28800000, // 8 hours in milliseconds
      },
    },
    
    // Real-time performance metrics
    performanceMetrics: {
      averageResponseTime: {
        type: Number,
        default: 0, // milliseconds
      },
      
      successRate: {
        type: Number,
        min: 0,
        max: 100,
        default: 100, // percentage
      },
      
      throughput: {
        type: Number,
        default: 0, // tasks per hour
      },
      
      reliability: {
        type: Number,
        min: 0,
        max: 100,
        default: 100, // percentage
      },
    },
  },
  
  // Collaboration & Access Control
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    role: {
      type: String,
      enum: ['owner', 'admin', 'contributor', 'viewer'],
      default: 'viewer',
    },
    
    permissions: [{
      type: String,
      enum: ['deploy', 'pause', 'cancel', 'view', 'configure'],
    }],
    
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Team Settings & Preferences
  settings: {
    // Notification preferences
    notifications: {
      onStart: { type: Boolean, default: true },
      onComplete: { type: Boolean, default: true },
      onError: { type: Boolean, default: true },
      onPause: { type: Boolean, default: false },
    },
    
    // Automation preferences
    automation: {
      autoRetryOnError: { type: Boolean, default: true },
      maxRetries: { type: Number, default: 3, min: 0, max: 10 },
      autoAdvanceSteps: { type: Boolean, default: true },
      pauseOnError: { type: Boolean, default: false },
    },
    
    // Monitoring preferences
    monitoring: {
      detailedLogging: { type: Boolean, default: true },
      realTimeUpdates: { type: Boolean, default: true },
      performanceTracking: { type: Boolean, default: true },
    },
  },
  
  // Error & Issue Tracking
  issues: [{
    type: {
      type: String,
      enum: ['validation_error', 'agent_error', 'workflow_error', 'resource_error', 'timeout'],
      required: true,
    },
    
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    
    details: mongoose.Schema.Types.Mixed,
    
    agentId: String, // Which agent caused the issue (if applicable)
    stepNumber: Number, // Which workflow step (if applicable)
    
    timestamp: {
      type: Date,
      default: Date.now,
    },
    
    resolved: {
      type: Boolean,
      default: false,
    },
    
    resolvedAt: Date,
    resolvedBy: String,
  }],
  
  // Metadata
  metadata: {
    version: {
      type: String,
      default: '1.0.0',
    },
    
    tags: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],
    
    category: {
      type: String,
      maxlength: 100,
    },
    
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
    },
  },
  
  // Team Collaboration & History
  collaboration: {
    type: {
      history: {
        type: [{
          event: String, // e.g., 'team_deployment_started', 'team_deployment_failed'
          timestamp: {
            type: Date,
            default: Date.now,
          },
          details: mongoose.Schema.Types.Mixed, // Flexible details object
        }],
        default: [],
      },
    },
    default: function() {
      return { history: [] };
    },
  },
  
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
AgentTeamSchema.index({ userId: 1, 'deployment.status': 1 });
AgentTeamSchema.index({ teamId: 1, 'deployment.status': 1 });
AgentTeamSchema.index({ 'deployment.workflowInstanceId': 1 });
AgentTeamSchema.index({ 'deployment.createdAt': -1 });
AgentTeamSchema.index({ 'metadata.priority': 1, 'deployment.status': 1 });

// Virtual fields
AgentTeamSchema.virtual('isActive').get(function() {
  return ['validating', 'deploying', 'active', 'paused'].includes(this.deployment.status);
});

AgentTeamSchema.virtual('duration').get(function() {
  if (!this.deployment.deployedAt) return 0;
  const endTime = this.deployment.completedAt || Date.now();
  return endTime - this.deployment.deployedAt;
});

AgentTeamSchema.virtual('hasUnresolvedIssues').get(function() {
  return this.issues && this.issues.some(issue => !issue.resolved);
});

AgentTeamSchema.virtual('deploymentProgress').get(function() {
  if (!this.deployment.result?.metrics) return 0;
  const { stepsCompleted, stepsSkipped } = this.deployment.result.metrics;
  const totalSteps = (stepsCompleted || 0) + (stepsSkipped || 0);
  if (totalSteps === 0) return 0;
  return Math.round((stepsCompleted / totalSteps) * 100);
});

// Instance Methods
AgentTeamSchema.methods.deploy = function(workflowData, projectContext, userPrompt) {
  this.deployment.status = 'validating';
  this.deployment.selectedWorkflow = workflowData;
  this.deployment.projectContext = projectContext;
  this.deployment.userPrompt = userPrompt;
  return this.save();
};

AgentTeamSchema.methods.start = function(workflowInstanceId) {
  this.deployment.status = 'active';
  this.deployment.workflowInstanceId = workflowInstanceId;
  this.deployment.deployedAt = new Date();
  return this.save();
};

AgentTeamSchema.methods.complete = function(result) {
  this.deployment.status = 'completed';
  this.deployment.completedAt = new Date();
  this.deployment.result = {
    success: true,
    ...result,
  };
  return this.save();
};

AgentTeamSchema.methods.fail = function(errorMessage, details = {}) {
  this.deployment.status = 'failed';
  this.deployment.completedAt = new Date();
  this.deployment.result = {
    success: false,
    errorMessage,
    ...details,
  };
  
  // Add to issues tracking
  this.issues.push({
    type: 'workflow_error',
    severity: 'high',
    message: errorMessage,
    details,
    timestamp: new Date(),
  });
  
  return this.save();
};

AgentTeamSchema.methods.pause = function(reason) {
  this.deployment.status = 'paused';
  this.deployment.pausedAt = new Date();
  
  if (reason) {
    this.issues.push({
      type: 'workflow_error',
      severity: 'medium',
      message: `Team deployment paused: ${reason}`,
      timestamp: new Date(),
    });
  }
  
  return this.save();
};

AgentTeamSchema.methods.resume = function() {
  this.deployment.status = 'active';
  this.deployment.pausedAt = null;
  return this.save();
};

AgentTeamSchema.methods.cancel = function(reason) {
  this.deployment.status = 'cancelled';
  this.deployment.completedAt = new Date();
  
  this.issues.push({
    type: 'workflow_error',
    severity: 'medium',
    message: `Team deployment cancelled: ${reason || 'User requested'}`,
    timestamp: new Date(),
  });
  
  return this.save();
};

AgentTeamSchema.methods.addIssue = function(type, severity, message, details = {}) {
  this.issues.push({
    type,
    severity,
    message,
    details,
    timestamp: new Date(),
  });
  return this.save();
};

AgentTeamSchema.methods.resolveIssue = function(issueId, resolvedBy) {
  const issue = this.issues.id(issueId);
  if (issue) {
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolvedBy = resolvedBy;
  }
  return this.save();
};

AgentTeamSchema.methods.updateAgentStatus = function(agentId, status, metrics = {}) {
  if (!this.resources.agentUtilization) {
    this.resources.agentUtilization = new Map();
  }
  
  const currentStatus = this.resources.agentUtilization.get(agentId) || {};
  this.resources.agentUtilization.set(agentId, {
    ...currentStatus,
    status,
    lastUsed: new Date(),
    ...metrics,
  });
  
  return this.save();
};

// Static Methods
AgentTeamSchema.statics.findByUser = function(userId, filters = {}) {
  const query = { userId };
  
  if (filters.status) {
    query['deployment.status'] = filters.status;
  }
  
  if (filters.teamId) {
    query.teamId = filters.teamId;
  }
  
  return this.find(query).sort({ 'deployment.createdAt': -1 });
};

AgentTeamSchema.statics.findActive = function() {
  return this.find({ 
    'deployment.status': { $in: ['validating', 'deploying', 'active', 'paused'] } 
  }).sort({ 'deployment.deployedAt': -1 });
};

AgentTeamSchema.statics.findByWorkflow = function(workflowInstanceId) {
  return this.findOne({ 'deployment.workflowInstanceId': workflowInstanceId });
};

AgentTeamSchema.statics.getTeamStats = async function(userId) {
  const pipeline = [
    ...(userId ? [{ $match: { userId: mongoose.Types.ObjectId(userId) } }] : []),
    {
      $group: {
        _id: '$deployment.status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$deployment.result.metrics.totalDuration' },
      }
    }
  ];
  
  const stats = await this.aggregate(pipeline);
  
  const summary = {
    total: 0,
    active: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    avgDuration: 0,
  };
  
  stats.forEach(stat => {
    summary.total += stat.count;
    summary[stat._id] = stat.count;
    if (stat._id === 'completed' && stat.avgDuration) {
      summary.avgDuration = stat.avgDuration;
    }
  });
  
  return summary;
};

/**
 * Instance Methods - Team Lifecycle Management
 */

// Fail the team deployment
AgentTeamSchema.methods.fail = async function(errorMessage, details = {}) {
  this.deployment.status = 'failed';
  this.deployment.endTime = new Date();
  this.deployment.result = {
    success: false,
    error: errorMessage,
    details,
    completedAt: new Date(),
  };
  
  // Add error to history
  this.collaboration.history.push({
    event: 'team_deployment_failed',
    timestamp: new Date(),
    details: {
      error: errorMessage,
      ...details
    }
  });
  
  await this.save();
  logger.error(`❌ [AgentTeam] Team ${this.teamInstanceId} failed: ${errorMessage}`);
  return this;
};

// Complete the team deployment
AgentTeamSchema.methods.complete = async function(result = {}) {
  this.deployment.status = 'completed';
  this.deployment.endTime = new Date();
  this.deployment.result = {
    success: true,
    ...result,
    completedAt: new Date(),
  };
  
  // Add completion to history
  this.collaboration.history.push({
    event: 'team_deployment_completed',
    timestamp: new Date(),
    details: result
  });
  
  await this.save();
  logger.info(`✅ [AgentTeam] Team ${this.teamInstanceId} completed successfully`);
  return this;
};

// Cancel the team deployment
AgentTeamSchema.methods.cancel = async function(reason = 'User cancelled') {
  this.deployment.status = 'cancelled';
  this.deployment.endTime = new Date();
  this.deployment.result = {
    success: false,
    cancelled: true,
    reason,
    completedAt: new Date(),
  };
  
  // Add cancellation to history
  this.collaboration.history.push({
    event: 'team_deployment_cancelled',
    timestamp: new Date(),
    details: { reason }
  });
  
  await this.save();
  logger.info(`⚠️ [AgentTeam] Team ${this.teamInstanceId} cancelled: ${reason}`);
  return this;
};

// Pre-save middleware
AgentTeamSchema.pre('save', function(next) {
  // Ensure teamInstanceId is always set
  if (!this.teamInstanceId || this.teamInstanceId === '') {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const teamPrefix = this.teamId || 'unknown';
    this.teamInstanceId = `team-${teamPrefix}-${timestamp}-${randomId}`;
  }
  
  // Update performance metrics
  if (this.deployment.status === 'completed' && this.deployment.result) {
    const duration = this.duration;
    if (duration > 0) {
      this.resources.performanceMetrics.averageResponseTime = duration / (this.deployment.result.metrics?.stepsCompleted || 1);
    }
  }
  
  next();
});

// Delete existing model if it exists to force schema refresh
if (mongoose.models.AgentTeam) {
  delete mongoose.models.AgentTeam;
  delete mongoose.connection.models.AgentTeam;
}

const AgentTeam = mongoose.model('AgentTeam', AgentTeamSchema);
export default AgentTeam;