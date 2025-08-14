import mongoose from 'mongoose';

const AgentMessageSchema = new mongoose.Schema({
  // Core Identifiers
  workflowId: {
    type: String, // BMAD workflow IDs are strings like "workflow_1755003075587_cyjwsup"
    required: false, // Made optional for chat messages
    index: true,
  },
  
  executionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentExecution',
    index: true,
  },
  
  messageId: {
    type: String,
    required: [true, 'Message ID is required'],
    unique: true,
    index: true,
  },
  
  // Agent Information
  fromAgent: {
    type: String,
    required: [true, 'From agent is required'],
    index: true,
  },
  
  toAgent: {
    type: String,
    index: true,
  },
  
  // Message Content
  messageType: {
    type: String,
    enum: [
      'handoff',
      'request',
      'response', 
      'notification',
      'error',
      'status_update',
      'heartbeat',
      'system',
      'debug'
    ],
    required: [true, 'Message type is required'],
    index: true,
  },
  
  content: {
    text: String,
    data: mongoose.Schema.Types.Mixed,
    attachments: [{
      name: String,
      type: String,
      size: Number,
      url: String,
      metadata: mongoose.Schema.Types.Mixed,
    }],
  },
  
  // Message Priority and Classification
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true,
  },
  
  category: {
    type: String,
    enum: [
      'workflow',
      'data_transfer',
      'error_handling',
      'coordination',
      'reporting',
      'debugging',
      'monitoring'
    ],
    default: 'workflow',
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: 50,
  }],
  
  // Timing Information
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true,
  },
  
  scheduledFor: {
    type: Date,
    // Remove index: true to avoid duplicate with schema.index() below
  },
  
  deliveredAt: Date,
  
  acknowledgedAt: Date,
  
  processedAt: Date,
  
  // Message Status
  status: {
    type: String,
    enum: [
      'pending',
      'sent',
      'delivered',
      'acknowledged',
      'processed',
      'failed',
      'expired'
    ],
    default: 'pending',
  },
  
  // Delivery Information
  delivery: {
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttempt: Date,
    nextRetry: Date,
    errors: [{
      attempt: Number,
      timestamp: Date,
      error: String,
      code: String,
    }],
  },
  
  // Message Metadata
  metadata: {
    correlationId: String, // For tracking related messages
    conversationId: String, // For grouping messages in a conversation
    parentMessageId: String, // For threaded conversations
    requestId: String, // For request-response patterns
    sessionId: String, // For session-based interactions
    
    // Performance tracking
    processingTime: Number, // milliseconds
    queueTime: Number, // time spent in queue
    networkLatency: Number, // network transmission time
    
    // Message characteristics
    size: Number, // message size in bytes
    encoding: {
      type: String,
      default: 'utf8',
    },
    compressed: {
      type: Boolean,
      default: false,
    },
    encrypted: {
      type: Boolean,
      default: false,
    },
    
    // Context information
    context: mongoose.Schema.Types.Mixed,
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
    },
    
    // Tracing and debugging
    traceId: String,
    spanId: String,
    debugInfo: mongoose.Schema.Types.Mixed,
  },
  
  // Response Information (for request messages)
  response: {
    expected: {
      type: Boolean,
      default: false,
    },
    timeout: {
      type: Number,
      default: 30000, // 30 seconds
    },
    received: {
      type: Boolean,
      default: false,
    },
    responseMessageId: String,
    responseData: mongoose.Schema.Types.Mixed,
    respondedAt: Date,
  },
  
  // Acknowledgment Information
  acknowledgment: {
    required: {
      type: Boolean,
      default: false,
    },
    received: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: String,
    acknowledgmentData: mongoose.Schema.Types.Mixed,
  },
  
  // Error Handling
  errors: [{
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  }],
  
  // Message Versioning
  version: {
    type: String,
    default: '1.0',
  },
  
  format: {
    type: String,
    enum: ['json', 'xml', 'text', 'binary', 'protobuf'],
    default: 'json',
  },
  
  // Archive and Cleanup
  archived: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  archivedAt: Date,
  
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }, // TTL index
  },
  
  // Audit Trail
  auditLog: [{
    action: {
      type: String,
      enum: ['created', 'sent', 'delivered', 'acknowledged', 'processed', 'failed', 'archived'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: mongoose.Schema.Types.Mixed,
  }],
  
  // Timestamps
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true,
});

// Indexes for better performance
AgentMessageSchema.index({ workflowId: 1, timestamp: 1 });
AgentMessageSchema.index({ fromAgent: 1, toAgent: 1 });
AgentMessageSchema.index({ messageType: 1, status: 1 });
AgentMessageSchema.index({ priority: 1, timestamp: 1 });
AgentMessageSchema.index({ 'metadata.correlationId': 1 });
AgentMessageSchema.index({ 'metadata.conversationId': 1 });
AgentMessageSchema.index({ scheduledFor: 1 }, { sparse: true });
AgentMessageSchema.index({ archived: 1, createdAt: 1 });

// Pre-save middleware
AgentMessageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set message size if content exists
  if (this.content && !this.metadata.size) {
    this.metadata.size = JSON.stringify(this.content).length;
  }
  
  // Generate correlation ID if not provided
  if (!this.metadata.correlationId) {
    this.metadata.correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  next();
});

// Virtual fields
AgentMessageSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

AgentMessageSchema.virtual('isPending').get(function() {
  return this.status === 'pending';
});

AgentMessageSchema.virtual('isDelivered').get(function() {
  return ['delivered', 'acknowledged', 'processed'].includes(this.status);
});

AgentMessageSchema.virtual('hasErrors').get(function() {
  return this.errors && this.errors.some(error => !error.resolved);
});

