import mongoose from 'mongoose';

const SystemAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'critical'],
    index: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['database', 'system', 'api', 'errors', 'security'],
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  isResolved: {
    type: Boolean,
    default: false,
    index: true,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
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
  suppressReservedKeysWarning: true
});

// Compound indexes for efficient queries
SystemAlertSchema.index({ type: 1, createdAt: -1 });
SystemAlertSchema.index({ category: 1, isResolved: 1 });
SystemAlertSchema.index({ isResolved: 1, createdAt: -1 });

// Update the updatedAt field before saving
SystemAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
SystemAlertSchema.statics.createAlert = async function(type, category, message, details = null) {
  const alert = new this({
    type,
    category,
    message,
    details
  });
  await alert.save();
  return alert;
};

SystemAlertSchema.statics.getActiveAlerts = async function() {
  return this.find({ isResolved: false }).sort({ createdAt: -1 });
};

SystemAlertSchema.statics.getAlertsByCategory = async function(category, limit = 50) {
  return this.find({ category }).sort({ createdAt: -1 }).limit(limit);
};

SystemAlertSchema.statics.getCriticalAlerts = async function() {
  return this.find({ type: 'critical', isResolved: false }).sort({ createdAt: -1 });
};

// Instance methods
SystemAlertSchema.methods.resolve = async function(userId = null) {
  this.isResolved = true;
  this.resolvedAt = new Date();
  if (userId) {
    this.resolvedBy = userId;
  }
  await this.save();
  return this;
};

const SystemAlert = mongoose.models.SystemAlert || mongoose.model('SystemAlert', SystemAlertSchema);

export default SystemAlert;