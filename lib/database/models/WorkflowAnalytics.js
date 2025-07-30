
import mongoose from 'mongoose';

const WorkflowAnalyticsSchema = new mongoose.Schema({
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
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

const WorkflowAnalytics = mongoose.models.WorkflowAnalytics || mongoose.model('WorkflowAnalytics', WorkflowAnalyticsSchema);

export default WorkflowAnalytics;