AgentMessageSchema.virtual('deliveryDuration').get(function() {
  if (!this.deliveredAt || !this.timestamp) return null;
  return this.deliveredAt - this.timestamp;
});

AgentMessageSchema.virtual('processingDuration').get(function() {
  if (!this.processedAt || !this.deliveredAt) return null;
  return this.processedAt - this.deliveredAt;
});

AgentMessageSchema.virtual('totalDuration').get(function() {
  if (!this.processedAt || !this.timestamp) return null;
  return this.processedAt - this.timestamp;
});

// Instance Methods
AgentMessageSchema.methods.send = function() {
  this.status = 'sent';
  this.delivery.attempts += 1;
  this.delivery.lastAttempt = new Date();
  
  this.auditLog.push({
    action: 'sent',
    details: { attempt: this.delivery.attempts },
  });
  
  return this.save();
};

AgentMessageSchema.methods.deliver = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  
  this.auditLog.push({
    action: 'delivered',
  });
  
  return this.save();
};

AgentMessageSchema.methods.acknowledge = function(acknowledgedBy, data = {}) {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  this.acknowledgment.received = true;
  this.acknowledgment.acknowledgedBy = acknowledgedBy;
  this.acknowledgment.acknowledgmentData = data;
  
  this.auditLog.push({
    action: 'acknowledged',
    details: { acknowledgedBy, data },
  });
  
  return this.save();
};

AgentMessageSchema.methods.process = function(result = {}) {
  this.status = 'processed';
  this.processedAt = new Date();
  
  if (this.metadata.processingTime === undefined) {
    this.metadata.processingTime = this.processingDuration;
  }
  
  this.auditLog.push({
    action: 'processed',
    details: { result },
  });
  
  return this.save();
};

AgentMessageSchema.methods.fail = function(error, code = null) {
  this.status = 'failed';
  
  this.errors.push({
    code,
    message: error.message || error,
    details: error.details || {},
    timestamp: new Date(),
    severity: 'high',
  });
  
  this.delivery.errors.push({
    attempt: this.delivery.attempts,
    timestamp: new Date(),
    error: error.message || error,
    code,
  });
  
  this.auditLog.push({
    action: 'failed',
    details: { error: error.message || error, code },
  });
  
  return this.save();
};

AgentMessageSchema.methods.retry = function() {
  if (this.delivery.attempts >= this.delivery.maxAttempts) {
    throw new Error('Maximum delivery attempts reached');
  }
  
  this.status = 'pending';
  this.delivery.nextRetry = new Date(Date.now() + (this.delivery.attempts * 5000)); // Exponential backoff
  
  return this.save();
};

AgentMessageSchema.methods.archive = function() {
  this.archived = true;
  this.archivedAt = new Date();
  
  this.auditLog.push({
    action: 'archived',
  });
  
  return this.save();
};

AgentMessageSchema.methods.addResponse = function(responseMessageId, responseData = {}) {
  this.response.received = true;
  this.response.responseMessageId = responseMessageId;
  this.response.responseData = responseData;
  this.response.respondedAt = new Date();
  
  return this.save();
};

// Static Methods
AgentMessageSchema.statics.findByWorkflow = function(workflowId, options = {}) {
  const query = { workflowId };
  
  if (options.messageType) {
    query.messageType = options.messageType;
  }
  
  if (options.fromAgent) {
    query.fromAgent = options.fromAgent;
  }
  
  if (options.toAgent) {
    query.toAgent = options.toAgent;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.priority) {
    query.priority = options.priority;
  }
  
  if (options.archived !== undefined) {
    query.archived = options.archived;
  }
  
  return this.find(query).sort({ timestamp: options.sortOrder || -1 });
};

AgentMessageSchema.statics.findByConversation = function(conversationId) {
  return this.find({ 'metadata.conversationId': conversationId })
    .sort({ timestamp: 1 });
};

AgentMessageSchema.statics.findPendingMessages = function(agentId = null) {
  const query = { status: 'pending' };
  
  if (agentId) {
    query.$or = [
      { fromAgent: agentId },
      { toAgent: agentId }
    ];
  }
  
  return this.find(query).sort({ priority: 1, timestamp: 1 });
};

AgentMessageSchema.statics.getMessageStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.workflowId) {
    matchStage.workflowId = mongoose.Types.ObjectId(filters.workflowId);
  }
  
  if (filters.agentId) {
    matchStage.$or = [
      { fromAgent: filters.agentId },
      { toAgent: filters.agentId }
    ];
  }
  
  if (filters.dateRange) {
    matchStage.timestamp = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end,
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDeliveryTime: { $avg: '$metadata.processingTime' },
        avgSize: { $avg: '$metadata.size' },
      }
    }
  ]);
  
  const summary = {
    total: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    processed: 0,
    failed: 0,
    avgDeliveryTime: 0,
    avgSize: 0,
  };
  
  stats.forEach(stat => {
    summary.total += stat.count;
    summary[stat._id] = stat.count;
    
    if (stat.avgDeliveryTime) {
      summary.avgDeliveryTime = Math.max(summary.avgDeliveryTime, stat.avgDeliveryTime);
    }
    
    if (stat.avgSize) {
      summary.avgSize = Math.max(summary.avgSize, stat.avgSize);
    }
  });
  
  return summary;
};

AgentMessageSchema.statics.cleanupExpiredMessages = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  
  logger.info(`🧹 Cleaned up ${result.deletedCount} expired messages`);
  return result;
};

// Export model
const AgentMessage = mongoose.models.AgentMessage || mongoose.model('AgentMessage', AgentMessageSchema);
export default AgentMessage;