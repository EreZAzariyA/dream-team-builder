/**
 * Tests for the new resilient AI Service
 */

import { AIService } from '../../../../lib/ai/AIService.js';

// Mock external dependencies
jest.mock('@google/generative-ai');
jest.mock('openai');

describe('AIService - Production Ready', () => {
  let aiService;

  beforeEach(() => {
    aiService = new AIService();
    // Clear any previous mocks
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct circuit breakers and retry policies', () => {
      expect(aiService.geminiCircuitBreaker).toBeDefined();
      expect(aiService.openaiCircuitBreaker).toBeDefined();
      expect(aiService.retryPolicy).toBeDefined();
      expect(aiService.usageTracker).toBeDefined();
    });

    test('should set correct provider priority', () => {
      expect(aiService.providerPriority).toEqual(['gemini', 'openai', 'fallback']);
    });

    test('should initialize health stats for providers', () => {
      expect(aiService.healthStats.gemini).toBeDefined();
      expect(aiService.healthStats.openai).toBeDefined();
      expect(aiService.healthStats.gemini.healthy).toBe(true);
      expect(aiService.healthStats.openai.healthy).toBe(true);
    });
  });

  describe('Circuit Breaker', () => {
    test('should create circuit breakers with correct configuration', () => {
      const geminiStatus = aiService.geminiCircuitBreaker.getStatus();
      const openaiStatus = aiService.openaiCircuitBreaker.getStatus();

      expect(geminiStatus.state).toBe('CLOSED');
      expect(geminiStatus.failureCount).toBe(0);
      expect(openaiStatus.state).toBe('CLOSED');
      expect(openaiStatus.failureCount).toBe(0);
    });

    test('should handle circuit breaker state transitions', async () => {
      const circuitBreaker = aiService.geminiCircuitBreaker;
      
      // Simulate failures
      for (let i = 0; i < 5; i++) {
        circuitBreaker.onFailure();
      }
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.failureCount).toBe(5);
    });
  });

  describe('Usage Tracking', () => {
    test('should track user usage correctly', () => {
      const userId = 'test-user-123';
      aiService.usageTracker.trackUsage(userId, 'gemini', 100, 0.05);
      
      const userStats = aiService.usageTracker.getUserStats(userId);
      expect(userStats.requests).toBe(1);
      expect(userStats.tokens).toBe(100);
      expect(userStats.cost).toBe(0.05);
      expect(userStats.providers.gemini.requests).toBe(1);
    });

    test('should check user limits correctly', () => {
      const userId = 'test-user-456';
      
      // First request should be allowed
      let limitsCheck = aiService.usageTracker.checkUserLimits(userId);
      expect(limitsCheck.allowed).toBe(true);
      
      // Simulate exceeding daily request limit
      for (let i = 0; i < 1001; i++) {
        aiService.usageTracker.trackUsage(userId, 'gemini', 10, 0.001);
      }
      
      limitsCheck = aiService.usageTracker.checkUserLimits(userId);
      expect(limitsCheck.allowed).toBe(false);
      expect(limitsCheck.reason).toBe('Daily request limit exceeded');
    });

    test('should track global usage statistics', () => {
      aiService.usageTracker.trackUsage('user1', 'gemini', 50, 0.025);
      aiService.usageTracker.trackUsage('user2', 'openai', 75, 0.15);
      
      const globalStats = aiService.usageTracker.getGlobalStats();
      expect(globalStats.requests).toBe(2);
      expect(globalStats.tokens).toBe(125);
      expect(globalStats.cost).toBe(0.175);
    });
  });

  describe('Retry Policy', () => {
    test('should calculate exponential backoff correctly', () => {
      const retryPolicy = aiService.retryPolicy;
      
      const delay0 = retryPolicy.calculateDelay(0);
      const delay1 = retryPolicy.calculateDelay(1);
      const delay2 = retryPolicy.calculateDelay(2);
      
      expect(delay0).toBeGreaterThanOrEqual(1000); // Base delay + jitter
      expect(delay1).toBeGreaterThanOrEqual(2000); // 2x base delay + jitter
      expect(delay2).toBeGreaterThanOrEqual(4000); // 4x base delay + jitter
      expect(delay2).toBeLessThanOrEqual(30000);   // Capped at max delay
    });

    test('should handle retry logic with immediate success', async () => {
      const retryPolicy = aiService.retryPolicy;
      
      // Mock function that succeeds immediately
      const mockFn = jest.fn(() => 'immediate success');
      
      const result = await retryPolicy.execute(mockFn);
      expect(result).toBe('immediate success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should handle retry configuration correctly', () => {
      const retryPolicy = aiService.retryPolicy;
      
      expect(retryPolicy.maxRetries).toBe(3);
      expect(retryPolicy.baseDelay).toBe(1000);
      expect(retryPolicy.maxDelay).toBe(10000);
      expect(retryPolicy.backoffMultiplier).toBe(2);
    });
  });

  describe('Error Classification', () => {
    test('should correctly identify retryable errors', () => {
      const retryableErrors = [
        new Error('Rate limit exceeded'),
        new Error('Request timeout'),
        new Error('Network error'),
        new Error('Service temporarily unavailable'),
        new Error('Internal server error'),
        new Error('Bad gateway'),
        new Error('Gateway timeout')
      ];
      
      retryableErrors.forEach(error => {
        expect(aiService.isRetryableError(error)).toBe(true);
      });
    });

    test('should correctly identify non-retryable errors', () => {
      const nonRetryableErrors = [
        new Error('Authentication failed'),
        new Error('Invalid API key'),
        new Error('Forbidden'),
        new Error('Not found'),
        new Error('Invalid request format')
      ];
      
      nonRetryableErrors.forEach(error => {
        expect(aiService.isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('Cost Estimation', () => {
    test('should estimate tokens correctly', () => {
      const text = 'This is a test message with approximately 32 characters';
      const tokens = aiService.estimateTokens(text);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    test('should calculate costs for different providers', () => {
      const tokens = 1000;
      const geminiCost = aiService.estimateCost('gemini', tokens);
      const openaiCost = aiService.estimateCost('openai', tokens);
      
      expect(geminiCost).toBe(0.00015); // $0.00015 per 1K tokens
      expect(openaiCost).toBe(0.0015);  // $0.0015 per 1K tokens
      expect(openaiCost).toBeGreaterThan(geminiCost);
    });
  });

  describe('System Status', () => {
    test('should provide comprehensive system status', () => {
      const systemStatus = aiService.getSystemStatus();
      
      expect(systemStatus.initialized).toBe(false);
      expect(systemStatus.providers.gemini).toBeDefined();
      expect(systemStatus.providers.openai).toBeDefined();
      expect(systemStatus.usage).toBeDefined();
      expect(systemStatus.providerPriority).toEqual(['gemini', 'openai', 'fallback']);
    });

    test('should allow updating provider priority', () => {
      const newPriority = ['openai', 'gemini', 'fallback'];
      aiService.setProviderPriority(newPriority);
      
      expect(aiService.providerPriority).toEqual(newPriority);
    });
  });

  describe('Fallback Response', () => {
    test('should generate fallback response when AI services fail', () => {
      const agentDefinition = {
        agent: {
          id: 'test-agent',
          name: 'Test Agent',
          title: 'Test Assistant'
        }
      };
      
      const userMessage = 'Hello, can you help me?';
      const fallbackResponse = aiService.generateFallbackResponse(agentDefinition, userMessage);
      
      expect(fallbackResponse.content).toContain('Test Agent');
      expect(fallbackResponse.content).toContain('Test Assistant');
      expect(fallbackResponse.content).toContain(userMessage);
      expect(fallbackResponse.agentId).toBe('test-agent');
      expect(fallbackResponse.agentName).toBe('Test Agent');
      expect(fallbackResponse.provider).toBe('fallback');
    });
  });

  describe('Admin Functions', () => {
    test('should reset circuit breakers', () => {
      // First, cause some failures
      aiService.geminiCircuitBreaker.onFailure();
      aiService.openaiCircuitBreaker.onFailure();
      
      expect(aiService.geminiCircuitBreaker.getStatus().failureCount).toBe(1);
      expect(aiService.openaiCircuitBreaker.getStatus().failureCount).toBe(1);
      
      // Reset circuit breakers
      aiService.resetCircuitBreakers();
      
      expect(aiService.geminiCircuitBreaker.getStatus().failureCount).toBe(0);
      expect(aiService.openaiCircuitBreaker.getStatus().failureCount).toBe(0);
    });
  });
});