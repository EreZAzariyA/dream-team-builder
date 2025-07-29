import { connectMongoose } from '../database/mongodb.js';
import jwt from 'jsonwebtoken';
import { User } from '../database/models/index.js';

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

/**
 * Database connection middleware
 * Ensures MongoDB connection is established before handling requests
 */
export const withDatabase = (handler) => {
  return async (req, res) => {
    try {
      await connectMongoose();
      return handler(req, res);
    } catch (error) {
      console.error('Database connection error:', error);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        message: 'Unable to connect to database',
      });
    }
  };
};

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const withAuth = (handler) => {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication token required',
        });
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isActive) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
        
        // Attach user to request
        req.user = user;
        return handler(req, res);
        
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid token',
        });
      }
      
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Authentication failed',
      });
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if token is missing
 */
export const withOptionalAuth = (handler) => {
  return async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const user = await User.findById(decoded.userId);
          
          if (user && user.isActive) {
            req.user = user;
          }
        } catch (jwtError) {
          // Token is invalid, but we continue without user
          console.warn('Invalid token in optional auth:', jwtError.message);
        }
      }
      
      return handler(req, res);
      
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      return handler(req, res); // Continue without auth on error
    }
  };
};

/**
 * Admin authentication middleware
 * Requires user to have admin role
 */
export const withAdminAuth = (handler) => {
  return withAuth(async (req, res) => {
    if (req.user.profile.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }
    
    return handler(req, res);
  });
};

/**
 * HTTP method validation middleware
 * Ensures only specified methods are allowed
 */
export const withMethods = (allowedMethods) => (handler) => {
  return async (req, res) => {
    if (!allowedMethods.includes(req.method)) {
      res.setHeader('Allow', allowedMethods.join(', '));
      return res.status(405).json({
        success: false,
        error: 'Method not allowed',
        message: `Only ${allowedMethods.join(', ')} methods are allowed`,
      });
    }
    
    return handler(req, res);
  };
};

/**
 * Request validation middleware
 * Validates request body against schema
 */
export const withValidation = (schema) => (handler) => {
  return async (req, res) => {
    try {
      // Simple validation function (you can replace with Joi, Yup, etc.)
      const validateField = (value, rules) => {
        if (rules.required && (value === undefined || value === null || value === '')) {
          return `Field is required`;
        }
        
        if (value !== undefined && rules.type) {
          if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Invalid email format';
          }
          
          if (rules.type === 'string' && typeof value !== 'string') {
            return 'Field must be a string';
          }
          
          if (rules.type === 'number' && typeof value !== 'number') {
            return 'Field must be a number';
          }
        }
        
        if (value && rules.minLength && value.length < rules.minLength) {
          return `Field must be at least ${rules.minLength} characters`;
        }
        
        if (value && rules.maxLength && value.length > rules.maxLength) {
          return `Field must be at most ${rules.maxLength} characters`;
        }
        
        return null;
      };
      
      const errors = {};
      
      for (const [field, rules] of Object.entries(schema)) {
        const error = validateField(req.body[field], rules);
        if (error) {
          errors[field] = error;
        }
      }
      
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Request validation errors',
          errors,
        });
      }
      
      return handler(req, res);
      
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Validation failed',
      });
    }
  };
};

/**
 * Rate limiting middleware
 * Simple in-memory rate limiting (use Redis in production)
 */
const rateLimitStore = new Map();

export const withRateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => (handler) => {
  return async (req, res) => {
    try {
      const clientId = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old entries
      for (const [key, requests] of rateLimitStore.entries()) {
        rateLimitStore.set(key, requests.filter(time => time > windowStart));
        if (rateLimitStore.get(key).length === 0) {
          rateLimitStore.delete(key);
        }
      }
      
      // Check current requests
      const clientRequests = rateLimitStore.get(clientId) || [];
      
      if (clientRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }
      
      // Add current request
      clientRequests.push(now);
      rateLimitStore.set(clientId, clientRequests);
      
      return handler(req, res);
      
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      return handler(req, res); // Continue on rate limit error
    }
  };
};

/**
 * Error handling middleware
 * Catches and formats errors consistently
 */
export const withErrorHandling = (handler) => {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);
      
      // Handle specific error types
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
          details: error.errors,
        });
      }
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID',
          message: 'Invalid resource ID format',
        });
      }
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate Error',
          message: 'Resource already exists',
        });
      }
      
      // Generic server error
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      });
    }
  };
};

/**
 * CORS middleware
 * Handles cross-origin requests
 */
export const withCORS = (handler) => {
  return async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    return handler(req, res);
  };
};

/**
 * Logging middleware
 * Logs API requests and responses
 */
export const withLogging = (handler) => {
  return async (req, res) => {
    const startTime = Date.now();
    const { method, url, headers } = req;
    
    console.log(`📨 ${method} ${url} - ${headers['user-agent'] || 'Unknown'}`);
    
    // Capture original res.json to log responses
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;
      console.log(`📤 ${method} ${url} - ${res.statusCode} - ${duration}ms`);
      return originalJson.call(this, data);
    };
    
    return handler(req, res);
  };
};

/**
 * Compose multiple middleware functions
 * Usage: compose(withAuth, withValidation(schema), withErrorHandling)(handler)
 */
export const compose = (...middlewares) => (handler) => {
  return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
};

/**
 * Common API response helpers
 */
export const apiResponse = {
  success: (data, message = 'Success') => ({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  }),
  
  error: (message, error = null, statusCode = 400) => ({
    success: false,
    message,
    error,
    timestamp: new Date().toISOString(),
  }),
  
  paginated: (data, pagination) => ({
    success: true,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
    },
    timestamp: new Date().toISOString(),
  }),
};

/**
 * JWT token utilities
 */
export const tokenUtils = {
  generate: (payload, expiresIn = '24h') => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  },
  
  verify: (token) => {
    return jwt.verify(token, JWT_SECRET);
  },
  
  decode: (token) => {
    return jwt.decode(token);
  },
};

export default {
  withDatabase,
  withAuth,
  withOptionalAuth,
  withAdminAuth,
  withMethods,
  withValidation,
  withRateLimit,
  withErrorHandling,
  withCORS,
  withLogging,
  compose,
  apiResponse,
  tokenUtils,
};