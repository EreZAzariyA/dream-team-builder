import mongoose from 'mongoose';

const AgentExecutionSchema = new mongoose.Schema({
  // Core Identifiers
  workflowId: {
    type: String, // STANDARDIZED: Use string workflow IDs consistently (BMAD format: "workflow_1755767413428_4le23b5")
    required: [true, 'Workflow ID is required'],
    index: true,
  },
  
  agentId: {
    type: String,
    required: [true, 'Agent ID is required'],
    index: true,
  },
  
  agentName: {
    type: String,
    required: [true, 'Agent name is required'],
  },
  
  // Execution Status
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'error', 'cancelled', 'timeout'],
    default: 'pending',
    index: true,
  },
  
  // Timing Information
  startedAt: {
    type: Date,
    index: true,
  },
  
  completedAt: {
    type: Date,
    index: true,
  },
  
  duration: {
    type: Number, // in milliseconds
    default: 0,
  },
  
  timeout: {
    type: Number, // in milliseconds
    default: 300000, // 5 minutes default
  },
  
  // Input and Output Data
  input: {
    prompt: String,
    context: mongoose.Schema.Types.Mixed,
    parameters: mongoose.Schema.Types.Mixed,
    dependencies: [String], // Array of dependency names
  },
  
  output: {
    content: String,
    // REMOVED: artifacts[] - Eliminating duplication, artifacts stored in Workflow.bmadWorkflowData.artifacts[] only
    summary: String,
    recommendations: [String],
    metrics: {
      executionTime: Number,
      memoryUsage: Number,
      apiCalls: Number,
      tokensProcessed: Number,
    },
  },
  
  // REMOVED: messages[] - Eliminating duplication, messages stored in Workflow.bmadWorkflowData.messages[] only
  
  // Resource Management
  resources: [{
    type: {
      type: String,
      enum: ['task', 'template', 'checklist', 'data', 'config'],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    path: String,
    content: String,
    size: Number,
    lastModified: Date,
    loadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Performance Metrics
  performance: {
    cpuUsage: Number, // percentage
    memoryUsage: Number, // in MB
    networkRequests: Number,
    responseTime: Number, // in milliseconds
    throughput: Number, // operations per second
    errorRate: Number, // percentage
    availability: Number, // percentage
  },
  
  // Error Handling
  errors: [{
    code: String,
    message: String,
    stack: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolution: String,
  }],
  
  // Retry Logic
  retryCount: {
    type: Number,
    default: 0,
  },
  
  maxRetries: {
    type: Number,
    default: 3,
  },
  
  retryHistory: [{
    attempt: Number,
    startedAt: Date,
    failedAt: Date,
    error: String,
    reason: String,
  }],
  
  // Agent Configuration
  configuration: {
    version: String,
    parameters: mongoose.Schema.Types.Mixed,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
    },
    capabilities: [String],
    limitations: [String],
  },
  
  // Execution Context
  context: {
    previousAgent: String,
    nextAgent: String,
    dependencies: [String],
    sharedData: mongoose.Schema.Types.Mixed,
    globalContext: mongoose.Schema.Types.Mixed,
  },
  
  // Quality Metrics
  quality: {
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
    metrics: {
      accuracy: Number,
      completeness: Number,
      timeliness: Number,
      consistency: Number,
    },
    feedback: String,
    reviewedBy: String,
    reviewedAt: Date,
  },
  
  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'started', 'paused', 'resumed', 'completed', 'failed', 'cancelled'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userId: mongoose.Schema.Types.ObjectId,
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true,
});

// Indexes for better performance
AgentExecutionSchema.index({ workflowId: 1, startedAt: 1 });
AgentExecutionSchema.index({ agentId: 1, status: 1 });
AgentExecutionSchema.index({ status: 1, createdAt: -1 });
 
AgentExecutionSchema.index({ 'messages.timestamp': 1 });

// Pre-save middleware
AgentExecutionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate duration if both start and end times exist
  if (this.startedAt && this.completedAt) {
    this.duration = this.completedAt - this.startedAt;
  }
  
  next();
});

// Virtual fields
AgentExecutionSchema.virtual('isRunning').get(function() {
  return this.status === 'active';
});

AgentExecutionSchema.virtual('isCompleted').get(function() {
  return ['completed', 'error', 'cancelled', 'timeout'].includes(this.status);
});

AgentExecutionSchema.virtual('hasErrors').get(function() {
  return this.errors && this.errors.some(error => !error.resolved);
});

AgentExecutionSchema.virtual('successRate').get(function() {
  if (this.retryCount === 0) return 100;
  return Math.round(((this.retryCount - this.errors.length) / this.retryCount) * 100);
});

AgentExecutionSchema.virtual('averageResponseTime').get(function() {
  if (!this.messages || this.messages.length === 0) return 0;
  
  const responseTimes = this.messages
    .filter(msg => msg.type === 'output')
    .map(msg => msg.metadata?.responseTime)
    .filter(time => time !== undefined);
    
  if (responseTimes.length === 0) return 0;
  
  return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
});

