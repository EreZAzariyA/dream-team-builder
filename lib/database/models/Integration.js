import mongoose from 'mongoose';

const IntegrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  pluginId: {
    type: String,
    required: true,
    enum: ['github', 'slack', 'jira'],
  },
  name: {
    type: String,
    required: true,
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUsed: {
    type: Date,
    default: null,
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
  suppressReservedKeysWarning: true
});

// Index for efficient queries
IntegrationSchema.index({ userId: 1, pluginId: 1 });

// Update the updatedAt field before saving
IntegrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Integration = mongoose.models.Integration || mongoose.model('Integration', IntegrationSchema);

export default Integration;