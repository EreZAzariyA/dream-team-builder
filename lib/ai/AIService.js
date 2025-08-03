/**
 * AI Service Integration - Production Ready
 * Handles communication with multiple AI providers with circuit breakers,
 * intelligent retry policies, and automatic failover
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { ResponseFormatter, STRUCTURED_RESPONSE_TEMPLATE } from '../bmad/ResponseFormatter.js';

/**
 * Enhanced logging system with levels
 */
class Logger {
  static levels = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  static currentLevel = typeof process !== 'undefined' && process.env.NODE_ENV === 'development' 
    ? Logger.levels.DEBUG 
    : Logger.levels.INFO;

  static debug(...args) {
    if (Logger.currentLevel <= Logger.levels.DEBUG) {
      console.log('🔍 DEBUG:', ...args);
    }
  }

  static info(...args) {
    if (Logger.currentLevel <= Logger.levels.INFO) {
      console.log('ℹ️ INFO:', ...args);
    }
  }

  static warn(...args) {
    if (Logger.currentLevel <= Logger.levels.WARN) {
      console.warn('⚠️ WARN:', ...args);
    }
  }

  static error(...args) {
    if (Logger.currentLevel <= Logger.levels.ERROR) {
      console.error('❌ ERROR:', ...args);
    }
  }

  static setLevel(level) {
    Logger.currentLevel = level;
  }
}

/**
 * Queue-based request throttling system
 */
class RequestQueue {
  constructor(minInterval = 2000) {
    this.queues = new Map(); // userId -> queue
    this.minInterval = minInterval;
    this.processing = new Set(); // Track which users are being processed
  }

  async enqueue(userId, requestFn) {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }

    return new Promise((resolve, reject) => {
      this.queues.get(userId).push({ requestFn, resolve, reject });
      this.processQueue(userId);
    });
  }

  async processQueue(userId) {
    if (this.processing.has(userId)) {
      return; // Already processing this user's queue
    }

    const queue = this.queues.get(userId);
    if (!queue || queue.length === 0) {
      return;
    }

    this.processing.add(userId);

    try {
      while (queue.length > 0) {
        const { requestFn, resolve, reject } = queue.shift();
        
        try {
          Logger.debug(`Processing queued request for user ${userId}`);
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }

        // Wait before processing next request
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.minInterval));
        }
      }
    } finally {
      this.processing.delete(userId);
    }
  }

  getQueueLength(userId) {
    return this.queues.get(userId)?.length || 0;
  }

  clearQueue(userId) {
    this.queues.delete(userId);
    this.processing.delete(userId);
  }

  cleanup() {
    // Clean up empty queues
    for (const [userId, queue] of this.queues.entries()) {
      if (queue.length === 0 && !this.processing.has(userId)) {
        this.queues.delete(userId);
      }
    }
  }
}

/**
 * Error categorization for better handling
 */
class ErrorHandler {
  static categorizeError(error) {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.code;

    if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return {
        category: 'RATE_LIMIT',
        severity: 'medium',
        retryable: true,
        retryDelay: 60000
      };
    }

    if (message.includes('quota') || message.includes('billing') || message.includes('insufficient funds')) {
      return {
        category: 'QUOTA_EXCEEDED',
        severity: 'high',
        retryable: false,
        userAction: 'Check API key billing/quota'
      };
    }

    if (status === 401 || message.includes('unauthorized') || message.includes('invalid api key')) {
      return {
        category: 'AUTH_ERROR',
        severity: 'high',
        retryable: false,
        userAction: 'Verify API key'
      };
    }

    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return {
        category: 'NETWORK_ERROR',
        severity: 'medium',
        retryable: true,
        retryDelay: 5000
      };
    }

    if (status >= 500 || message.includes('internal server error') || message.includes('service unavailable')) {
      return {
        category: 'SERVER_ERROR',
        severity: 'medium',
        retryable: true,
        retryDelay: 10000
      };
    }

    if (status >= 400 && status < 500) {
      return {
        category: 'CLIENT_ERROR',
        severity: 'low',
        retryable: false
      };
    }

    return {
      category: 'UNKNOWN_ERROR',
      severity: 'medium',
      retryable: true,
      retryDelay: 5000
    };
  }
}

/**
 * Client-side encryption utilities for API keys
 * Uses Web Crypto API for secure localStorage storage
 */
class ClientSideCrypto {
  static async generateKey() {
    if (typeof window === 'undefined') return null;
    
    try {
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // not extractable
        ['encrypt', 'decrypt']
      );
      return key;
    } catch (error) {
      console.warn('Failed to generate encryption key:', error);
      return null;
    }
  }

  static async getOrCreateKey() {
    if (typeof window === 'undefined') return null;
    
    // Try to get existing key from session storage
    const existingKey = sessionStorage.getItem('ai_crypto_key');
    if (existingKey) {
      try {
        const keyData = JSON.parse(existingKey);
        return await window.crypto.subtle.importKey(
          'raw',
          new Uint8Array(keyData),
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      } catch (error) {
        console.warn('Failed to import existing key:', error);
      }
    }

    // Generate new key
    const key = await this.generateKey();
    if (key) {
      try {
        const exported = await window.crypto.subtle.exportKey('raw', key);
        sessionStorage.setItem('ai_crypto_key', JSON.stringify(Array.from(new Uint8Array(exported))));
      } catch (error) {
        console.warn('Failed to store encryption key:', error);
      }
    }
    return key;
  }

  static async encrypt(text) {
    if (typeof window === 'undefined' || !text) return text;
    
    try {
      const key = await this.getOrCreateKey();
      if (!key) return text; // Fallback to plaintext

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.warn('Client-side encryption failed:', error);
      return text; // Fallback to plaintext
    }
  }

  static async decrypt(encryptedData) {
    if (typeof window === 'undefined' || !encryptedData) return encryptedData;
    
    try {
      // Check if data looks encrypted (base64)
      if (!/^[A-Za-z0-9+/]+=*$/.test(encryptedData)) {
        return encryptedData; // Assume plaintext
      }

      const key = await this.getOrCreateKey();
      if (!key) return encryptedData;

      const combined = new Uint8Array(atob(encryptedData).split('').map(char => char.charCodeAt(0)));
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.warn('Client-side decryption failed:', error);
      return encryptedData; // Return as-is if decryption fails
    }
  }

  static isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    // Simple check for base64 format
    return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 20;
  }
}

