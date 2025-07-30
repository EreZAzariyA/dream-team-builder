
import mongoose from 'mongoose';

const UserActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'page_view',
      'login',
      'logout',
      'workflow_start',
      'workflow_complete',
      'agent_interaction',
      'artifact_download',
      'feature_use',
      'error',
      'system_event',
    ],
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  ipAddress: String,
  userAgent: String,
  details: mongoose.Schema.Types.Mixed, // Flexible field for additional event-specific data
});

const UserActivity = mongoose.models.UserActivity || mongoose.model('UserActivity', UserActivitySchema);

export default UserActivity;
