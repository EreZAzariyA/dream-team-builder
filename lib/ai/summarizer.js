import logger from '../utils/logger.js';

/**
 * Generate fallback message when AI summary fails
 */
function generateFallbackMessage(metrics, errorType = 'general', errorMessage = '') {
  const baseStats = `Repository analysis completed with ${metrics.fileCount} files, ${metrics.totalLines.toLocaleString()} lines of code across ${metrics.languageCount} languages.`;
  
  switch (errorType) {
    case 'no-api-key':
      return `${baseStats}

🔑 **API Key Required**: To get detailed AI insights and summaries, please configure your OpenAI or Google AI API keys in your account settings.

**To enable AI analysis:**
1. Go to your account settings
2. Add your OpenAI API key (recommended) or Google AI API key  
3. Re-run the repository analysis to get detailed AI insights

**Current analysis includes:**
• Complete file structure and metrics
• Programming language breakdown
• Code complexity statistics`;

    case 'empty-response':
      return `${baseStats}

🤖 **AI Analysis Unavailable**: The AI service returned an empty response. This might be due to API key configuration issues.

**Next Steps:**
• Check your API key configuration in account settings
• You can still explore all repository files and metrics below`;

    default:
      return `${baseStats}

❌ **AI Analysis Failed**: Unable to generate AI summary due to a technical issue. Please try again later.`;
  }
}

/**
 * Generate AI summary of repository
 */
export async function generateAISummary(analysis, fileIndex, metrics, userId) {
  const startTime = Date.now();
  
  try {
    // Import AI service
    const { aiService } = await import('./AIService.js');
    
    if (!aiService.initialized && userId) {
      try {
        await aiService.initialize(null, userId);
      } catch (initError) {
        logger.warn('AI service initialization failed - no API keys configured');
        return {
          success: false,
          content: generateFallbackMessage(metrics, 'no-api-key'),
          type: 'fallback',
          reason: 'no-api-key'
        };
      }
    }
    
    // Double-check if AI service is still not initialized (no API keys)
    if (!aiService.initialized) {
      logger.info('AI service not initialized - no API keys configured, returning fallback message');
      return {
        success: false,
        content: generateFallbackMessage(metrics, 'no-api-key'),
        type: 'fallback',
        reason: 'no-api-key'
      };
    }

    // Prepare repository context
    const topLanguages = Array.from(metrics.languages.entries())
      .sort(([,a], [,b]) => b.percentage - a.percentage)
      .slice(0, 5)
      .map(([lang, stats]) => `${lang} (${stats.percentage.toFixed(1)}%)`)
      .join(', ');

    const topFiles = metrics.largestFiles.slice(0, 10)
      .map(f => `${f.path} (${f.lines} lines, ${f.language})`)
      .join('\n');

    const prompt = `Analyze this GitHub repository and provide a comprehensive summary:

Repository: ${analysis.fullName}
Files: ${metrics.fileCount}
Total Lines of Code: ${metrics.totalLines.toLocaleString()}
Languages: ${topLanguages}
Size: ${(metrics.totalSize / 1024 / 1024).toFixed(1)} MB

Top Files:
${topFiles}

Please provide:
1. A brief description of what this repository appears to be (project type, purpose)
2. Key technologies and frameworks identified
3. Project structure and organization
4. Code quality observations
5. Any notable patterns or architectural decisions

Keep the summary concise but informative, around 200-300 words.`;

    logger.info('🤖 Generating AI summary with prompt:', {
      promptLength: prompt.length,
      repository: analysis.fullName,
      fileCount: metrics.fileCount,
      topLanguages,
      userId
    });

    const response = await aiService.call(prompt, null, 3, {
      action: 'repository_analysis',
      repositoryId: analysis.repositoryId,
      maxTokens: 2000
    }, userId);

    if (!response || !response.content || response.content.trim() === '') {
      logger.warn('AI summary generation resulted in an empty response.', {
        response: response,
        hasContent: !!response?.content,
        contentLength: response?.content?.length || 0
      });
      return {
        success: false,
        content: generateFallbackMessage(metrics, 'empty-response'),
        type: 'fallback',
        reason: 'empty-response'
      };
    }

    logger.info('✅ AI summary generated successfully', {
      contentLength: response.content.length,
      provider: response.provider
    });

    return {
      success: true,
      content: response.content,
      type: 'ai-summary',
      provider: response.provider
    };

  } catch (error) {
    logger.error('Failed to generate AI summary:', error);
    
    // Check if the error is related to missing API keys
    const isApiKeyError = error.message?.includes('API key') || 
                         error.message?.includes('initialized') ||
                         error.message?.includes('configuration');
    
    const errorType = isApiKeyError ? 'no-api-key' : 'general';
    return {
      success: false,
      content: generateFallbackMessage(metrics, errorType),
      type: 'fallback',
      reason: errorType
    };
  }
}
