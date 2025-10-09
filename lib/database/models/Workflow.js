import mongoose from 'mongoose';

const WorkflowSchema = new mongoose.Schema({
  // Let MongoDB handle _id as ObjectId automatically
  
  // Custom workflow identifier for BMAD system
  workflowId: {
    type: String,
    required: [true, 'Workflow ID is required'],
    unique: true,
    index: true,
  },
  
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
      'greenfield-ui',
      'greenfield-service',
      'brownfield-fullstack',
      'brownfield-ui',
      'brownfield-service',
      'bug-fix-workflow',
      'feature-enhancement',
      'documentation-generation',
      'custom'
    ],
    default: 'greenfield-fullstack',
  },
  
  // Workflow Status - BMAD standardized statuses only
  status: {
    type: String,
    enum: [
      'RUNNING', 'COMPLETED', 'PAUSED', 'ERROR', 'CANCELLED', 'PAUSED_FOR_ELICITATION'
    ],
    default: 'PAUSED', // Default to PAUSED instead of draft
  },
  
  // REMOVED: agentSequence[] - Legacy agent tracking eliminated
  // All agent sequences now stored in bmadWorkflowData.sequence[] only
  
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
  
  // REMOVED: outputs[] - Legacy artifact storage eliminated
  // All artifacts now stored in bmadWorkflowData.artifacts[] only
  
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
    // GitHub integration metadata
    github: {
      owner: String,
      name: String,
      targetBranch: String,
      repositoryUrl: String,
      capabilities: [{
        type: String,
        trim: true
      }]
    },
  },
  
  // Repository analysis data for agents
  repositoryAnalysis: {
    repository: {
      name: String,
      owner: String,
      fullName: String,
      description: String
    },
    analysis: mongoose.Schema.Types.Mixed, // Full RepoAnalysis document
    fileIndex: [{
      path: String,
      language: String,
      extension: String,
      size: Number,
      lines: Number,
      sha: String
    }],
    metrics: {
      fileCount: Number,
      totalLines: Number,
      totalSize: Number,
      languageCount: Number,
      languages: mongoose.Schema.Types.Mixed
    },
    summary: String,
    insights: mongoose.Schema.Types.Mixed,
    development: {
      framework: String,
      languages: mongoose.Schema.Types.Mixed,
      fileCount: Number,
      totalLines: Number
    }
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
  
  // BMAD-specific fields
  elicitationDetails: {
    sectionTitle: String,
    instruction: String,
    sectionId: String,
    agentId: String,
  },
  
  // BMAD workflow data with proper schema structure
  bmadWorkflowData: {
    sequence: [{
      type: mongoose.Schema.Types.Mixed
    }],
    currentStep: {
      type: Number,
      default: 0
    },
    totalSteps: {
      type: Number,
      default: 0
    },
    messages: [{
      id: String,
      from: { type: String, required: true },
      to: { type: String, required: true },
      type: { type: String, required: true },
      content: mongoose.Schema.Types.Mixed, // Flexible for different content types
      timestamp: { type: Date, default: Date.now },
      status: String
    }],
    artifacts: [{
      filename: String,
      type: String,
      agent: String,
      description: String,
      size: Number,
      savedAt: Date
    }],
    checkpoints: [{
      id: String,
      name: String,
      timestamp: Date,
      workflowState: mongoose.Schema.Types.Mixed
    }],
    errors: [{
      timestamp: Date,
      error: String,
      step: Number,
      type: String
    }],
    // Workflow execution context (routing decisions, agent state, etc.)
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
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
  
  // Update execution context from BMAD data
  if (this.bmadWorkflowData && this.bmadWorkflowData.sequence) {
    this.executionContext.totalSteps = this.bmadWorkflowData.totalSteps || this.bmadWorkflowData.sequence.length;
    this.executionContext.currentStep = this.bmadWorkflowData.currentStep || 0;
    this.executionContext.completedSteps = this.executionContext.currentStep;
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
  return ['RUNNING', 'PAUSED', 'PAUSED_FOR_ELICITATION'].includes(this.status); // BMAD standardized statuses
});

WorkflowSchema.virtual('hasErrors').get(function() {
  return this.errors && this.errors.some(error => !error.resolved);
});

// Instance Methods
WorkflowSchema.methods.start = function() {
  this.status = 'RUNNING'; // BMAD standardized status
  this.startedAt = new Date();
  return this.save();
};

WorkflowSchema.methods.complete = function() {
  this.status = 'COMPLETED'; // BMAD standardized status
  this.completedAt = new Date();
  this.executionContext.actualDuration = this.duration;
  return this.save();
};

WorkflowSchema.methods.pause = function() {
  this.status = 'PAUSED'; // BMAD standardized status
  this.pausedAt = new Date();
  return this.save();
};

WorkflowSchema.methods.resume = function() {
  this.status = 'RUNNING'; // BMAD standardized status
  this.pausedAt = null;
  return this.save();
};

WorkflowSchema.methods.cancel = function() {
  this.status = 'CANCELLED'; // BMAD standardized status
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
  this.status = 'ERROR'; // BMAD standardized status
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

// REMOVED: addOutput() - Legacy method for outputs[] array, now using bmadWorkflowData.artifacts[] only

// REMOVED: updateAgentStatus() - Legacy method for agentSequence[] array
// Agent status now managed through BMAD workflow engine directly

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
  return this.find({ status: { $in: ['RUNNING', 'PAUSED', 'PAUSED_FOR_ELICITATION'] } }) // BMAD standardized statuses
    .sort({ lastActivity: -1 });
};

WorkflowSchema.statics.getWorkflowStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: userId ? { userId: userId } : {} }, // FIXED: Direct ObjectId usage (userId is already ObjectId)
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

// Delete the existing model if it exists to force schema refresh
if (mongoose.models.Workflow) {
  delete mongoose.models.Workflow;
  delete mongoose.connection.models.Workflow;
}

const Workflow = mongoose.model('Workflow', WorkflowSchema);
export default Workflow;