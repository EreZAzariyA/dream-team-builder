import mongoose from 'mongoose';

const WorkflowSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Workflow title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: '',
  },
  
  // User Association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  
  // Workflow Configuration
  prompt: {
    type: String,
    required: [true, 'Initial prompt is required'],
    maxlength: [5000, 'Prompt cannot exceed 5000 characters'],
  },
  
  template: {
    type: String,
    enum: [
      'greenfield-fullstack',
      'brownfield-refactor',
      'bug-fix-workflow',
      'feature-enhancement',
      'documentation-generation',
      'custom'
    ],
    default: 'greenfield-fullstack',
  },
  
  // Workflow Status
  status: {
    type: String,
    enum: ['draft', 'running', 'completed', 'paused', 'error', 'cancelled'],
    default: 'draft',
  },
  
  // Agent Configuration
  agentSequence: [{
    agentId: {
      type: String,
      required: true,
    },
    agentName: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'skipped', 'error'],
      default: 'pending',
    },
    startedAt: Date,
    completedAt: Date,
    duration: Number, // in milliseconds
  }],
  
  currentAgent: {
    agentId: String,
    agentName: String,
    startedAt: Date,
  },
  
  // Execution Context
  executionContext: {
    totalSteps: {
      type: Number,
      default: 0,
    },
    completedSteps: {
      type: Number,
      default: 0,
    },
    currentStep: {
      type: Number,
      default: 0,
    },
    estimatedDuration: Number, // in milliseconds
    actualDuration: Number, // in milliseconds
  },
  
  // Timing
  startedAt: {
    type: Date,
  },
  
  completedAt: Date,
  
  pausedAt: Date,
  
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  // Results and Outputs
  outputs: [{
    agentId: String,
    agentName: String,
    type: {
      type: String,
      enum: ['document', 'code', 'analysis', 'report', 'artifact'],
    },
    title: String,
    content: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Error Handling
  errors: [{
    agentId: String,
    agentName: String,
    error: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  }],
  
  // Metadata
  metadata: {
    tags: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    category: {
      type: String,
      maxlength: 100,
    },
    estimatedComplexity: {
      type: String,
      enum: ['simple', 'medium', 'complex', 'very-complex'],
      default: 'medium',
    },
    businessValue: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
  },
  
  // Collaboration
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    role: {
      type: String,
      enum: ['viewer', 'contributor', 'admin'],
      default: 'viewer',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  
  // Workflow Settings
  settings: {
    autoAdvance: {
      type: Boolean,
      default: true,
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    retryOnError: {
      type: Boolean,
      default: true,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
  },
  
  // Bookmarking and Notes
  isBookmarked: {
    type: Boolean,
    default: false,
  },
  
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    default: '',
  },
  
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
WorkflowSchema.index({ userId: 1, createdAt: -1 });
WorkflowSchema.index({ status: 1 });
WorkflowSchema.index({ 'metadata.tags': 1 });
WorkflowSchema.index({ startedAt: 1 });
WorkflowSchema.index({ lastActivity: -1 });
WorkflowSchema.index({ 'metadata.priority': 1, status: 1 });

// Pre-save middleware
WorkflowSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.lastActivity = Date.now();
  
  // Update execution context
  if (this.agentSequence) {
    this.executionContext.totalSteps = this.agentSequence.length;
    this.executionContext.completedSteps = this.agentSequence.filter(
      agent => agent.status === 'completed'
    ).length;
    
    const activeAgent = this.agentSequence.find(agent => agent.status === 'active');
    if (activeAgent) {
      this.executionContext.currentStep = activeAgent.order;
    }
  }
  
  next();
});

// Virtual fields
WorkflowSchema.virtual('progress').get(function() {
  if (this.executionContext.totalSteps === 0) return 0;
  return Math.round((this.executionContext.completedSteps / this.executionContext.totalSteps) * 100);
});

WorkflowSchema.virtual('duration').get(function() {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || Date.now();
  return endTime - this.startedAt;
});

WorkflowSchema.virtual('isActive').get(function() {
  return ['running', 'paused'].includes(this.status);
});

WorkflowSchema.virtual('hasErrors').get(function() {
  return this.errors && this.errors.some(error => !error.resolved);
});

// Instance Methods
WorkflowSchema.methods.start = function() {
  this.status = 'running';
  this.startedAt = new Date();
  return this.save();
};

WorkflowSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.executionContext.actualDuration = this.duration;
  return this.save();
};

WorkflowSchema.methods.pause = function() {
  this.status = 'paused';
  this.pausedAt = new Date();
  return this.save();
};

WorkflowSchema.methods.resume = function() {
  this.status = 'running';
  this.pausedAt = null;
  return this.save();
};

WorkflowSchema.methods.cancel = function() {
  this.status = 'cancelled';
  this.completedAt = new Date();
  return this.save();
};

WorkflowSchema.methods.addError = function(agentId, agentName, error) {
  this.errors.push({
    agentId,
    agentName,
    error,
    timestamp: new Date(),
  });
  this.status = 'error';
  return this.save();
};

WorkflowSchema.methods.resolveError = function(errorId) {
  const error = this.errors.id(errorId);
  if (error) {
    error.resolved = true;
    // If all errors are resolved, resume workflow
    if (!this.hasErrors) {
      this.status = 'running';
    }
  }
  return this.save();
};

WorkflowSchema.methods.addOutput = function(agentId, agentName, outputData) {
  this.outputs.push({
    agentId,
    agentName,
    ...outputData,
    createdAt: new Date(),
  });
  return this.save();
};

WorkflowSchema.methods.updateAgentStatus = function(agentId, status, timing = {}) {
  const agent = this.agentSequence.find(a => a.agentId === agentId);
  if (agent) {
    agent.status = status;
    
    if (status === 'active') {
      agent.startedAt = timing.startedAt || new Date();
      this.currentAgent = {
        agentId: agent.agentId,
        agentName: agent.agentName,
        startedAt: agent.startedAt,
      };
    } else if (status === 'completed') {
      agent.completedAt = timing.completedAt || new Date();
      if (agent.startedAt) {
        agent.duration = agent.completedAt - agent.startedAt;
      }
      
      // Clear current agent if this was the active one
      if (this.currentAgent?.agentId === agentId) {
        this.currentAgent = null;
      }
    }
  }
  return this.save();
};

// Static Methods
WorkflowSchema.statics.findByUser = function(userId, filters = {}) {
  const query = { userId };
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query['metadata.tags'] = { $in: filters.tags };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

WorkflowSchema.statics.findActive = function() {
  return this.find({ status: { $in: ['running', 'paused'] } })
    .sort({ lastActivity: -1 });
};

WorkflowSchema.statics.getWorkflowStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: userId ? { userId: mongoose.Types.ObjectId(userId) } : {} },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$executionContext.actualDuration' },
      }
    }
  ]);
  
  const summary = {
    total: 0,
    running: 0,
    completed: 0,
    error: 0,
    paused: 0,
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

// Export model
const Workflow = mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema);
export default Workflow;