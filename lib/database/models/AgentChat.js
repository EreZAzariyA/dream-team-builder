import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  from: {
    type: String,
    required: true,
    enum: ['user', 'pm', 'architect', 'dev', 'ux-expert', 'qa', 'analyst', 'po', 'sm', 'bmad-orchestrator', 'bmad-master']
  },
  fromName: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  toName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: [5000, 'Message content cannot exceed 5000 characters']
  },
  type: {
    type: String,
    enum: ['greeting', 'user_message', 'agent_response', 'system_message', 'error_response'],
    default: 'user_message'
  },
  metadata: {
    executionTime: {
      type: Number,
      default: 0
    },
    tokensUsed: {
      type: Number,
      default: 0
    },
    model: {
      type: String,
      default: 'unknown'
    },
    cost: {
      type: Number,
      default: 0
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  _id: false // Disable _id for subdocuments since we have our own id field
});

const AgentChatSchema = new mongoose.Schema({
  // Chat Session Identifiers
  chatId: {
    type: String,
    required: [true, 'Chat ID is required'],
    unique: true,
    index: true
  },
  
  // User Association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  
  userName: {
    type: String,
    required: [true, 'User name is required'],
    maxlength: [100, 'User name cannot exceed 100 characters']
  },
  
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    maxlength: [255, 'User email cannot exceed 255 characters']
  },

  // Agent Information
  agentId: {
    type: String,
    required: [true, 'Agent ID is required'],
    enum: ['pm', 'architect', 'dev', 'ux-expert', 'qa', 'analyst', 'po', 'sm', 'bmad-orchestrator', 'bmad-master'],
    index: true
  },
  
  agentName: {
    type: String,
    required: [true, 'Agent name is required'],
    maxlength: [100, 'Agent name cannot exceed 100 characters']
  },
  
  agentTitle: {
    type: String,
    required: [true, 'Agent title is required'],
    maxlength: [100, 'Agent title cannot exceed 100 characters']
  },
  
  agentIcon: {
    type: String,
    default: '🤖',
    maxlength: [10, 'Agent icon cannot exceed 10 characters']
  },

  // Chat Session Data
  status: {
    type: String,
    enum: ['active', 'ended', 'archived'],
    default: 'active',
    index: true
  },
  
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  endTime: {
    type: Date,
    index: true
  },
  
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Chat Configuration
  mockMode: {
    type: Boolean,
    default: false
  },
  
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    autoArchiveAfterDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    }
  },

  // Messages Array
  messages: [ChatMessageSchema],

  // Chat Analytics
  analytics: {
    totalMessages: {
      type: Number,
      default: 0
    },
    userMessages: {
      type: Number,
      default: 0
    },
    agentMessages: {
      type: Number,
      default: 0
    },
    totalTokensUsed: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    chatDuration: {
      type: Number, // in milliseconds
      default: 0
    }
  },

  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      default: 'web_chat',
      enum: ['web_chat', 'api', 'mobile', 'integration']
    },
    version: {
      type: String,
      default: '1.0.0'
    }
  }
}, {
  timestamps: true,
  collection: 'agent_chats'
});

// Indexes for performance
AgentChatSchema.index({ userId: 1, startTime: -1 });
AgentChatSchema.index({ agentId: 1, startTime: -1 });
AgentChatSchema.index({ status: 1, lastActivity: -1 });
AgentChatSchema.index({ 'messages.timestamp': -1 });

// Virtual for chat duration calculation
AgentChatSchema.virtual('duration').get(function() {
  if (this.endTime) {
    return this.endTime.getTime() - this.startTime.getTime();
  }
  return Date.now() - this.startTime.getTime();
});

// Methods
AgentChatSchema.methods.addMessage = function(messageData) {
  // Add message to array
  this.messages.push(messageData);
  
  // Update analytics
  this.analytics.totalMessages += 1;
  if (messageData.from === 'user') {
    this.analytics.userMessages += 1;
  } else {
    this.analytics.agentMessages += 1;
  }
  
  if (messageData.metadata?.tokensUsed) {
    this.analytics.totalTokensUsed += messageData.metadata.tokensUsed;
  }
  
  if (messageData.metadata?.cost) {
    this.analytics.totalCost += messageData.metadata.cost;
  }
  
  // Update last activity
  this.lastActivity = new Date();
  
  return this.save();
};

AgentChatSchema.methods.endChat = function() {
  this.status = 'ended';
  this.endTime = new Date();
  this.analytics.chatDuration = this.duration;
  
  // Calculate average response time
  const agentMessages = this.messages.filter(msg => msg.from !== 'user' && msg.metadata?.executionTime > 0);
  if (agentMessages.length > 0) {
    const totalResponseTime = agentMessages.reduce((sum, msg) => sum + msg.metadata.executionTime, 0);
    this.analytics.averageResponseTime = totalResponseTime / agentMessages.length;
  }
  
  return this.save();
};

AgentChatSchema.methods.getRecentMessages = function(limit = 10) {
  return this.messages
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
    .reverse(); // Return in chronological order
};

// Static methods
AgentChatSchema.statics.findActiveByUser = function(userId, limit = 10) {
  return this.find({ 
    userId, 
    status: 'active' 
  })
  .sort({ lastActivity: -1 })
  .limit(limit);
};

AgentChatSchema.statics.findByAgent = function(agentId, limit = 50) {
  return this.find({ agentId })
    .sort({ startTime: -1 })
    .limit(limit);
};

AgentChatSchema.statics.getAnalytics = function(userId, agentId = null, days = 30) {
  const query = { 
    userId,
    startTime: { 
      $gte: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)) 
    }
  };
  
  if (agentId) {
    query.agentId = agentId;
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$agentId',
        totalChats: { $sum: 1 },
        totalMessages: { $sum: '$analytics.totalMessages' },
        totalTokensUsed: { $sum: '$analytics.totalTokensUsed' },
        totalCost: { $sum: '$analytics.totalCost' },
        averageResponseTime: { $avg: '$analytics.averageResponseTime' },
        averageChatDuration: { $avg: '$analytics.chatDuration' }
      }
    },
    { $sort: { totalChats: -1 } }
  ]);
};

// Auto-archive old chats
AgentChatSchema.statics.autoArchiveOldChats = function() {
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  
  return this.updateMany(
    {
      status: 'active',
      lastActivity: { $lt: thirtyDaysAgo }
    },
    {
      $set: { status: 'archived' }
    }
  );
};

// Pre-save middleware to update analytics
AgentChatSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    // Recalculate analytics when messages are modified
    this.analytics.totalMessages = this.messages.length;
    this.analytics.userMessages = this.messages.filter(msg => msg.from === 'user').length;
    this.analytics.agentMessages = this.messages.filter(msg => msg.from !== 'user').length;
    
    this.analytics.totalTokensUsed = this.messages.reduce((sum, msg) => {
      return sum + (msg.metadata?.tokensUsed || 0);
    }, 0);
    
    this.analytics.totalCost = this.messages.reduce((sum, msg) => {
      return sum + (msg.metadata?.cost || 0);
    }, 0);
  }
  
  next();
});

const AgentChat = mongoose.models.AgentChat || mongoose.model('AgentChat', AgentChatSchema);

export default AgentChat;