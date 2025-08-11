import { connectMongoose } from '../database/mongodb.js';
import jwt from 'jsonwebtoken';
import { User } from '../database/models/index.js';
// Rate limiting imports removed - using custom implementation for Next.js

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET;

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

// Rate limiting configurations
const rateLimitConfigs = {
  // Standard API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Authentication endpoints (more restrictive)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 login attempts per 15 minutes in production
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // AI operations (very restrictive)
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 10 : 100, // 10 AI requests per minute in production
    message: 'AI request limit exceeded. Please wait before making more requests.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Expensive operations (workflow creation, file uploads)
  expensive: {
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 3 : 30, // 3 expensive operations per minute in production
    message: 'Rate limit exceeded for expensive operations. Please wait.',
    standardHeaders: true,
    legacyHeaders: false,
  }
};

// Slow down configurations (progressive delays)
const slowDownConfigs = {
  ai: {
    windowMs: 60 * 1000, // 1 minute
    delayAfter: process.env.NODE_ENV === 'production' ? 5 : 50, // allow 5 requests per minute at full speed, then...
    delayMs: 500, // add 500ms delay per request after delayAfter
    maxDelayMs: 5000, // max delay of 5 seconds
  }
};

// In-memory stores for rate limiting (use Redis in production)
const rateLimitStore = new Map();
const slowDownStore = new Map();

// Custom store implementation for Next.js API routes


/**
 * Database connection middleware
 * Ensures MongoDB connection is established before handling requests
 */
import { NextResponse } from 'next/server';
import logger from '../utils/logger.js';

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
          code: 'UNAUTHORIZED',
          message: 'Authentication token required',
          timestamp: new Date().toISOString()
        }, { status: 401 });
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isActive) {
          return NextResponse.json({
            success: false,
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
            timestamp: new Date().toISOString()
          }, { status: 401 });
        }
        
        // Attach user to request
        req.user = user;
        return handler(req);
        
      } catch (e) {
        return NextResponse.json({
          success: false,
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
          timestamp: new Date().toISOString()
        }, { status: 401 });
      }
      
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      return NextResponse.json({
        success: false,
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
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
        } catch (e) {
          // Token is invalid, but we continue without user
          logger.warn('Invalid token in optional auth:', e.message);
        }
      }
      
      return handler(req);
      
    } catch (error) {
      logger.error('Optional auth middleware error:', error);
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
        code: 'FORBIDDEN',
        message: 'Admin access required',
        timestamp: new Date().toISOString()
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
          code: 'VALIDATION_ERROR',
          message: 'Request validation errors',
          details: errors,
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      
      // Attach validated body to request object as a custom property
      req.validatedBody = body;
      return handler(req);
      
    } catch (error) {
      logger.error('Validation middleware error:', error);
      return NextResponse.json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Validation failed',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      }, { status: 500 });
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
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors,
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      
      if (error.name === 'CastError') {
        return NextResponse.json({
          success: false,
          code: 'INVALID_ID',
          message: 'Invalid resource ID format',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      
      if (error.code === 11000) {
        return NextResponse.json({
          success: false,
          code: 'DUPLICATE_ENTRY',
          message: 'Resource already exists',
          timestamp: new Date().toISOString()
        }, { status: 409 });
      }
      
      // Generic server error
      return NextResponse.json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        timestamp: new Date().toISOString()
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
    
    logger.info(`📨 ${method} ${url} - ${req.headers.get('user-agent') || 'Unknown'}`);
    
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

    logger.info(`📤 ${method} ${url} - ${response.status} - ${duration}ms`);
    
    return response;
  };
};

/**
 * Rate limiting middleware
 * Limits requests based on IP address and endpoint type
 */
export const withRateLimit = (type = 'general') => (handler) => {
  return async (req) => {
    const config = rateLimitConfigs[type] || rateLimitConfigs.general;
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const key = `ratelimit:${type}:${clientIp}`;
    const now = Date.now();
    
    // Clean up old entries
    const cutoff = now - config.windowMs;
    for (const [k, v] of rateLimitStore.entries()) {
      if (k.startsWith(`ratelimit:${type}:`) && v.timestamp < cutoff) {
        rateLimitStore.delete(k);
      }
    }
    
    // Get current count for this IP
    const current = rateLimitStore.get(key) || { count: 0, timestamp: now };
    
    // Reset if window has passed
    if (now - current.timestamp > config.windowMs) {
      current.count = 0;
      current.timestamp = now;
    }
    
    // Check if limit exceeded
    if (current.count >= config.max) {
      const resetTime = new Date(current.timestamp + config.windowMs);
      return NextResponse.json(
        { 
          error: config.message,
          retryAfter: Math.ceil((resetTime.getTime() - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toISOString(),
            'Retry-After': Math.ceil((resetTime.getTime() - now) / 1000).toString()
          }
        }
      );
    }
    
    // Increment counter
    current.count++;
    rateLimitStore.set(key, current);
    
    // Execute handler
    const response = await handler(req);
    
    // Add rate limit headers to response
    const remaining = Math.max(0, config.max - current.count);
    const resetTime = new Date(current.timestamp + config.windowMs);
    
    response.headers.set('X-RateLimit-Limit', config.max.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', resetTime.toISOString());
    
    return response;
  };
};

/**
 * AI-specific rate limiting with progressive slowdown
 */
export const withAIRateLimit = (handler) => {
  return async (req) => {
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const key = `ai-slowdown:${clientIp}`;
    const now = Date.now();
    const config = slowDownConfigs.ai;
    
    // Clean up old entries
    const cutoff = now - config.windowMs;
    for (const [k, v] of slowDownStore.entries()) {
      if (k.startsWith('ai-slowdown:') && v.timestamp < cutoff) {
        slowDownStore.delete(k);
      }
    }
    
    // Get current count
    const current = slowDownStore.get(key) || { count: 0, timestamp: now };
    
    // Reset if window has passed
    if (now - current.timestamp > config.windowMs) {
      current.count = 0;
      current.timestamp = now;
    }
    
    // Calculate delay
    let delay = 0;
    if (current.count > config.delayAfter) {
      delay = Math.min(
        (current.count - config.delayAfter) * config.delayMs,
        config.maxDelayMs
      );
    }
    
    // Apply delay if needed
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Increment counter
    current.count++;
    slowDownStore.set(key, current);
    
    // Apply rate limiting as well
    return withRateLimit('ai')(handler)(req);
  };
};

/**
 * Security headers middleware
 */
export const withSecurityHeaders = (handler) => {
  return async (req) => {
    const response = await handler(req);
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Add CSP header for API routes
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'none'; object-src 'none';");
    
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