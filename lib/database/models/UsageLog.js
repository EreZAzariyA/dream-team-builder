import mongoose from 'mongoose';

const usageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    enum: ['gemini', 'openai', 'anthropic'],
    index: true
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    default: 'gemini-2.5-flash'
  },
  totalTokens: {
    type: Number,
    required: [true, 'Total tokens is required'],
    min: 0
  },
  promptTokens: {
    type: Number,
    default: 0,
    min: 0
  },
  candidatesTokens: {
    type: Number,
    default: 0,
    min: 0
  },
  estimatedCost: {
    type: Number,
    required: [true, 'Estimated cost is required'],
    min: 0
  },
  textLength: {
    type: Number,
    default: 0,
    min: 0
  },
  hasActualMetadata: {
    type: Boolean,
    default: false
  },
  rawUsageMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Additional tracking fields
  workflowId: {
    type: String,
    index: true,
    sparse: true // Allow null values but index non-null ones
  },
  agentId: {
    type: String,
    index: true,
    sparse: true
  },
  requestType: {
    type: String,
    enum: ['workflow', 'direct', 'elicitation', 'agent_execution'],
    default: 'direct'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'usage_logs'
});

// Compound indexes for efficient queries
usageLogSchema.index({ userId: 1, timestamp: -1 });
usageLogSchema.index({ provider: 1, timestamp: -1 });
usageLogSchema.index({ userId: 1, provider: 1, timestamp: -1 });

// Index for timeframe queries (last 24 hours, week, etc.)
usageLogSchema.index({ timestamp: -1 });

// Static method to get user usage stats
usageLogSchema.statics.getUserUsageStats = async function(userId, timeframe = null) {
  const matchStage = { userId: new mongoose.Types.ObjectId(userId) };
  
  // Add timeframe filter if specified
  if (timeframe) {
    const now = new Date();
    let cutoffTime;
    
    switch (timeframe) {
      case 'hour':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = null;
    }
    
    if (cutoffTime) {
      matchStage.timestamp = { $gte: cutoffTime };
    }
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$provider',
        requests: { $sum: 1 },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        avgTokensPerRequest: { $avg: '$totalTokens' }
      }
    }
  ];
  
  const providerStats = await this.aggregate(pipeline);
  
  // Get overall stats
  const overallStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        totalTokens: { $sum: '$totalTokens' },
        totalCost: { $sum: '$estimatedCost' },
        averageTokensPerRequest: { $avg: '$totalTokens' },
        averageCostPerRequest: { $avg: '$estimatedCost' }
      }
    }
  ]);
  
  // Format provider stats
  const providers = {};
  providerStats.forEach(stat => {
    providers[stat._id] = {
      requests: stat.requests,
      totalTokens: stat.totalTokens,
      totalCost: stat.totalCost,
      averageTokensPerRequest: Math.round(stat.avgTokensPerRequest || 0)
    };
  });
  
  const overall = overallStats[0] || {
    totalEntries: 0,
    totalTokens: 0,
    totalCost: 0,
    averageTokensPerRequest: 0,
    averageCostPerRequest: 0
  };
  
  return {
    totalEntries: overall.totalEntries,
    totalTokens: overall.totalTokens,
    totalCost: overall.totalCost,
    averageTokensPerRequest: Math.round(overall.averageTokensPerRequest || 0),
    averageCostPerRequest: parseFloat((overall.averageCostPerRequest || 0).toFixed(6)),
    providers,
    timeframe: timeframe || 'all'
  };
};

// Static method to log usage
usageLogSchema.statics.logUsage = async function(usageDetails) {
  try {
    const usageLog = new this(usageDetails);
    await usageLog.save();
    return usageLog;
  } catch (error) {
    console.error('Failed to save usage log:', error);
    throw error;
  }
};

// Clear cache if model exists
if (mongoose.models.UsageLog) {
  delete mongoose.models.UsageLog;
  delete mongoose.connection.models.UsageLog;
}

const UsageLog = mongoose.model('UsageLog', usageLogSchema);

export default UsageLog;