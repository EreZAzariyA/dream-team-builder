/**
 * AI Service Initializer
 * Handles all initialization logic with clear, explicit flow
 * Removes the complexity of 4 different API key sources
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import logger from '../../utils/logger.js';
import { ApiKeyValidator } from '../utils/ApiKeyValidator.js';
import { ClientSideCrypto } from '../utils/ClientSideCrypto.js';

export class AIServiceInitializer {
  /**
   * Initialize AI clients with API keys
   * @param {Object} options - Initialization options
   * @param {Object} options.apiKeys - Direct API keys (highest priority)
   * @param {string} options.userId - User ID for database lookup (server-side only)
   * @param {boolean} options.useLocalStorage - Try localStorage (client-side only)
   * @returns {Promise<InitializationResult>}
   */
  static async initialize(options = {}) {
    const { apiKeys: providedKeys, userId, useLocalStorage = true } = options;

    // Step 1: Get API keys from highest priority source available
    const apiKeys = await this.getApiKeys(providedKeys, userId, useLocalStorage);

    // Step 2: Validate we have at least one provider
    if (!apiKeys || (!apiKeys.gemini && !apiKeys.openai)) {
      return {
        success: false,
        error: 'NO_API_KEYS',
        message: 'No API keys provided. Users must configure their own API keys.',
        clients: { gemini: null, openai: null },
        apiKeys: null
      };
    }

    // Step 3: Validate API key format
    const validation = ApiKeyValidator.validateAll(apiKeys);
    if (!validation.valid) {
      return {
        success: false,
        error: 'INVALID_API_KEYS',
        message: `Invalid API keys: ${validation.errors.join(', ')}`,
        validationErrors: validation.errors,
        clients: { gemini: null, openai: null },
        apiKeys: null
      };
    }

    // Step 4: Initialize clients
    const clients = await this.initializeClients(apiKeys);

    // Step 5: Verify at least one client initialized successfully
    if (!clients.gemini && !clients.openai) {
      return {
        success: false,
        error: 'CLIENT_INIT_FAILED',
        message: 'Failed to initialize any AI provider clients',
        clients,
        apiKeys: null
      };
    }

    return {
      success: true,
      clients,
      apiKeys,
      providers: {
        gemini: !!clients.gemini,
        openai: !!clients.openai
      }
    };
  }

  /**
   * Get API keys from available sources in priority order
   * Priority: 1. Provided keys, 2. Database (server), 3. LocalStorage (client)
   */
  static async getApiKeys(providedKeys, userId, useLocalStorage) {
    // Priority 1: Explicitly provided keys (highest priority)
    if (providedKeys && (providedKeys.gemini || providedKeys.openai)) {
      logger.info('🔑 Using explicitly provided API keys');
      return providedKeys;
    }

    // Priority 2: Database lookup (server-side only)
    if (userId && typeof window === 'undefined') {
      logger.info(`🔍 Attempting to load API keys from database for user: ${userId}`);
      const dbKeys = await this.loadFromDatabase(userId);
      if (dbKeys) {
        logger.info('✅ Loaded API keys from database');
        return dbKeys;
      }
      logger.warn('⚠️ No API keys found in database for user');
    }

    // Priority 3: LocalStorage (client-side only)
    if (useLocalStorage && typeof window !== 'undefined') {
      logger.info('🔍 Attempting to load API keys from localStorage');
      const localKeys = await this.loadFromLocalStorage();
      if (localKeys) {
        logger.info('✅ Loaded API keys from localStorage');
        return localKeys;
      }
      logger.warn('⚠️ No API keys found in localStorage');
    }

    return null;
  }

  /**
   * Load API keys from database (server-side only)
   */
  static async loadFromDatabase(userId) {
    if (typeof window !== 'undefined') {
      throw new Error('Cannot access database from client-side');
    }

    try {
      const { connectMongoose } = await import('../../database/mongodb.js');
      const { User } = await import('../../database/models/index.js');

      await connectMongoose();
      const user = await User.findById(userId);

      if (!user) {
        logger.warn(`User ${userId} not found in database`);
        return null;
      }

      const userApiKeys = user.getApiKeys();

      if (!userApiKeys.openai && !userApiKeys.gemini) {
        return null;
      }

      return {
        openai: userApiKeys.openai || null,
        gemini: userApiKeys.gemini || null
      };
    } catch (error) {
      logger.error('Failed to load API keys from database:', error);
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Load API keys from localStorage (client-side only)
   */
  static async loadFromLocalStorage() {
    if (typeof window === 'undefined') {
      throw new Error('Cannot access localStorage from server-side');
    }

    try {
      const savedKeys = localStorage.getItem('userApiKeys');
      if (!savedKeys) {
        return null;
      }

      const parsedKeys = JSON.parse(savedKeys);
      const decryptedKeys = {};

      // Decrypt if encrypted
      if (parsedKeys.openai) {
        decryptedKeys.openai = await ClientSideCrypto.decrypt(parsedKeys.openai);
      }
      if (parsedKeys.gemini) {
        decryptedKeys.gemini = await ClientSideCrypto.decrypt(parsedKeys.gemini);
      }

      if (!decryptedKeys.openai && !decryptedKeys.gemini) {
        return null;
      }

      return decryptedKeys;
    } catch (error) {
      logger.error('Failed to load API keys from localStorage:', error);
      throw new Error(`LocalStorage error: ${error.message}`);
    }
  }

  /**
   * Initialize AI provider clients
   */
  static async initializeClients(apiKeys) {
    const clients = {
      gemini: null,
      openai: null
    };

    // Initialize Gemini client
    if (apiKeys.gemini) {
      try {
        clients.gemini = new GoogleGenerativeAI(apiKeys.gemini);
        // Verify client works with a quick test
        const model = clients.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
        logger.info('✅ Gemini client initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Gemini client:', error);
        clients.gemini = null;
      }
    }

    // Initialize OpenAI client
    if (apiKeys.openai) {
      try {
        clients.openai = new OpenAI({
          apiKey: apiKeys.openai,
          timeout: 60000,
          maxRetries: 1
        });
        logger.info('✅ OpenAI client initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize OpenAI client:', error);
        clients.openai = null;
      }
    }

    return clients;
  }

  /**
   * Reinitialize with new API keys
   */
  static async reinitialize(newApiKeys) {
    logger.info('🔄 Reinitializing AI Service with new API keys');

    return await this.initialize({
      apiKeys: newApiKeys,
      useLocalStorage: false // Don't try localStorage during reinitialization
    });
  }
}

/**
 * @typedef {Object} InitializationResult
 * @property {boolean} success - Whether initialization succeeded
 * @property {string} [error] - Error code if failed (NO_API_KEYS, INVALID_API_KEYS, CLIENT_INIT_FAILED)
 * @property {string} [message] - Human-readable error message
 * @property {Object} clients - Initialized clients
 * @property {GoogleGenerativeAI} clients.gemini - Gemini client (null if not initialized)
 * @property {OpenAI} clients.openai - OpenAI client (null if not initialized)
 * @property {Object} [apiKeys] - API keys used (null if failed)
 * @property {Object} [providers] - Provider availability status
 * @property {boolean} [providers.gemini] - Whether Gemini is available
 * @property {boolean} [providers.openai] - Whether OpenAI is available
 * @property {Array<string>} [validationErrors] - Validation errors if applicable
 */
