import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  
  // Authentication
  passwordHash: {
    type: String,
    required: function() {
      return !this.googleId && !this.githubId; // Password required if not using OAuth
    },
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  
  // OAuth Integration
  googleId: {
    type: String,
    sparse: true, // Allows null values while maintaining uniqueness
    unique: true,
  },
  
  githubId: {
    type: String,
    sparse: true, // Allows null values while maintaining uniqueness
    unique: true,
  },
  
  githubAccessToken: {
    type: String,
    default: null,
    // This will be encrypted in production
  },
  
  // Profile Information
  profile: {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    avatar: {
      type: String,
      default: null,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Avatar must be a valid URL'
      }
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
  },
  
  // Activity Tracking
  lastLoginAt: {
    type: Date,
    default: null,
  },
  
  loginCount: {
    type: Number,
    default: 0,
  },
  
  // User Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      workflow: {
        type: Boolean,
        default: true,
      },
      agents: {
        type: Boolean,
        default: true,
      },
    },
    ui: {
      sidebarCollapsed: {
        type: Boolean,
        default: false,
      },
      workflowViewMode: {
        type: String,
        enum: ['grid', 'list', 'timeline'],
        default: 'grid',
      },
    },
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  versionKey: false,
  suppressReservedKeysWarning: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash; // Never include password in JSON output
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better performance
// Note: email index is already created by unique: true in field definition
 
UserSchema.index({ createdAt: 1 });
UserSchema.index({ 'profile.role': 1 });
UserSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash password if it's been modified
  if (!this.isModified('passwordHash')) return next();
  
  try {
    // Hash password with salt rounds of 12
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamps
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance Methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

UserSchema.methods.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  this.loginCount += 1;
  return this.save();
};

UserSchema.methods.toPublicJSON = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.googleId;
  delete userObject.__v;
  return userObject;
};

// Static Methods
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ googleId });
};

UserSchema.statics.createUser = async function(userData) {
  const user = new this(userData);
  return user.save();
};

UserSchema.statics.getActiveUsers = function() {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

UserSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
        verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
        googleUsers: { $sum: { $cond: [{ $ne: ['$googleId', null] }, 1, 0] } },
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    verifiedUsers: 0,
    googleUsers: 0,
  };
};

// Virtual fields
UserSchema.virtual('isGoogleUser').get(function() {
  return !!this.googleId;
});

UserSchema.virtual('displayName').get(function() {
  return this.profile.name || this.email.split('@')[0];
});

// Export model
const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;