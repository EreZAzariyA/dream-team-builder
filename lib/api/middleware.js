import { connectMongoose } from '../database/mongodb.js';
import jwt from 'jsonwebtoken';
import { User } from '../database/models/index.js';

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Global API statistics store
const apiStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  endpoints: {},
};

// Helper to update endpoint specific stats
const updateEndpointStats = (url, duration, success) => {
  if (!apiStats.endpoints[url]) {
    apiStats.endpoints[url] = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
    };
  }

  const endpoint = apiStats.endpoints[url];
  endpoint.totalRequests++;
  endpoint.totalResponseTime += duration;
  endpoint.averageResponseTime = endpoint.totalResponseTime / endpoint.totalRequests;

  if (success) {
    endpoint.successfulRequests++;
  } else {
    endpoint.failedRequests++;
  }
};


/**
 * Database connection middleware
 * Ensures MongoDB connection is established before handling requests
 */
import { NextResponse } from 'next/server';

export const withDatabase = (handler) => {
  return async (req) => {
    try {
      await connectMongoose();
      return handler(req);
    } catch (error) {
      console.error('Database connection error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        message: 'Unable to connect to database',
      }, { status: 500 });
    }
  };
};

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const withAuth = (handler) => {
  return async (req) => {
    try {
      const authHeader = req.headers.get('authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication token required',
        }, { status: 401 });
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isActive) {
          return NextResponse.json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          }, { status: 401 });
        }
        
        // Attach user to request
        req.user = user;
        return handler(req);
        
      } catch (jwtError) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid token',
        }, { status: 401 });
      }
      
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return NextResponse.json({
        success: false,
        error: 'Internal server error',
        message: 'Authentication failed',
      }, { status: 500 });
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if token is missing
 */
export const withOptionalAuth = (handler) => {
  return async (req) => {
    try {
      const authHeader = req.headers.get('authorization');
      
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
      
      return handler(req);
      
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      return handler(req); // Continue without auth on error
    }
  };
};

/**
 * Admin authentication middleware
 * Requires user to have admin role
 */
export const withAdminAuth = (handler) => {
  return withAuth(async (req) => {
    if (req.user.profile.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required',
      }, { status: 403 });
    }
    
    return handler(req);
  });
};

/**
 * HTTP method validation middleware
 * Ensures only specified methods are allowed
 */
export const withMethods = (allowedMethods) => (handler) => {
  return async (req) => {
    if (!allowedMethods.includes(req.method)) {
      const headers = new Headers();
      headers.set('Allow', allowedMethods.join(', '));
      return new NextResponse(null, {
        status: 405,
        statusText: 'Method Not Allowed',
        headers,
      });
    }
    
    return handler(req);
  };
};

/**
 * Request validation middleware
 * Validates request body against schema
 */
export const withValidation = (schema) => (handler) => {
  return async (req) => {
    try {
      const body = await req.json();
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
        const error = validateField(body[field], rules);
        if (error) {
          errors[field] = error;
        }
      }
      
      if (Object.keys(errors).length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Validation failed',
          message: 'Request validation errors',
          errors,
        }, { status: 400 });
      }
      
      // Attach validated body to request object as a custom property
      req.validatedBody = body;
      return handler(req);
      
    } catch (error) {
      console.error('Validation middleware error:', error);
      return NextResponse.json({
        success: false,
        error: 'Internal server error',
        message: 'Validation failed',
      }, { status: 500 });
    }
  };
};

/**
 * Rate limiting middleware
 * Simple in-memory rate limiting (use Redis in production)
 */
const rateLimitStore = new Map();

export const withRateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => (handler) => {
  return async (req) => {
    try {
      const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
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
        return NextResponse.json({
          success: false,
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000),
        }, { status: 429 });
      }
      
      // Add current request
      clientRequests.push(now);
      rateLimitStore.set(clientId, clientRequests);
      
      return handler(req);
      
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      return handler(req); // Continue on rate limit error
    }
  };
};

/**
 * Error handling middleware
 * Catches and formats errors consistently
 */
export const withErrorHandling = (handler) => {
  return async (req) => {
    try {
      return await handler(req);
    } catch (error) {
      console.error('API Error:', error);
      
      // Ensure failed requests are logged in stats
      const url = req.nextUrl.pathname;
      const duration = Date.now() - req.startTime; // Assuming startTime is set by withLogging
      updateEndpointStats(url, duration, false);
      apiStats.failedRequests++;
      apiStats.totalRequests++;
      apiStats.averageResponseTime = (apiStats.averageResponseTime * (apiStats.totalRequests - 1) + duration) / apiStats.totalRequests;

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return NextResponse.json({
          success: false,
          error: 'Validation Error',
          message: error.message,
          details: error.errors,
        }, { status: 400 });
      }
      
      if (error.name === 'CastError') {
        return NextResponse.json({
          success: false,
          error: 'Invalid ID',
          message: 'Invalid resource ID format',
        }, { status: 400 });
      }
      
      if (error.code === 11000) {
        return NextResponse.json({
          success: false,
          error: 'Duplicate Error',
          message: 'Resource already exists',
        }, { status: 409 });
      }
      
      // Generic server error
      return NextResponse.json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      }, { status: 500 });
    }
  };
};

/**
 * CORS middleware
 * Handles cross-origin requests
 */
export const withCORS = (handler) => {
  return async (req) => {
    const response = await handler(req);
    response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
    
    return response;
  };
};

/**
 * Logging middleware
 * Logs API requests and responses
 */
export const withLogging = (handler) => {
  return async (req) => {
    const startTime = Date.now();
    req.startTime = startTime; // Set startTime on the request object
    const { method } = req;
    const url = req.nextUrl.pathname;
    
    console.log(`📨 ${method} ${url} - ${req.headers.get('user-agent') || 'Unknown'}`);
    
    const response = await handler(req);

    const duration = Date.now() - startTime;
    const success = response.status >= 200 && response.status < 300;
    
    apiStats.totalRequests++;
    if (success) {
      apiStats.successfulRequests++;
    } else {
      apiStats.failedRequests++;
    }
    apiStats.averageResponseTime = (apiStats.averageResponseTime * (apiStats.totalRequests - 1) + duration) / apiStats.totalRequests;
    updateEndpointStats(url, duration, success);

    console.log(`📤 ${method} ${url} - ${response.status} - ${duration}ms`);
    
    return response;
  };
};

/**
 * Compose multiple middleware functions
 * Usage: compose(withAuth, withValidation(schema), withErrorHandling)(handler)
 */
export const compose = (...middlewares) => (handler) => {
  return middlewares.reduceRight((acc, middleware) => {
    return async (req) => {
      const result = await middleware(acc)(req);
      if (result instanceof NextResponse) {
        return result;
      }
      return result;
    };
  }, handler);
};

/**
 * Common API response helpers
 */
export const apiResponse = {
  success: (data, message = 'Success', status = 200) => NextResponse.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  }, { status }),
  
  error: (message, error = null, status = 400) => NextResponse.json({
    success: false,
    message,
    error,
    timestamp: new Date().toISOString(),
  }, { status }),
  
  paginated: (data, pagination, status = 200) => NextResponse.json({
    success: true,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
    },
    timestamp: new Date().toISOString(),
  }, { status }),
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

export const getApiStats = () => apiStats;

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