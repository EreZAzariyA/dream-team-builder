
const mongoose = require('mongoose');

const WorkflowAnalyticsSchema = new mongoose.Schema({
  workflowId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  duration: {
    type: Number, // in milliseconds
    required: true,
  },
  agentCount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['completed', 'error', 'cancelled'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Force re-creation of the model to clear any cached schema
delete mongoose.models.WorkflowAnalytics;
const WorkflowAnalytics = mongoose.model('WorkflowAnalytics', WorkflowAnalyticsSchema);

module.exports = WorkflowAnalytics;
