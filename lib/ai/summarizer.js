import logger from '../utils/logger.js';

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
        logger.error('AI service initialization failed - no API keys configured');
        throw new Error('AI service not initialized. Please configure your API keys in account settings.');
      }
    }

    // Double-check if AI service is still not initialized (no API keys)
    if (!aiService.initialized) {
      logger.error('AI service not initialized - no API keys configured');
      throw new Error('AI service not initialized. Please configure your API keys in account settings.');
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

    const prompt = `Analyze this GitHub repository and provide a structured summary in **clean Markdown format**:

Repository: ${analysis.fullName}
Files: ${metrics.fileCount}
Total Lines of Code: ${metrics.totalLines.toLocaleString()}
Languages: ${topLanguages}
Size: ${(metrics.totalSize / 1024 / 1024).toFixed(1)} MB

Top Files:
${topFiles}

**IMPORTANT: Respond ONLY with valid Markdown. Use this exact structure:**

## 1. Project Overview

[2-3 sentences describing what this repository is and its main purpose]

## 2. Key Technologies

- Technology/Framework 1
- Technology/Framework 2
- Technology/Framework 3
- [Add more as needed]

## 3. Project Structure

[Describe the overall organization and architecture of the codebase. Mention key directories and their purposes.]

## 4. Code Quality

[Observations about code organization, patterns, and quality indicators. Be specific.]

## 5. Notable Features

[Any interesting architectural decisions, patterns, or unique aspects worth highlighting.]

**Requirements:**
- Use ## for section headers (not bold text or colons)
- Use bullet points (-) for lists under Key Technologies
- Be specific and informative
- Aim for 300-400 words total
- Output ONLY Markdown, no preamble or closing remarks`;

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
      maxTokens: 4000 // Increased from 2000 to allow complete repository analysis
    }, userId);

    if (!response || !response.content || response.content.trim() === '') {
      logger.error('AI summary generation resulted in an empty response.', {
        response: response,
        hasContent: !!response?.content,
        contentLength: response?.content?.length || 0
      });
      throw new Error('AI service returned empty response. Please try again.');
    }

    // Check if response has the expected markdown structure
    const hasMarkdownHeaders = /##\s+\d+\.\s+/.test(response.content);
    if (!hasMarkdownHeaders) {
      logger.warn('⚠️  AI summary lacks expected markdown structure (## headers), but using it anyway', {
        contentPreview: response.content.substring(0, 150),
        contentLength: response.content.length
      });
    }

    logger.info('✅ AI summary generated successfully', {
      contentLength: response.content.length,
      provider: response.provider,
      hasMarkdownHeaders
    });

    return {
      success: true,
      content: response.content,
      type: 'ai-summary',
      provider: response.provider
    };

  } catch (error) {
    logger.error('Failed to generate AI summary:', error);

    // Re-throw the error instead of returning fallback message
    return {
      success: false,
      error: error.message || 'Failed to generate AI summary',
      type: 'error'
    };
  }
}