/**
 * Circuit Breaker class for handling API failures
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    this.successCount = 0;
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN. Next attempt in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(); // Update circuit breaker state
      if (fallback) { // Always try fallback if provided and primary fails
        console.warn(`Primary function failed. Attempting fallback.`);
        try {
          return await fallback();
        } catch (fallbackError) {
          console.error(`Fallback function also failed:`, fallbackError);
          throw error; // Re-throw original error if fallback also fails
        }
      }
      throw error; // Re-throw if no fallback or fallback failed
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }
}

/**
 * Retry utility with exponential backoff
 */
class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter || 0.1;
  }

  async execute(fn, retryCondition = (error) => true) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries || !retryCondition(error)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        console.log(`🔄 Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms. Error: ${error.message}`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    const jitter = cappedDelay * this.jitter * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * API Key validation utilities
 */
class ApiKeyValidator {
  static validateOpenAI(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key must be a non-empty string' };
    }

    // OpenAI API keys start with 'sk-'
    if (!apiKey.startsWith('sk-')) {
      return { valid: false, error: 'OpenAI API key must start with "sk-"' };
    }

    // Very lenient length check (OpenAI keys vary significantly)
    if (apiKey.length < 20 || apiKey.length > 300) {
      return { valid: false, error: 'OpenAI API key has invalid length' };
    }

    // More permissive character validation for modern API keys
    if (!/^sk-[A-Za-z0-9\-_\.]+$/.test(apiKey)) {
      return { valid: false, error: 'OpenAI API key contains invalid characters' };
    }

    return { valid: true };
  }

  static validateGemini(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key must be a non-empty string' };
    }

    // Gemini API keys typically start with 'AIza' and are 39 characters
    if (!apiKey.startsWith('AIza')) {
      return { valid: false, error: 'Gemini API key must start with "AIza"' };
    }

    // Very lenient length check (Gemini keys can vary)
    if (apiKey.length < 20 || apiKey.length > 100) {
      return { valid: false, error: 'Gemini API key has invalid length' };
    }

    // More permissive character validation
    if (!/^AIza[A-Za-z0-9\-_\.]+$/.test(apiKey)) {
      return { valid: false, error: 'Gemini API key contains invalid characters' };
    }

    return { valid: true };
  }

  static validateAll(apiKeys) {
    const results = {};
    
    if (apiKeys.openai) {
      results.openai = this.validateOpenAI(apiKeys.openai);
    }
    
    if (apiKeys.gemini) {
      results.gemini = this.validateGemini(apiKeys.gemini);
    }

    const hasValidKey = Object.values(results).some(result => result.valid);
    const errors = Object.entries(results)
      .filter(([_, result]) => !result.valid)
      .map(([provider, result]) => `${provider}: ${result.error}`);

    return {
      valid: hasValidKey,
      results,
      errors: errors.length > 0 ? errors : null
    };
  }
}

/**
 * Usage tracking for cost control with TTL cleanup
 */
class UsageTracker {
  constructor() {
    this.userUsage = new Map();
    this.globalUsage = {
      requests: 0,
      tokens: 0,
      cost: 0
    };
    
    // TTL tracking for cleanup
    this.userActivityTimestamps = new Map();
    this.cleanupInterval = null;
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // Start cleanup interval
    this.startCleanup();
  }

