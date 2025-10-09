import mongoose from 'mongoose';

const FileIndexSchema = new mongoose.Schema({
  path: { type: String, required: true },
  language: String,
  extension: String,
  size: { type: Number, default: 0 },
  lines: { type: Number, default: 0 },
  sha: String,
  lastModified: Date,
  complexity: Number, // Cyclomatic complexity if calculated
});

const LanguageStatsSchema = new mongoose.Schema({
  lines: { type: Number, default: 0 },
  files: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
});

const MetricsSchema = new mongoose.Schema({
  fileCount: { type: Number, default: 0 },
  totalLines: { type: Number, default: 0 },
  totalSize: { type: Number, default: 0 },
  languageCount: { type: Number, default: 0 },
  languages: {
    type: Map,
    of: LanguageStatsSchema,
    default: new Map()
  },
  largestFiles: [FileIndexSchema],
  complexity: {
    average: Number,
    max: Number,
    files: [{
      path: String,
      complexity: Number
    }]
  }
});

const RepoAnalysisSchema = new mongoose.Schema({
  // Repository info
  repositoryId: { type: Number, required: true }, // GitHub repo ID
  owner: { type: String, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  url: String,
  branch: { type: String, default: 'main' },
  
  // User info
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Analysis status
  status: {
    type: String,
    enum: ['pending', 'analyzing', 'completed', 'failed'],
    default: 'pending'
  },
  
  // Analysis results
  summary: String, // AI-generated summary
  metrics: MetricsSchema,
  fileIndex: [FileIndexSchema],
  
  // Analysis metadata
  analyzedAt: Date,
  duration: Number, // Analysis duration in milliseconds
  version: { type: String, default: '1.0' }, // Schema version
  
  // Error info (if failed)
  error: String,
  errorDetails: mongoose.Schema.Types.Mixed,
  
  // Settings
  maxFileSize: { type: Number, default: 1024 * 1024 }, // 1MB default
  maxFiles: { type: Number, default: 10000 },
  includeTests: { type: Boolean, default: true },
  includeDocs: { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
RepoAnalysisSchema.index({ repositoryId: 1, userId: 1 });
RepoAnalysisSchema.index({ userId: 1, createdAt: -1 });
RepoAnalysisSchema.index({ status: 1 });
RepoAnalysisSchema.index({ 'owner': 1, 'name': 1 });

// Virtual for repository full path
RepoAnalysisSchema.virtual('repoPath').get(function() {
  return `${this.owner}/${this.name}`;
});

// Virtual for analysis age
RepoAnalysisSchema.virtual('analysisAge').get(function() {
  if (!this.analyzedAt) return null;
  return Date.now() - this.analyzedAt.getTime();
});

// Instance methods
RepoAnalysisSchema.methods.markAsAnalyzing = function() {
  this.status = 'analyzing';
  this.analyzedAt = new Date();
  return this.save();
};

RepoAnalysisSchema.methods.markAsCompleted = function(results) {
  this.status = 'completed';
  this.analyzedAt = new Date();
  if (results.summary) this.summary = results.summary;
  if (results.metrics) this.metrics = results.metrics;
  if (results.fileIndex) this.fileIndex = results.fileIndex;
  if (results.duration) this.duration = results.duration;
  return this.save();
};

RepoAnalysisSchema.methods.markAsFailed = function(error, errorDetails = null) {
  this.status = 'failed';
  this.error = error;
  this.errorDetails = errorDetails;
  return this.save();
};

// Static methods
RepoAnalysisSchema.statics.findByRepository = function(repositoryId, userId = null) {
  const query = { repositoryId };
  if (userId) query.userId = userId;
  return this.findOne(query).sort({ createdAt: -1 });
};

RepoAnalysisSchema.statics.findUserAnalyses = function(userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

RepoAnalysisSchema.statics.getAnalysisStats = function(userId = null) {
  const match = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        totalFiles: { $sum: '$metrics.fileCount' },
        totalLines: { $sum: '$metrics.totalLines' }
      }
    }
  ]);
};

const RepoAnalysis = mongoose.models.RepoAnalysis || mongoose.model('RepoAnalysis', RepoAnalysisSchema);

export default RepoAnalysis;