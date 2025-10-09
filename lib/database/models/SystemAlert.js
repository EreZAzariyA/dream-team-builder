import mongoose from 'mongoose';

const SystemAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'error', 'critical'],
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['system', 'database', 'api', 'errors', 'performance'],
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  severity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  count: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
SystemAlertSchema.index({ type: 1, category: 1 });
SystemAlertSchema.index({ createdAt: -1 });
SystemAlertSchema.index({ isResolved: 1, createdAt: -1 });

// Virtual for age
SystemAlertSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Static methods
SystemAlertSchema.statics.createAlert = async function(type, category, message, details = {}) {
  // Check for similar recent alerts to avoid spam
  const recentSimilar = await this.findOne({
    type,
    category,
    message,
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
    isResolved: false
  });

  if (recentSimilar) {
    // Increment count instead of creating new alert
    recentSimilar.count += 1;
    recentSimilar.details = { ...recentSimilar.details, ...details };
    await recentSimilar.save();
    return recentSimilar;
  }

  // Create new alert
  const alert = new this({
    type,
    category,
    message,
    details,
    severity: this.getSeverityFromType(type)
  });

  return await alert.save();
};

SystemAlertSchema.statics.getSeverityFromType = function(type) {
  const severityMap = {
    'info': 3,
    'warning': 6,
    'error': 8,
    'critical': 10
  };
  return severityMap[type] || 5;
};

SystemAlertSchema.statics.getActiveAlerts = function() {
  return this.find({ isResolved: false })
    .sort({ severity: -1, createdAt: -1 })
    .limit(100);
};

SystemAlertSchema.statics.getAlertsByCategory = function(category, limit = 50) {
  return this.find({ category })
    .sort({ createdAt: -1 })
    .limit(limit);
};

SystemAlertSchema.statics.getCriticalAlerts = function() {
  return this.find({ 
    type: 'critical',
    isResolved: false 
  })
  .sort({ createdAt: -1 });
};

// Instance methods
SystemAlertSchema.methods.resolve = async function(userId = null) {
  this.isResolved = true;
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  return await this.save();
};

SystemAlertSchema.methods.escalate = async function() {
  if (this.type !== 'critical') {
    this.type = 'critical';
    this.severity = 10;
    return await this.save();
  }
  return this;
};

const SystemAlert = mongoose.models.SystemAlert || mongoose.model('SystemAlert', SystemAlertSchema);

export default SystemAlert;