  startCleanup() {
    if (this.cleanupInterval) return;
    
    // Clean up every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  cleanup() {
    const now = Date.now();
    const cutoff = now - this.maxAge;
    
    let cleanedUsers = 0;
    
    for (const [userId, timestamp] of this.userActivityTimestamps.entries()) {
      if (timestamp < cutoff) {
        this.userUsage.delete(userId);
        this.userActivityTimestamps.delete(userId);
        cleanedUsers++;
      }
    }
    
    if (cleanedUsers > 0) {
      console.log(`🧹 Cleaned up usage data for ${cleanedUsers} inactive users`);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  trackUsage(userId, provider, tokens, estimatedCost, inputTokens = null, outputTokens = null) {
    // Update activity timestamp
    this.userActivityTimestamps.set(userId, Date.now());
    
    if (!this.userUsage.has(userId)) {
      this.userUsage.set(userId, {
        requests: 0,
        tokens: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        providers: {},
        firstSeen: new Date(),
        lastActive: new Date()
      });
    }

    const userStats = this.userUsage.get(userId);
    userStats.requests++;
    userStats.tokens += tokens;
    userStats.cost += estimatedCost;
    userStats.lastActive = new Date();
    
    // Track input/output tokens if available
    if (inputTokens !== null && outputTokens !== null) {
      userStats.inputTokens += inputTokens;
      userStats.outputTokens += outputTokens;
    }
    
    if (!userStats.providers[provider]) {
      userStats.providers[provider] = { 
        requests: 0, 
        tokens: 0, 
        cost: 0,
        inputTokens: 0,
        outputTokens: 0
      };
    }
    userStats.providers[provider].requests++;
    userStats.providers[provider].tokens += tokens;
    userStats.providers[provider].cost += estimatedCost;
    
    // Track input/output tokens per provider if available
    if (inputTokens !== null && outputTokens !== null) {
      userStats.providers[provider].inputTokens += inputTokens;
      userStats.providers[provider].outputTokens += outputTokens;
    }

    // Update global usage
    this.globalUsage.requests++;
    this.globalUsage.tokens += tokens;
    this.globalUsage.cost += estimatedCost;
  }

  checkUserLimits(userId, limits = {}) {
    const userStats = this.userUsage.get(userId);
    if (!userStats) return { allowed: true };

    const dailyRequestLimit = limits.dailyRequests || 1000;
    const dailyCostLimit = limits.dailyCost || 10; // $10
    
    if (userStats.requests >= dailyRequestLimit) {
      return {
        allowed: false,
        reason: 'Daily request limit exceeded',
        current: userStats.requests,
        limit: dailyRequestLimit
      };
    }

    if (userStats.cost >= dailyCostLimit) {
      return {
        allowed: false,
        reason: 'Daily cost limit exceeded',
        current: userStats.cost.toFixed(2),
        limit: dailyCostLimit
      };
    }

    return { allowed: true };
  }

  getUserStats(userId) {
    return this.userUsage.get(userId) || null;
  }

  getGlobalStats() {
    return this.globalUsage;
  }
}

export class AIService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
    this.currentApiKeys = { gemini: null, openai: null }; // Store current keys for rate limiting
    this.initialized = false;
    
    // Initialize circuit breakers for each provider
    this.geminiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000 // 5 minutes
    });
    
    this.openaiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 300000 // 5 minutes
    });
    
    // Initialize retry policies with stricter limits for rate limiting
    this.retryPolicy = new RetryPolicy({
      maxRetries: 2, // Reduced from 3
      baseDelay: 2000, // Increased from 1000ms to 2000ms
      maxDelay: 30000, // Increased from 10000ms to 30000ms
      backoffMultiplier: 3 // Increased from 2 to 3
    });
    
    // Initialize request queue system
    this.requestQueue = new RequestQueue(2000); // 2 second intervals
    this.requestQueueCleanupInterval = null;
    
    // Start queue cleanup
    this.startQueueCleanup();
    
    // Initialize usage tracker
    this.usageTracker = new UsageTracker();
    
    // Note: ApiKeyValidator is static, no need to instantiate
    
    // Rate limiting per API key
    this.apiKeyRateLimits = new Map();
    this.apiKeyRequestCounts = new Map();
    this.apiKeyResetInterval = 60 * 60 * 1000; // 1 hour
    
    // Provider priority (primary to fallback)
    this.providerPriority = ['gemini', 'openai', 'fallback'];
    
    // Health monitoring
    this.healthStats = {
      gemini: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null },
      openai: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null }
    };
  }

  /**
   * Initialize AI service with API keys from environment, database, or user localStorage
   */
  async initialize(userApiKeys = null, userId = null) {
    try {
      // Get API keys from provided keys, database (server-side), or localStorage (client-side)
      let apiKeys = userApiKeys;
      
      // If no keys provided and we have a userId, try to fetch from database (server-side)
      if (!apiKeys && userId && typeof window === 'undefined') {
        try {
          // Server-side: fetch from database using user model directly
          const { connectMongoose } = await import('../database/mongodb.js');
          const { User } = await import('../database/models/index.js');
          
          await connectMongoose();
          const user = await User.findById(userId);
          if (user) {
            const userApiKeys = user.getApiKeys();
            if (userApiKeys.openai || userApiKeys.gemini) {
              apiKeys = {
                openai: userApiKeys.openai,
                gemini: userApiKeys.gemini
              };
              console.log('📚 Loaded user API keys from database');
            }
          }
        } catch (error) {
          console.warn('Failed to load user API keys from database:', error);
        }
      }
      
      // Client-side: try localStorage as fallback with decryption
      if (!apiKeys && typeof window !== 'undefined') {
        try {
          const savedKeys = localStorage.getItem('userApiKeys');
          if (savedKeys) {
            const parsedKeys = JSON.parse(savedKeys);
            
            // Decrypt API keys if they're encrypted
            const decryptedKeys = {};
            if (parsedKeys.openai) {
              decryptedKeys.openai = await ClientSideCrypto.decrypt(parsedKeys.openai);
            }
            if (parsedKeys.gemini) {
              decryptedKeys.gemini = await ClientSideCrypto.decrypt(parsedKeys.gemini);
            }
            
            apiKeys = decryptedKeys;
            console.log('💾 Loaded and decrypted user API keys from localStorage');
          }
        } catch (error) {
          console.warn('Failed to load user API keys from localStorage:', error);
        }
      }

      // Validate and initialize providers with validated keys
      if (apiKeys) {
        const validation = ApiKeyValidator.validateAll(apiKeys);
        
        if (validation.errors) {
          console.warn('⚠️ API key validation warnings:', validation.errors);
        }
        
        if (apiKeys.gemini) {
          if (validation.results.gemini?.valid) {
            if (!this.isApiKeyRateLimited(apiKeys.gemini)) {
              this.geminiClient = new GoogleGenerativeAI(apiKeys.gemini);
              this.currentApiKeys.gemini = apiKeys.gemini;
              console.log('✅ Gemini AI initialized (user key)');
            } else {
              console.warn('⚠️ Gemini API key rate limited');
              this.updateProviderHealth('gemini', false, new Error('Rate limited'));
            }
          } else {
            this.updateProviderHealth('gemini', false, new Error(validation.results.gemini?.error));
          }
        }

        if (apiKeys.openai) {
          if (validation.results.openai?.valid) {
            if (!this.isApiKeyRateLimited(apiKeys.openai)) {
              this.openaiClient = new OpenAI({ apiKey: apiKeys.openai });
              this.currentApiKeys.openai = apiKeys.openai;
              console.log('✅ OpenAI initialized (user key)');
            } else {
              console.warn('⚠️ OpenAI API key rate limited');
              this.updateProviderHealth('openai', false, new Error('Rate limited'));
            }
          } else {
            this.updateProviderHealth('openai', false, new Error(validation.results.openai?.error));
          }
        }
      }

      // Check if we have any providers
      if (!this.geminiClient && !this.openaiClient) {
        // Mark all providers as unhealthy since no keys provided
        this.healthStats.gemini.healthy = false;
        this.healthStats.openai.healthy = false;
        this.healthStats.gemini.lastCheck = new Date();
        this.healthStats.openai.lastCheck = new Date();
        
        this.initialized = true;
        this.needsUserApiKeys = true;
        return true;
      }

      this.initialized = true;
      this.needsUserApiKeys = false;
      
      // Skip initial health checks to avoid rate limiting during startup
      // Health checks will be performed on-demand or via API endpoint
      console.log('🔧 AI Service initialized - health checks will be performed on-demand');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI service:', error);
      return false;
    }
  }

  /**
   * Reinitialize service with updated user API keys
   */
  async reinitializeWithUserKeys(userApiKeys, userId = null) {
    this.initialized = false;
    this.geminiClient = null;
    this.openaiClient = null;
    
    // Reset circuit breakers and health stats
    this.geminiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    });
    
    this.openaiCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 300000
    });
    
    this.healthStats = {
      gemini: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null },
      openai: { healthy: true, lastCheck: null, errorCount: 0, quotaExhausted: false, lastQuotaError: null }
    };
    
    // Reset the needs API keys flag
    this.needsUserApiKeys = false;
    
    const success = await this.initialize(userApiKeys, userId);
    
    if (success) {
      // Skip immediate health check to avoid rate limiting - will be done on-demand
      // Mark providers as potentially healthy since we just reinitialized
      if (this.geminiClient) {
        this.healthStats.gemini.healthy = true;
        this.healthStats.gemini.lastCheck = new Date();
      }
      if (this.openaiClient) {
        this.healthStats.openai.healthy = true;
        this.healthStats.openai.lastCheck = new Date();
      }
    }
    
    return success;
  }

  /**
   * Generate response using agent persona and rules with intelligent failover
   */
  async generateAgentResponse(agentDefinition, userMessage, conversationHistory = [], userId = 'anonymous') {
    if (!this.initialized) {
      // Pass userId to initialize method so it can fetch user's API keys from database
      await this.initialize(null, userId !== 'anonymous' ? userId : null);
    }

    // For BMAD workflow execution, don't use fallback responses - throw errors instead
    const isWorkflowExecution = userId === 'bmad-workflow';
    
    // Check if user needs to provide API keys
    if (this.needsUserApiKeys || (!this.geminiClient && !this.openaiClient)) {
      if (isWorkflowExecution) {
        throw new Error('AI providers not available for workflow execution. API keys required.');
      }
      return this.generateNoApiKeysResponse(agentDefinition, userMessage, userId);
    }

    // Check user usage limits first
    const usageCheck = this.usageTracker.checkUserLimits(userId);
    if (!usageCheck.allowed) {
      throw new Error(`Usage limit exceeded: ${usageCheck.reason}. Current: ${usageCheck.current}, Limit: ${usageCheck.limit}`);
    }

    // Use queue-based throttling for the actual request
    return await this.requestQueue.enqueue(userId, async () => {
      return await this.executeProviderRequest(agentDefinition, userMessage, conversationHistory, userId, isWorkflowExecution);
    });
  }

  /**
   * Execute the actual provider request (called from queue)
   */
  async executeProviderRequest(agentDefinition, userMessage, conversationHistory, userId, isWorkflowExecution = false) {
    // Try providers in priority order
    for (const provider of this.providerPriority) {
      if (provider === 'fallback') {
        // For workflow execution, don't use fallback - throw error instead
        if (isWorkflowExecution) {
          throw new Error('All AI providers failed during workflow execution. No fallback available for automated workflows.');
        }
        return this.generateFallbackResponse(agentDefinition, userMessage);
      }

      try {
        const result = await this.generateWithProvider(provider, agentDefinition, userMessage, conversationHistory, userId);
        
        // Track successful usage with enhanced token data
        const usage = result.usage || {};
        const tokens = usage.tokens || this.estimateTokens(userMessage + (result.content || ''));
        const cost = usage.cost || this.estimateCost(provider, tokens);
        const inputTokens = usage.inputTokens || null;
        const outputTokens = usage.outputTokens || null;
        
        this.usageTracker.trackUsage(userId, provider, tokens, cost, inputTokens, outputTokens);
        
        return result;
      } catch (error) {
        this.handleProviderError(provider, error);
        
        // For workflow execution, be more strict about errors
        if (isWorkflowExecution) {
          console.error(`🚫 Workflow execution: Provider ${provider} failed:`, error.message);
        }
        
        // Continue to next provider
        continue;
      }
    }

    // If we get here, all providers failed
    const errorMsg = isWorkflowExecution 
      ? 'All AI providers failed during workflow execution. Please check API keys and quotas.'
      : 'All AI providers are currently unavailable';
    throw new Error(errorMsg);
  }

  /**
   * Generate response with specific provider using circuit breaker and retry logic
   */
  async generateWithProvider(provider, agentDefinition, userMessage, conversationHistory, userId) { // eslint-disable-line no-unused-vars
    if (provider === 'gemini' && this.geminiClient) {
      return await this.geminiCircuitBreaker.execute(
        () => this.retryPolicy.execute(
          () => this.generateWithGemini(agentDefinition, userMessage, conversationHistory)
        ),
        () => this.generateWithOpenAI(agentDefinition, userMessage, conversationHistory)
      );
    }
    
    if (provider === 'openai' && this.openaiClient) {
      return await this.openaiCircuitBreaker.execute(
        () => this.retryPolicy.execute(
          () => this.generateWithOpenAI(agentDefinition, userMessage, conversationHistory)
        )
      );
    }
    
    throw new Error(`Provider ${provider} not available`);
  }

  /**
   * Generate response using Gemini
   */
  async generateWithGemini(agentDefinition, userMessage, conversationHistory) {
    try {
      // Track API key usage for rate limiting
      if (this.geminiClient) {
        const apiKey = this.getCurrentGeminiApiKey();
        if (apiKey) {
          this.trackApiKeyUsage(apiKey);
        }
      }
      
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Build the system prompt with agent persona and rules
      const systemPrompt = this.buildAgentPrompt(agentDefinition);
      
      // Build conversation context
      const conversationContext = this.buildConversationContext(conversationHistory);
      
      // Combine everything into the final prompt
      const fullPrompt = `${systemPrompt}

${conversationContext}

User: ${userMessage}

Agent Response:`;


      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      this.updateProviderHealth('gemini', true);

      // Try to get actual token usage from Gemini API if available
      const usageMetadata = response.usageMetadata;
      let tokens, cost, inputTokens, outputTokens;
      
      if (usageMetadata) {
        inputTokens = usageMetadata.promptTokenCount || 0;
        outputTokens = usageMetadata.candidatesTokenCount || 0;
        tokens = inputTokens + outputTokens;
        cost = this.estimateCost('gemini', tokens, inputTokens, outputTokens);
        Logger.info('📊 Gemini actual usage:', { inputTokens, outputTokens, totalTokens: tokens, cost: cost.toFixed(6) });
      } else {
        // Fallback to estimation
        tokens = this.estimateTokens(fullPrompt + text);
        cost = this.estimateCost('gemini', tokens);
        Logger.debug('📊 Gemini estimated usage:', { tokens, cost: cost.toFixed(6) });
      }
      
      const usage = { tokens, cost, inputTokens, outputTokens };

      const formattedResponse = ResponseFormatter.formatAgentResponse(
        agentDefinition, text.trim(), { provider: 'gemini', usage }
      );

      return {
        content: text.trim(),
        agentId: agentDefinition.agent?.id || 'unknown-agent',
        agentName: agentDefinition.agent?.name || 'AI Agent',
        provider: 'gemini',
        usage,
        structured: formattedResponse
      };
    } catch (error) {
      this.handleProviderError('gemini', error);
      throw error;
    }
  }

  /**
   * Generate response using OpenAI
   */
  async generateWithOpenAI(agentDefinition, userMessage, conversationHistory) {
    try {
      // Track API key usage for rate limiting
      if (this.openaiClient) {
        const apiKey = this.getCurrentOpenAIApiKey();
        if (apiKey) {
          this.trackApiKeyUsage(apiKey);
        }
      }
      
      // Build the system prompt with agent persona and rules
      const systemPrompt = this.buildAgentPrompt(agentDefinition);
      
      // Build conversation context
      const conversationContext = this.buildConversationContext(conversationHistory);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${conversationContext}

${userMessage}` }
      ];


      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || '';
      
      this.updateProviderHealth('openai', true);

      // Try to get actual token usage from OpenAI API
      let tokens, cost, inputTokens, outputTokens;
      
      if (response.usage) {
        inputTokens = response.usage.prompt_tokens || 0;
        outputTokens = response.usage.completion_tokens || 0;
        tokens = response.usage.total_tokens || (inputTokens + outputTokens);
        cost = this.estimateCost('openai', tokens, inputTokens, outputTokens);
        Logger.info('📊 OpenAI actual usage:', { inputTokens, outputTokens, totalTokens: tokens, cost: cost.toFixed(6) });
      } else {
        // Fallback to estimation
        tokens = this.estimateTokens(systemPrompt + userMessage + content);
        cost = this.estimateCost('openai', tokens);
        Logger.debug('📊 OpenAI estimated usage:', { tokens, cost: cost.toFixed(6) });
      }
      
      const usage = { tokens, cost, inputTokens, outputTokens };

      const formattedResponse = ResponseFormatter.formatAgentResponse(
        agentDefinition, content.trim(), { provider: 'openai', usage }
      );

      return {
        content: content.trim(),
        agentId: agentDefinition.agent?.id || 'unknown-agent',
        agentName: agentDefinition.agent?.name || 'AI Agent',
        provider: 'openai',
        usage,
        structured: formattedResponse
      };
    } catch (error) {
      this.handleProviderError('openai', error);
      throw error;
    }
  }

  /**
   * Build agent prompt from definition
   */
  buildAgentPrompt(agentDefinition) {
    if (!agentDefinition || !agentDefinition.agent || !agentDefinition.persona) {
      return "You are a helpful AI assistant.";
    }

    const { agent, persona } = agentDefinition;
    
    let prompt = `You are ${agent.name}, a ${agent.title}. ${agent.icon}

PERSONA:
- Role: ${persona.role}
- Style: ${persona.style}
- Identity: ${persona.identity}
- Focus: ${persona.focus}

CORE PRINCIPLES:`;

    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      persona.core_principles.forEach(principle => {
        prompt += `\n- ${principle}`;
      });
    }

    prompt += `\n\nIMPORTANT: Stay in character as ${agent.name}. Respond according to your persona and expertise as a ${agent.title}.`;

    // Add available commands if they exist
    if (agentDefinition.commands && Array.isArray(agentDefinition.commands)) {
      const commandNames = agentDefinition.commands.map(cmd => {
        if (typeof cmd === 'string') {
          return `*${cmd.split(':')[0]}`;
        } else if (typeof cmd === 'object' && cmd !== null) {
          // Handle YAML object format like {help: "Show numbered list..."}
          const commandName = Object.keys(cmd)[0];
          return `*${commandName}`;
        }
        return '*unknown';
      });
      prompt += `\n\nAVAILABLE COMMANDS: ${commandNames.join(', ')}`;
      prompt += `\nNote: Users can use commands with * prefix (e.g., *help)`;
    }

    // Add structured response format instruction
    prompt += `\n\n${STRUCTURED_RESPONSE_TEMPLATE}`;

    return prompt;
  }

  /**
   * Build conversation context from history
   */
  buildConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return "This is the start of a new conversation.";
    }

    let context = "Previous conversation:\n";
    conversationHistory.slice(-5).forEach(msg => { // Only use last 5 messages
      const role = msg.from === 'user' ? 'User' : 'Agent';
      context += `${role}: ${msg.content}\n`;
    });

    return context;
  }

  /**
   * Generate response when user needs to provide API keys
   */
  generateNoApiKeysResponse(agentDefinition, userMessage, userId) {
    const agentName = agentDefinition?.agent?.name || 'AI Agent';
    const agentTitle = agentDefinition?.agent?.title || 'Assistant';
    
    return {
      content: `Hi! I'm ${agentName}, your ${agentTitle}. 

I understand you're asking about: "${userMessage}"

To continue using AI features and avoid shared quota limitations, please provide your own API keys:

**🔑 Add Your API Keys:**
• Go to Settings → AI Provider API Keys
• Add your OpenAI and/or Google Gemini API keys
• Get free API keys:
  - OpenAI: https://platform.openai.com/api-keys
  - Gemini: https://makersuite.google.com/app/apikey

**Why do I need API keys?**
• Shared quotas have been exhausted
• Your own keys give you dedicated access
• Free tiers available for both providers

Once you add your API keys, I'll be ready to help with your request!`,
      agentId: agentDefinition?.agent?.id || 'no-api-keys-agent',
      agentName: agentName,
      provider: 'none',
      needsApiKeys: true,
      userId: userId
    };
  }

  /**
   * Generate fallback response when AI services are unavailable
   */
  generateFallbackResponse(agentDefinition, userMessage) {
    const agentName = agentDefinition?.agent?.name || 'AI Agent';
    const agentTitle = agentDefinition?.agent?.title || 'Assistant';
    
    // Check if both providers are quota-limited
    const geminiQuotaExhausted = this.geminiCircuitBreaker.getStatus().state === 'OPEN';
    const openaiQuotaExhausted = this.openaiCircuitBreaker.getStatus().state === 'OPEN';
    
    if (geminiQuotaExhausted && openaiQuotaExhausted) {
      return {
        content: `Hi! I'm ${agentName}, your ${agentTitle}. 

I understand you're asking about: "${userMessage}"

Unfortunately, I'm currently unable to provide AI-powered responses because both our AI providers (OpenAI and Google Gemini) have reached their daily quota limits. This is a temporary limitation.

**What you can do:**
• Try again tomorrow when quotas reset
• Check if you have paid API keys to increase limits
• Use the system in non-AI mode for basic functionality

I apologize for the inconvenience! The system will automatically recover when quotas reset.`,
        agentId: agentDefinition?.agent?.id || 'quota-limited-agent',
        agentName: agentName,
        provider: 'fallback',
        quotaExhausted: true
      };
    }
    
    const fallbackResponses = [
      `Hi! I'm ${agentName}, your ${agentTitle}. I received your message: "${userMessage}". I'm currently experiencing some technical issues but I'm here to help. Could you please try rephrasing your request?`,
      `Hello! ${agentName} here (${agentTitle}). I see you asked about: "${userMessage}". I'm having some connectivity issues right now, but I'd love to help once my systems are back online.`,
      `Greetings! This is ${agentName}, your ${agentTitle}. I got your message about: "${userMessage}". I'm currently in fallback mode but still ready to assist. What would you like to work on?`
    ];

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    return {
      content: randomResponse,
      agentId: agentDefinition?.agent?.id || 'fallback-agent',
      agentName: agentName,
      provider: 'fallback'
    };
  }

  /**
   * Get current Gemini API key
   */
  getCurrentGeminiApiKey() {
    return this.currentApiKeys.gemini;
  }

  /**
   * Get current OpenAI API key
   */
  getCurrentOpenAIApiKey() {
    return this.currentApiKeys.openai;
  }

  /**
   * Start cleanup for request queues
   */
  startQueueCleanup() {
    if (this.requestQueueCleanupInterval) return;
    
    this.requestQueueCleanupInterval = setInterval(() => {
      this.requestQueue.cleanup();
      Logger.debug('Cleaned up empty request queues');
    }, 30 * 60 * 1000);
  }

  /**
   * Check if API key is rate limited
   */
  isApiKeyRateLimited(apiKey) {
    const keyHash = this.hashApiKey(apiKey);
    const now = Date.now();
    const requestData = this.apiKeyRequestCounts.get(keyHash);
    
    if (!requestData) {
      return false;
    }
    
    // Reset counts if interval has passed
    if (now - requestData.resetTime > this.apiKeyResetInterval) {
      this.apiKeyRequestCounts.delete(keyHash);
      return false;
    }
    
    // Check if over limit (100 requests per hour per API key)
    return requestData.count >= 100;
  }

  /**
   * Track API key usage
   */
  trackApiKeyUsage(apiKey) {
    const keyHash = this.hashApiKey(apiKey);
    const now = Date.now();
    
    let requestData = this.apiKeyRequestCounts.get(keyHash);
    if (!requestData || now - requestData.resetTime > this.apiKeyResetInterval) {
      requestData = { count: 0, resetTime: now };
    }
    
    requestData.count++;
    this.apiKeyRequestCounts.set(keyHash, requestData);
  }

  /**
   * Hash API key for rate limiting (privacy protection)
   */
  hashApiKey(apiKey) {
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      const char = apiKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }


  /**
   * Check if error is retryable (temporary issues vs permanent failures)
   */
  isRetryableError(error) {
    const retryableMessages = [
      'rate limit',
      'rate limited',
      '429',
      'too many requests',
      'quota exceeded',
      'timeout',
      'network',
      'temporarily unavailable',
      'service unavailable',
      'internal server error',
      'bad gateway',
      'gateway timeout'
    ];
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.status || error.code;
    
    // Always retry on 429 (rate limit) errors
    if (errorCode === 429 || errorMessage.includes('429')) {
      return true;
    }
    
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Estimate token count for cost calculation
   */
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // More accurate token estimation based on OpenAI/Gemini patterns
    const words = text.trim().split(/\s+/).length;
    const chars = text.length;
    
    // Heuristics:
    // - English text: ~0.75 tokens per word
    // - Code/structured text: ~1.2 tokens per word  
    // - Special characters increase token count
    
    const hasCode = /[{}()\[\];"'`]/.test(text);
    const hasSpecialChars = /[^a-zA-Z0-9\s.,!?-]/.test(text);
    
    let tokensPerWord = 0.75;
    if (hasCode) tokensPerWord = 1.2;
    else if (hasSpecialChars) tokensPerWord = 0.9;
    
    // Character-based fallback for very short or long texts
    const wordBasedEstimate = Math.ceil(words * tokensPerWord);
    const charBasedEstimate = Math.ceil(chars / 4);
    
    // Use the higher estimate for safety in cost calculations
    return Math.max(wordBasedEstimate, charBasedEstimate, 1);
  }

  /**
   * Estimate cost based on provider and token count
   * Updated for current models: GPT-3.5-turbo and Gemini-2.0-flash
   */
  estimateCost(provider, tokens, inputTokens = null, outputTokens = null) {
    // Current API pricing as of January 2025
    const pricing = {
      // GPT-3.5-turbo: $0.50 input / $1.50 output per 1M tokens
      openai: {
        input: 0.50 / 1000000,   // $0.0005 per 1K tokens
        output: 1.50 / 1000000,  // $0.0015 per 1K tokens
        average: 1.00 / 1000000  // $0.001 per 1K tokens (when input/output split unknown)
      },
      // Gemini-2.5-flash: $0.075 input / $0.30 output per 1M tokens  
      gemini: {
        input: 0.075 / 1000000,  // $0.000075 per 1K tokens
        output: 0.30 / 1000000,  // $0.0003 per 1K tokens
        average: 0.1875 / 1000000 // $0.0001875 per 1K tokens (when input/output split unknown)
      }
    };
    
    const providerPricing = pricing[provider];
    if (!providerPricing) return 0;
    
    // If we have separate input/output token counts, use precise pricing
    if (inputTokens !== null && outputTokens !== null) {
      return (inputTokens * providerPricing.input) + (outputTokens * providerPricing.output);
    }
    
    // Otherwise, use average rate for total tokens
    return tokens * providerPricing.average;
  }

  /**
   * Perform health checks on all providers
   */
  async performHealthChecks() {
    // Don't perform health checks if user needs to provide API keys or no clients available
    if (this.needsUserApiKeys || (!this.geminiClient && !this.openaiClient)) {
      console.log('⏭️ Skipping health checks - no providers available or user needs API keys');
      return;
    }
    
    const checks = [];
    
    if (this.geminiClient) {
      checks.push(this.checkGeminiHealth());
    }
    
    if (this.openaiClient) {
      checks.push(this.checkOpenAIHealth());
    }
    
    await Promise.allSettled(checks);
  }

  /**
   * Check Gemini health (passive check - no API calls during rate limits)
   */
  async checkGeminiHealth() {
    try {
      // During rate limit periods, just check if client is initialized
      if (this.geminiCircuitBreaker.getStatus().state === 'OPEN') {
        console.log('🔍 Gemini health check skipped - circuit breaker is OPEN');
        return { provider: 'gemini', status: 'rate_limited', error: 'Circuit breaker open due to rate limits' };
      }

      // Skip if too many errors or checked recently
      if (this.healthStats.gemini.errorCount > 3) {
        return { provider: 'gemini', status: 'degraded', error: 'Too many recent errors' };
      }

      const lastCheck = this.healthStats.gemini.lastCheck;
      if (lastCheck && (Date.now() - lastCheck) < 30000) { // 30 second cooldown
        return { provider: 'gemini', status: this.healthStats.gemini.healthy ? 'healthy' : 'degraded', cached: true };
      }

      console.log('🔍 Checking Gemini health...');
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('OK');
      const response = await result.response;
      const text = response.text();
      
      this.healthStats.gemini.healthy = true;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount = 0;
      
      console.log('✅ Gemini health check passed:', text.trim());
      return { provider: 'gemini', status: 'healthy', response: text.trim() };
    } catch (error) {
      console.error('❌ Gemini health check failed:', error.message);
      this.healthStats.gemini.healthy = false;
      this.healthStats.gemini.lastCheck = new Date();
      this.healthStats.gemini.errorCount++;
      
      // If rate limited or quota exceeded, mark circuit breaker and track quota exhaustion
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || 
          error.message?.includes('quota') || error.message?.includes('exceeded')) {
        this.geminiCircuitBreaker.onFailure();
        this.healthStats.gemini.quotaExhausted = true;
        this.healthStats.gemini.lastQuotaError = new Date();
        console.log('🚫 Gemini quota/rate limit detected - opening circuit breaker');
      }
      
      return { provider: 'gemini', status: 'error', error: error.message };
    }
  }

  /**
   * Check OpenAI health (passive check - no API calls during rate limits)
   */
  async checkOpenAIHealth() {
    try {
      // During rate limit periods, just check if client is initialized
      if (this.openaiCircuitBreaker.getStatus().state === 'OPEN') {
        console.log('🔍 OpenAI health check skipped - circuit breaker is OPEN');
        return { provider: 'openai', status: 'rate_limited', error: 'Circuit breaker open due to rate limits' };
      }

      // Skip if too many errors or checked recently
      if (this.healthStats.openai.errorCount > 3) {
        return { provider: 'openai', status: 'degraded', error: 'Too many recent errors' };
      }

      const lastCheck = this.healthStats.openai.lastCheck;
      if (lastCheck && (Date.now() - lastCheck) < 30000) { // 30 second cooldown
        return { provider: 'openai', status: this.healthStats.openai.healthy ? 'healthy' : 'degraded', cached: true };
      }

      console.log('🔍 Checking OpenAI health...');
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'OK' }],
        max_tokens: 5
      });
      
      const content = response.choices[0]?.message?.content || '';
      
      this.healthStats.openai.healthy = true;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount = 0;
      
      console.log('✅ OpenAI health check passed:', content.trim());
      return { provider: 'openai', status: 'healthy', response: content.trim() };
    } catch (error) {
      console.error('❌ OpenAI health check failed:', error.message);
      this.healthStats.openai.healthy = false;
      this.healthStats.openai.lastCheck = new Date();
      this.healthStats.openai.errorCount++;
      
      // If rate limited or quota exceeded, mark circuit breaker and track quota exhaustion
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.status === 429 ||
          error.message?.includes('quota') || error.message?.includes('exceeded')) {
        this.openaiCircuitBreaker.onFailure();
        this.healthStats.openai.quotaExhausted = true;
        this.healthStats.openai.lastQuotaError = new Date();
        console.log('🚫 OpenAI quota/rate limit detected - opening circuit breaker');
      }
      
      return { provider: 'openai', status: 'error', error: error.message };
    }
  }

  /**
   * Check if AI service is available and working
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const healthChecks = await this.performHealthChecks();
      
      const healthyProviders = Object.entries(this.healthStats)
        .filter(([_, stats]) => stats.healthy)
        .map(([provider, _]) => provider);
      
      const circuitBreakerStatus = {
        gemini: this.geminiCircuitBreaker.getStatus(),
        openai: this.openaiCircuitBreaker.getStatus()
      };
      
      // Determine overall status
      let overallStatus = 'healthy';
      if (this.needsUserApiKeys) {
        overallStatus = 'needs_api_keys';
      } else if (!this.geminiClient && !this.openaiClient) {
        overallStatus = 'needs_api_keys';
      } else {
        // Check if any providers have quota issues (either circuit-broken OR marked as quota exhausted)
        const hasQuotaIssues = (this.geminiClient && (circuitBreakerStatus.gemini.state === 'OPEN' || this.healthStats.gemini.quotaExhausted)) ||
                               (this.openaiClient && (circuitBreakerStatus.openai.state === 'OPEN' || this.healthStats.openai.quotaExhausted));
        
        if (hasQuotaIssues) {
          overallStatus = 'quota_limited';
        } else if (healthyProviders.length === 0) {
          overallStatus = 'degraded';
        }
      }

      return {
        status: overallStatus,
        providers: this.healthStats,
        circuitBreakers: circuitBreakerStatus,
        usageStats: this.usageTracker.getGlobalStats(),
        healthyProviders,
        providerPriority: this.providerPriority,
        needsUserApiKeys: this.needsUserApiKeys || false
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        providers: this.healthStats
      };
    }
  }

  /**
   * Get detailed system status for monitoring
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      providers: {
        gemini: {
          available: !!this.geminiClient,
          health: this.healthStats.gemini,
          circuitBreaker: this.geminiCircuitBreaker.getStatus()
        },
        openai: {
          available: !!this.openaiClient,
          health: this.healthStats.openai,
          circuitBreaker: this.openaiCircuitBreaker.getStatus()
        }
      },
      usage: this.usageTracker.getGlobalStats(),
      providerPriority: this.providerPriority
    };
  }

  /**
   * Update provider priority order
   */
  setProviderPriority(newPriority) {
    this.providerPriority = newPriority;
    console.log('🔄 Updated provider priority:', newPriority);
  }

  /**
   * Get user-specific usage stats
   */
  getUserUsageStats(userId) {
    return this.usageTracker.getUserStats(userId);
  }

  /**
   * Update provider health status
   */
  updateProviderHealth(provider, healthy, error = null) {
    this.healthStats[provider].healthy = healthy;
    this.healthStats[provider].lastCheck = new Date();
    if (!healthy) {
      this.healthStats[provider].errorCount++;
      if (error) {
        console.error(`❌ ${provider} error:`, error.message);
      }
    } else {
      this.healthStats[provider].errorCount = 0;
    }
  }

  /**
   * Handle provider errors consistently
   */
  handleProviderError(provider, error) {
    const errorInfo = ErrorHandler.categorizeError(error);
    
    Logger.error(`${provider} error:`, {
      category: errorInfo.category,
      severity: errorInfo.severity,
      message: error.message,
      retryable: errorInfo.retryable
    });
    
    this.updateProviderHealth(provider, false, error);
    
    if (!errorInfo.retryable) {
      const circuitBreaker = provider === 'gemini' ? this.geminiCircuitBreaker : this.openaiCircuitBreaker;
      circuitBreaker.onFailure();
    }
    
    // Store error info for potential user feedback
    error.aiServiceInfo = errorInfo;
  }

  /**
   * Utility method to encrypt and store API keys in localStorage
   */
  static async storeApiKeysSecurely(apiKeys) {
    if (typeof window === 'undefined') return false;
    
    try {
      const encryptedKeys = {};
      
      if (apiKeys.openai) {
        encryptedKeys.openai = await ClientSideCrypto.encrypt(apiKeys.openai);
      }
      
      if (apiKeys.gemini) {
        encryptedKeys.gemini = await ClientSideCrypto.encrypt(apiKeys.gemini);
      }
      
      localStorage.setItem('userApiKeys', JSON.stringify(encryptedKeys));
      console.log('🔐 API keys encrypted and stored securely');
      return true;
    } catch (error) {
      console.error('Failed to store API keys securely:', error);
      return false;
    }
  }

  /**
   * Cleanup method for proper lifecycle management
   */
  destroy() {
    if (this.requestQueueCleanupInterval) {
      clearInterval(this.requestQueueCleanupInterval);
      this.requestQueueCleanupInterval = null;
    }
    
    if (this.usageTracker) {
      this.usageTracker.destroy();
    }
    
    this.apiKeyRequestCounts.clear();
    this.currentApiKeys = { gemini: null, openai: null };
    
    console.log('🧹 AIService cleanup completed');
  }

  /**
   * Reset circuit breakers (admin function)
   */
  resetCircuitBreakers() {
    this.geminiCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 60000 });
    this.openaiCircuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
    console.log('🔄 Circuit breakers reset');
  }
}

// Export classes for testing and utility functions
export { Logger, RequestQueue, ErrorHandler, ClientSideCrypto, ApiKeyValidator, UsageTracker, CircuitBreaker, RetryPolicy };

// Export singleton instance
export const aiService = new AIService();
export default aiService;