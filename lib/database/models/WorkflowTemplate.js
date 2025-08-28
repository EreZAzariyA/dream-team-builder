
import mongoose from 'mongoose';

const WorkflowTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: false,
    trim: true,
  },
  type: {
    type: String,
    enum: ['greenfield', 'brownfield', 'maintenance', 'enhancement', 'general'],
    default: 'general',
  },
  project_types: [{
    type: String,
    trim: true,
  }],
  sequence: [{
    agent: { type: String, required: true },
    action: { type: String },
    creates: { type: String },
    requires: [{ type: String }],
    notes: { type: String },
    optional: { type: Boolean, default: false },
    condition: { type: String },
    optional_steps: [{ type: String }],
  }],
  decision_guidance: {
    when_to_use: [{ type: String }],
    complexity: { type: String, enum: ['Simple', 'Moderate', 'Complex'] },
    estimated_time: { type: String },
  },
  handoff_prompts: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Computed fields for easy filtering
  agents: [{ type: String }], // Extracted from sequence
  stepCount: { type: Number, default: 0 },
  complexity: { 
    type: String, 
    enum: ['Simple', 'Moderate', 'Complex'], 
    default: 'Simple' 
  },
  estimatedTime: { type: String, default: '15-30 minutes' },
  
  // Legacy compatibility fields
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  versionKey: false
});

// Pre-save middleware to calculate computed fields
WorkflowTemplateSchema.pre('save', function(next) {
  // Extract unique agents from sequence
  const agents = new Set();
  for (const step of this.sequence) {
    if (step.agent) {
      agents.add(step.agent);
    }
  }
  this.agents = Array.from(agents);
  
  // Set step count
  this.stepCount = this.sequence.length;
  
  // Calculate complexity based on sequence
  const stepCount = this.sequence.length;
  const uniqueAgents = this.agents.length;
  
  if (stepCount <= 3 && uniqueAgents <= 2) {
    this.complexity = 'Simple';
    this.estimatedTime = '10-15 minutes';
  } else if (stepCount <= 8 && uniqueAgents <= 4) {
    this.complexity = 'Moderate';
    this.estimatedTime = '20-30 minutes';
  } else {
    this.complexity = 'Complex';
    this.estimatedTime = '45-60 minutes';
  }
  
  next();
});

// Instance methods
WorkflowTemplateSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static methods
WorkflowTemplateSchema.statics.findByType = function(type) {
  return this.find({ type, isActive: true });
};

WorkflowTemplateSchema.statics.findByCreator = function(userId) {
  return this.find({ createdBy: userId, isActive: true });
};

const WorkflowTemplate = mongoose.models.WorkflowTemplate || mongoose.model('WorkflowTemplate', WorkflowTemplateSchema);

export default WorkflowTemplate;