// Instance Methods
AgentExecutionSchema.methods.start = function(input = {}) {
  this.status = 'active';
  this.startedAt = new Date();
  this.input = { ...this.input, ...input };
  
  this.auditLog.push({
    action: 'started',
    details: { input },
  });
  
  return this.save();
};

AgentExecutionSchema.methods.complete = function(output = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.output = { ...this.output, ...output };
  
  this.auditLog.push({
    action: 'completed',
    details: { output },
  });
  
  return this.save();
};

AgentExecutionSchema.methods.fail = function(error) {
  this.status = 'error';
  this.completedAt = new Date();
  
  this.errors.push({
    message: error.message || error,
    stack: error.stack,
    timestamp: new Date(),
    severity: 'high',
  });
  
  this.auditLog.push({
    action: 'failed',
    details: { error: error.message || error },
  });
  
  return this.save();
};

AgentExecutionSchema.methods.cancel = function(reason = 'User cancelled') {
  this.status = 'cancelled';
  this.completedAt = new Date();
  
  this.auditLog.push({
    action: 'cancelled',
    details: { reason },
  });
  
  return this.save();
};

AgentExecutionSchema.methods.retry = function() {
  if (this.retryCount >= this.maxRetries) {
    throw new Error('Maximum retry limit reached');
  }
  
  this.retryHistory.push({
    attempt: this.retryCount + 1,
    startedAt: new Date(),
    failedAt: this.completedAt,
    error: this.errors[this.errors.length - 1]?.message,
  });
  
  this.retryCount += 1;
  this.status = 'pending';
  this.startedAt = null;
  this.completedAt = null;
  
  return this.save();
};

// REMOVED: addMessage() - Messages now stored only in Workflow.bmadWorkflowData.messages[]

// REMOVED: addArtifact() - Artifacts now stored only in Workflow.bmadWorkflowData.artifacts[]

AgentExecutionSchema.methods.updatePerformance = function(metrics) {
  this.performance = { ...this.performance, ...metrics };
  return this.save();
};

// Static Methods
AgentExecutionSchema.statics.findByWorkflow = function(workflowId, options = {}) {
  const query = { workflowId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.agentId) {
    query.agentId = options.agentId;
  }
  
  return this.find(query).sort({ startedAt: 1 });
};

AgentExecutionSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ startedAt: 1 });
};

AgentExecutionSchema.statics.getExecutionStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.workflowId) {
    matchStage.workflowId = filters.workflowId; // STANDARDIZED: Use string workflow ID directly (no ObjectId conversion)
  }
  
  if (filters.agentId) {
    matchStage.agentId = filters.agentId;
  }
  
  if (filters.dateRange) {
    matchStage.createdAt = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end,
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        totalDuration: { $sum: '$duration' },
        avgRetries: { $avg: '$retryCount' },
      }
    }
  ]);
  
  const summary = {
    total: 0,
    pending: 0,
    active: 0,
    completed: 0,
    error: 0,
    cancelled: 0,
    avgDuration: 0,
    totalDuration: 0,
    successRate: 0,
  };
  
  stats.forEach(stat => {
    summary.total += stat.count;
    summary[stat._id] = stat.count;
    summary.totalDuration += stat.totalDuration || 0;
    
    if (stat._id === 'completed' && stat.avgDuration) {
      summary.avgDuration = stat.avgDuration;
    }
  });
  
  if (summary.total > 0) {
    summary.successRate = Math.round((summary.completed / summary.total) * 100);
  }
  
  return summary;
};

AgentExecutionSchema.statics.getPerformanceMetrics = async function(agentId, timeframe = '24h') {
  const timeMap = {
    '1h': 1 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  
  const startTime = new Date(Date.now() - (timeMap[timeframe] || timeMap['24h']));
  
  const metrics = await this.aggregate([
    {
      $match: {
        agentId,
        createdAt: { $gte: startTime },
        status: { $in: ['completed', 'error'] },
      }
    },
    {
      $group: {
        _id: null,
        avgDuration: { $avg: '$duration' },
        avgCpuUsage: { $avg: '$performance.cpuUsage' },
        avgMemoryUsage: { $avg: '$performance.memoryUsage' },
        avgResponseTime: { $avg: '$performance.responseTime' },
        totalExecutions: { $sum: 1 },
        successfulExecutions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalErrors: { $sum: { $size: '$errors' } },
      }
    }
  ]);
  
  const result = metrics[0] || {};
  
  return {
    avgDuration: result.avgDuration || 0,
    avgCpuUsage: result.avgCpuUsage || 0,
    avgMemoryUsage: result.avgMemoryUsage || 0,
    avgResponseTime: result.avgResponseTime || 0,
    totalExecutions: result.totalExecutions || 0,
    successRate: result.totalExecutions ? 
      Math.round((result.successfulExecutions / result.totalExecutions) * 100) : 0,
    errorRate: result.totalExecutions ? 
      Math.round((result.totalErrors / result.totalExecutions) * 100) : 0,
    timeframe,
    calculatedAt: new Date(),
  };
};

// Export model
const AgentExecution = mongoose.models.AgentExecution || mongoose.model('AgentExecution', AgentExecutionSchema);
export default AgentExecution;