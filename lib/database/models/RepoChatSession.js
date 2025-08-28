import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'assistant'], 
    required: true 
  },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  
  // Citations for assistant messages
  citations: [{
    filePath: String,
    lineStart: Number,
    lineEnd: Number,
    code: String,
    relevance: Number // 0-1 score
  }],
  
  // Token usage tracking
  tokenUsage: {
    prompt: Number,
    completion: Number,
    total: Number
  },
  
  // Message metadata
  model: String,
  temperature: Number,
  processingTime: Number, // milliseconds
});

const RepoChatSessionSchema = new mongoose.Schema({
  // Session identification
  sessionId: { type: String, required: true, unique: true },
  
  // Repository and user info
  repositoryId: { type: Number, required: true },
  analysisId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'RepoAnalysis',
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Chat data
  messages: [ChatMessageSchema],
  title: String, // Auto-generated or user-set
  
  // Session settings
  model: { type: String, default: 'gpt-3.5-turbo' },
  temperature: { type: Number, default: 0.7 },
  maxTokens: { type: Number, default: 4000 },
  
  // Usage tracking
  totalTokens: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  
  // Session status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  
  lastActivityAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes (sessionId already has unique index from schema definition)
RepoChatSessionSchema.index({ userId: 1, createdAt: -1 });
RepoChatSessionSchema.index({ repositoryId: 1, userId: 1 });
RepoChatSessionSchema.index({ analysisId: 1 });
RepoChatSessionSchema.index({ status: 1 });
RepoChatSessionSchema.index({ lastActivityAt: -1 });

// Virtuals
RepoChatSessionSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

RepoChatSessionSchema.virtual('lastMessage').get(function() {
  if (this.messages.length === 0) return null;
  return this.messages[this.messages.length - 1];
});

// Instance methods
RepoChatSessionSchema.methods.addMessage = function(role, content, metadata = {}) {
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: new Date(),
    ...metadata
  };
  
  this.messages.push(message);
  this.totalMessages = this.messages.length;
  this.lastActivityAt = new Date();
  
  // Update total tokens if provided
  if (metadata.tokenUsage) {
    this.totalTokens += metadata.tokenUsage.total || 0;
  }
  
  // Auto-generate title from first user message
  if (role === 'user' && this.messages.length === 1 && !this.title) {
    this.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
  }
  
  return message;
};

RepoChatSessionSchema.methods.getContext = function(maxMessages = 20) {
  // Get recent messages for context
  const recentMessages = this.messages.slice(-maxMessages);
  
  return {
    repositoryId: this.repositoryId,
    analysisId: this.analysisId,
    messages: recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      citations: msg.citations
    }))
  };
};

RepoChatSessionSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

RepoChatSessionSchema.methods.activate = function() {
  this.status = 'active';
  this.lastActivityAt = new Date();
  return this.save();
};

// Static methods
RepoChatSessionSchema.statics.createSession = function(userId, repositoryId, analysisId, options = {}) {
  const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return this.create({
    sessionId,
    userId,
    repositoryId,
    analysisId,
    model: options.model || 'gpt-3.5-turbo',
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 4000,
    ...options
  });
};

RepoChatSessionSchema.statics.findUserSessions = function(userId, limit = 20) {
  return this.find({ 
    userId, 
    status: { $ne: 'deleted' } 
  })
  .populate('analysisId', 'owner name fullName')
  .sort({ lastActivityAt: -1 })
  .limit(limit);
};

RepoChatSessionSchema.statics.findByRepository = function(userId, repositoryId, limit = 5) {
  return this.find({ 
    userId, 
    repositoryId,
    status: 'active'
  })
  .sort({ lastActivityAt: -1 })
  .limit(limit);
};

RepoChatSessionSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), status: 'active' } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalMessages: { $sum: '$totalMessages' },
        totalTokens: { $sum: '$totalTokens' },
        avgMessagesPerSession: { $avg: '$totalMessages' },
        lastActivity: { $max: '$lastActivityAt' }
      }
    }
  ]);
};

const RepoChatSession = mongoose.models.RepoChatSession || mongoose.model('RepoChatSession', RepoChatSessionSchema);

export default RepoChatSession;