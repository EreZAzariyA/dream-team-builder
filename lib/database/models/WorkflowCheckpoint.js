/**
 * Workflow Checkpoint Model
 * Stores workflow state snapshots for rollback functionality
 */

const mongoose = require('mongoose');

const WorkflowCheckpointSchema = new mongoose.Schema({
  // Checkpoint identification
  checkpointId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  workflowId: {
    type: String,
    required: true,
    index: true
  },
  
  // Checkpoint metadata
  type: {
    type: String,
    required: true,
    enum: [
      'workflow_initialized',
      'before_agent_pm',
      'before_agent_architect', 
      'before_agent_dev',
      'before_agent_qa',
      'before_agent_analyst',
      'before_agent_ux-expert',
      'workflow_completed',
      'resume_from_rollback',
      'manual_checkpoint'
    ]
  },
  
  description: {
    type: String,
    default: ''
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Workflow state at checkpoint
  step: {
    type: Number,
    required: true,
    min: 0
  },
  
  currentAgent: {
    type: String,
    default: null
  },
  
  status: {
    type: String,
    required: true,
    enum: ['initializing', 'running', 'paused', 'completed', 'error', 'cancelled', 'rolling_back', 'rolled_back']
  },
  
  // Serialized workflow state
  state: {
    artifacts: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    
    messages: {
      type: [mongoose.Schema.Types.Mixed], 
      default: []
    },
    
    errors: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Optimization fields
  stateSize: {
    type: Number,
    default: 0
  },
  
  compressed: {
    type: Boolean,
    default: false
  },
  
  // User context
  userId: {
    type: String,
    index: true
  },
  
  // Lifecycle
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 } // TTL index
  }
}, {
  timestamps: true,
  collection: 'workflow_checkpoints'
});

// Indexes for performance
WorkflowCheckpointSchema.index({ workflowId: 1, timestamp: -1 });
WorkflowCheckpointSchema.index({ workflowId: 1, type: 1 });
WorkflowCheckpointSchema.index({ userId: 1, timestamp: -1 });

// Methods
WorkflowCheckpointSchema.methods.getStateSize = function() {
  return JSON.stringify(this.state).length;
};

WorkflowCheckpointSchema.methods.shouldCompress = function() {
  return this.getStateSize() > 50000; // 50KB threshold
};

// Statics
WorkflowCheckpointSchema.statics.findByWorkflow = function(workflowId, limit = 10) {
  return this.find({ workflowId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('-state') // Exclude large state field by default
    .lean();
};

WorkflowCheckpointSchema.statics.findLatestByType = function(workflowId, type) {
  return this.findOne({ workflowId, type })
    .sort({ timestamp: -1 })
    .lean();
};

WorkflowCheckpointSchema.statics.cleanup = function(olderThanDays = 7) {
  const cutoff = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
  return this.deleteMany({ 
    timestamp: { $lt: cutoff },
    type: { $ne: 'workflow_completed' } // Keep completion checkpoints longer
  });
};

// Pre-save middleware
WorkflowCheckpointSchema.pre('save', function(next) {
  // Calculate state size
  this.stateSize = this.getStateSize();
  
  // Set expiration (30 days default)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
  }
  
  next();
});

// Export model
module.exports = mongoose.models.WorkflowCheckpoint || mongoose.model('WorkflowCheckpoint', WorkflowCheckpointSchema);