/**
 * API Key validation utilities
 * Validates API keys for different AI providers
 */

export class ApiKeyValidator {
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

export default ApiKeyValidator;