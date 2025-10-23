/**
 * Repository Insights API
 * Generate code insights, issues, and improvement suggestions
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';
import { redisService } from '@/lib/utils/redis.js';

/**
 * POST /api/repo/insights
 * Generate repository insights and suggestions (with caching)
 */
export async function POST(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    await connectMongoose();

    const body = await request.json();
    const { analysisId, repositoryId, forceRefresh = false } = body;

    if (!analysisId) {
      return NextResponse.json({
        success: false,
        error: 'Analysis ID is required'
      }, { status: 400 });
    }

    // Get analysis
    const analysis = await RepoAnalysis.findById(analysisId);
    if (!analysis || analysis.userId.toString() !== session.user.id) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found or access denied'
      }, { status: 404 });
    }

    const redisKey = `insights:${analysisId}`;

    // Check Redis cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cachedInsights = await redisService.get(redisKey);
        if (cachedInsights) {
          logger.info(`✅ CACHE HIT for insights: ${redisKey}`);
          return NextResponse.json({
            success: true,
            insights: cachedInsights,
            cached: true,
            source: 'redis'
          });
        }
        logger.info(`⚠️ CACHE MISS for insights: ${redisKey}`);
      } catch (redisError) {
        logger.error(`Redis GET error for ${redisKey}:`, redisError);
        // Continue to DB check
      }

      // Check DB cache (if insights exist and not too old)
      if (analysis.insights && analysis.insights.generatedAt) {
        const insightsAge = Date.now() - new Date(analysis.insights.generatedAt).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (insightsAge < maxAge) {
          logger.info(`✅ DB CACHE HIT for insights (${Math.round(insightsAge / 1000 / 60)} minutes old)`);

          // Store in Redis for faster access next time
          try {
            await redisService.set(redisKey, analysis.insights, 3600); // 1 hour TTL
            logger.info(`📦 Cached insights to Redis: ${redisKey}`);
          } catch (redisError) {
            logger.error(`Redis SET error for ${redisKey}:`, redisError);
          }

          return NextResponse.json({
            success: true,
            insights: analysis.insights,
            cached: true,
            source: 'database'
          });
        } else {
          logger.info(`⏰ Insights are stale (${Math.round(insightsAge / 1000 / 60 / 60)} hours old), regenerating...`);
        }
      }
    } else {
      logger.info(`🔄 Force refresh requested for insights: ${redisKey}`);
    }

    // Generate new insights
    logger.info(`🤖 Generating fresh insights with QA agent for ${analysisId}`);
    const insights = await generateRepositoryInsights(analysis, session.user.id);

    // Save to database
    analysis.insights = {
      ...insights,
      generatedAt: new Date(),
      generatedBy: 'qa',
      version: '1.0'
    };
    await analysis.save();
    logger.info(`💾 Saved insights to database for ${analysisId}`);

    // Cache in Redis (1 hour TTL)
    try {
      await redisService.set(redisKey, analysis.insights, 3600);
      logger.info(`📦 Cached insights to Redis: ${redisKey} (TTL: 1 hour)`);
    } catch (redisError) {
      logger.error(`Redis SET error for ${redisKey}:`, redisError);
    }

    return NextResponse.json({
      success: true,
      insights: analysis.insights,
      cached: false,
      source: 'generated'
    });

  } catch (error) {
    logger.error('Repository insights error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate insights',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Generate comprehensive repository insights using QA agent AI analysis
 */
async function generateRepositoryInsights(analysis, userId) {
  const insights = {
    summary: {
      total: 0,
      critical: 0,
      warnings: 0,
      suggestions: 0
    },
    categories: {
      codeQuality: [],
      security: [],
      performance: [],
      maintainability: [],
      documentation: [],
      testing: []
    },
    recommendations: [],
    trends: {}
  };

  // Generate AI-powered insights using QA agent
  try {
    const aiInsights = await generateAIInsights(analysis, userId);
    if (aiInsights && aiInsights.length > 0) {
      mergeAIInsights(insights, aiInsights);
      logger.info(`✅ Generated ${aiInsights.length} AI-powered insights from QA agent`);
    } else {
      logger.warn('No AI insights generated - returned empty or null');
    }
  } catch (error) {
    logger.error('Failed to generate AI insights:', error.message);
    throw new Error('Unable to generate repository insights. Please ensure AI service is configured.');
  }

  // Calculate summary
  insights.summary = calculateInsightsSummary(insights);

  return insights;
}

/**
 * Analyze code metrics for insights
 */
async function analyzeCodeMetrics(metrics, insights) {
  // Large codebase analysis
  if (metrics.totalLines > 100000) {
    insights.categories.maintainability.push({
      id: 'large-codebase',
      type: 'warning',
      severity: 'medium',
      title: 'Large Codebase Detected',
      description: `Repository contains ${metrics.totalLines.toLocaleString()} lines of code, which may impact maintainability and development velocity.`,
      impact: 'Medium',
      effort: 'High',
      suggestion: 'Consider modularizing the codebase, implementing microservices architecture, or creating clear module boundaries to improve maintainability.',
      tags: ['architecture', 'maintainability'],
      files: []
    });
  } else if (metrics.totalLines > 50000) {
    insights.categories.maintainability.push({
      id: 'medium-codebase',
      type: 'info',
      severity: 'low',
      title: 'Medium-Sized Codebase',
      description: `Repository has ${metrics.totalLines.toLocaleString()} lines of code. Consider implementing good architectural practices to maintain code quality as it grows.`,
      suggestion: 'Establish coding standards, implement regular code reviews, and consider architectural documentation.',
      tags: ['best-practices'],
      files: []
    });
  }

  // Language diversity analysis
  if (metrics.languageCount > 6) {
    insights.categories.maintainability.push({
      id: 'multi-language',
      type: 'warning',
      severity: 'medium',
      title: 'High Language Diversity',
      description: `Project uses ${metrics.languageCount} different programming languages, which may increase complexity and maintenance overhead.`,
      suggestion: 'Ensure consistent coding standards across languages and consider consolidating similar functionality.',
      tags: ['complexity', 'standards'],
      files: []
    });
  }

  // File size analysis
  if (metrics.largestFiles) {
    const largeFiles = metrics.largestFiles.filter(f => f.lines > 500);
    if (largeFiles.length > 5) {
      insights.categories.codeQuality.push({
        id: 'large-files',
        type: 'warning',
        severity: 'high',
        title: 'Multiple Large Files Detected',
        description: `Found ${largeFiles.length} files with over 500 lines of code. Large files can be difficult to maintain and understand.`,
        suggestion: 'Consider refactoring large files into smaller, more focused modules following the Single Responsibility Principle.',
        tags: ['refactoring', 'maintainability'],
        files: largeFiles.slice(0, 5).map(f => ({
          path: f.path,
          lines: f.lines,
          language: f.language
        }))
      });
    }

    // Extremely large files
    const hugeFiles = metrics.largestFiles.filter(f => f.lines > 1000);
    if (hugeFiles.length > 0) {
      insights.categories.codeQuality.push({
        id: 'huge-files',
        type: 'bug',
        severity: 'high',
        title: 'Extremely Large Files Found',
        description: `Found ${hugeFiles.length} files with over 1000 lines. These files likely violate the Single Responsibility Principle.`,
        suggestion: 'Immediate refactoring recommended. Break these files into smaller, focused modules.',
        tags: ['urgent', 'refactoring'],
        files: hugeFiles.slice(0, 3).map(f => ({
          path: f.path,
          lines: f.lines,
          language: f.language
        }))
      });
    }
  }

  // Language-specific insights
  if (metrics.languages) {
    analyzeLanguageSpecificIssues(metrics.languages, insights);
  }
}

/**
 * Analyze language-specific patterns and issues
 */
function analyzeLanguageSpecificIssues(languages, insights) {
  const langMap = new Map(languages);

  // JavaScript without TypeScript
  const hasJS = langMap.has('JavaScript');
  const hasTS = langMap.has('TypeScript');
  
  if (hasJS && !hasTS) {
    const jsStats = langMap.get('JavaScript');
    if (jsStats.percentage > 50) {
      insights.categories.codeQuality.push({
        id: 'typescript-migration',
        type: 'suggestion',
        severity: 'medium',
        title: 'Consider TypeScript Migration',
        description: 'Large JavaScript codebase could benefit from TypeScript for better type safety and developer experience.',
        suggestion: 'Gradual TypeScript migration starting with new files and critical modules.',
        tags: ['modernization', 'type-safety'],
        files: []
      });
    }
  }

  // Python version concerns
  if (langMap.has('Python')) {
    insights.categories.security.push({
      id: 'python-version',
      type: 'info',
      severity: 'low',
      title: 'Python Version Compatibility',
      description: 'Ensure Python version compatibility and security updates.',
      suggestion: 'Verify Python version requirements and keep dependencies updated.',
      tags: ['security', 'dependencies'],
      files: []
    });
  }

  // CSS without preprocessor
  const hasCSS = langMap.has('CSS');
  const hasSCSS = langMap.has('SCSS') || langMap.has('Less');
  
  if (hasCSS && !hasSCSS) {
    const cssStats = langMap.get('CSS');
    if (cssStats.lines > 2000) {
      insights.categories.maintainability.push({
        id: 'css-preprocessor',
        type: 'suggestion',
        severity: 'low',
        title: 'Consider CSS Preprocessor',
        description: 'Large CSS codebase could benefit from SCSS/Sass for better organization and maintainability.',
        suggestion: 'Migrate to SCSS or consider CSS-in-JS solutions for better maintainability.',
        tags: ['styling', 'organization'],
        files: []
      });
    }
  }
}

/**
 * Analyze file structure and organization
 */
async function analyzeFileStructure(fileIndex, insights) {
  const filesByDir = new Map();
  const filesByExt = new Map();
  
  // Group files by directory and extension
  fileIndex.forEach(file => {
    const dir = file.path.split('/').slice(0, -1).join('/') || 'root';
    const ext = file.path.split('.').pop() || 'no-ext';
    
    if (!filesByDir.has(dir)) filesByDir.set(dir, []);
    if (!filesByExt.has(ext)) filesByExt.set(ext, []);
    
    filesByDir.get(dir).push(file);
    filesByExt.get(ext).push(file);
  });

  // Check for common project files
  const hasReadme = fileIndex.some(f => f.path.toLowerCase().includes('readme'));
  const hasLicense = fileIndex.some(f => f.path.toLowerCase().includes('license'));
  const hasGitignore = fileIndex.some(f => f.path === '.gitignore');
  const hasPackageJson = fileIndex.some(f => f.path === 'package.json');
  const hasDockerfile = fileIndex.some(f => f.path.toLowerCase().includes('dockerfile'));

  // Documentation insights
  if (!hasReadme) {
    insights.categories.documentation.push({
      id: 'missing-readme',
      type: 'warning',
      severity: 'high',
      title: 'Missing README File',
      description: 'No README file found. This makes it difficult for contributors to understand the project.',
      suggestion: 'Create a comprehensive README.md with project description, setup instructions, and usage examples.',
      tags: ['documentation', 'onboarding'],
      files: []
    });
  }

  if (!hasLicense) {
    insights.categories.documentation.push({
      id: 'missing-license',
      type: 'suggestion',
      severity: 'medium',
      title: 'Missing License File',
      description: 'No license file found. This creates ambiguity about project usage rights.',
      suggestion: 'Add an appropriate license file (MIT, Apache 2.0, GPL, etc.) to clarify usage terms.',
      tags: ['legal', 'open-source'],
      files: []
    });
  }

  // Configuration insights
  if (!hasGitignore) {
    insights.categories.maintainability.push({
      id: 'missing-gitignore',
      type: 'warning',
      severity: 'medium',
      title: 'Missing .gitignore File',
      description: 'No .gitignore file found. This may lead to committing unwanted files.',
      suggestion: 'Create a .gitignore file appropriate for your technology stack.',
      tags: ['git', 'configuration'],
      files: []
    });
  }

  // Test file analysis
  const testFiles = fileIndex.filter(f => 
    f.path.includes('test') || 
    f.path.includes('spec') || 
    f.path.includes('__tests__') ||
    f.path.endsWith('.test.js') ||
    f.path.endsWith('.test.ts') ||
    f.path.endsWith('.spec.js') ||
    f.path.endsWith('.spec.ts')
  );

  if (testFiles.length === 0) {
    insights.categories.testing.push({
      id: 'no-tests',
      type: 'bug',
      severity: 'high',
      title: 'No Test Files Detected',
      description: 'No test files found in the repository. This increases the risk of bugs and makes refactoring dangerous.',
      suggestion: 'Implement unit tests and integration tests. Consider test-driven development (TDD) for new features.',
      tags: ['testing', 'quality'],
      files: []
    });
  } else if (testFiles.length < fileIndex.length * 0.1) {
    insights.categories.testing.push({
      id: 'low-test-coverage',
      type: 'warning',
      severity: 'high',
      title: 'Low Test Coverage',
      description: `Only ${testFiles.length} test files found for ${fileIndex.length} total files. This suggests low test coverage.`,
      suggestion: 'Increase test coverage by adding unit tests for critical components and business logic.',
      tags: ['testing', 'coverage'],
      files: []
    });
  }

  // Directory structure insights
  const rootFiles = filesByDir.get('root') || [];
  if (rootFiles.length > 15) {
    insights.categories.maintainability.push({
      id: 'cluttered-root',
      type: 'warning',
      severity: 'medium',
      title: 'Cluttered Root Directory',
      description: `${rootFiles.length} files in the root directory. This can make the project structure unclear.`,
      suggestion: 'Organize files into appropriate directories (src/, docs/, config/, etc.).',
      tags: ['organization', 'structure'],
      files: rootFiles.slice(0, 5).map(f => ({ path: f.path }))
    });
  }
}

/**
 * Generate AI-powered insights using QA agent
 */
async function generateAIInsights(analysis, userId) {
  try {
    // Load QA agent for quality analysis and insights
    const { AgentLoader } = await import('@/lib/bmad/AgentLoader.js');
    const agentLoader = new AgentLoader();
    await agentLoader.loadAllAgents();
    const qaAgent = await agentLoader.loadAgent('qa');

    if (!qaAgent) {
      logger.warn('QA agent not found, using default behavior');
    } else {
      logger.info(`Using QA agent: ${qaAgent.agent?.name} for repository insights`);
    }

    // Import AI service
    const { aiService } = await import('@/lib/ai/AIService.js');

    if (!aiService.initialized && userId) {
      try {
        await aiService.initialize(null, userId);
      } catch (initError) {
        logger.warn('AI service initialization failed - no API keys configured');
        return null;
      }
    }

    if (!aiService.initialized) {
      logger.info('AI service not initialized - no API keys configured, skipping AI insights');
      return null;
    }

    // Prepare context for AI analysis
    const context = {
      repository: analysis.fullName,
      summary: analysis.summary,
      metrics: analysis.metrics,
      topFiles: analysis.fileIndex ? analysis.fileIndex.slice(0, 20) : []
    };

    // Build prompt with QA agent persona
    let prompt = '';

    // Add QA agent persona if available
    if (qaAgent && qaAgent.persona) {
      prompt += `# AGENT PERSONA\n`;
      prompt += `You are ${qaAgent.agent?.name || 'Quinn'}, a ${qaAgent.agent?.title || 'Test Architect & Quality Advisor'}.\n\n`;

      if (qaAgent.persona.role) {
        prompt += `Role: ${qaAgent.persona.role}\n`;
      }
      if (qaAgent.persona.style) {
        prompt += `Communication Style: ${qaAgent.persona.style}\n`;
      }
      if (qaAgent.persona.identity) {
        prompt += `Identity: ${qaAgent.persona.identity}\n`;
      }
      if (qaAgent.persona.focus) {
        prompt += `Focus: ${qaAgent.persona.focus}\n`;
      }

      // Add core principles
      if (qaAgent.persona.core_principles && Array.isArray(qaAgent.persona.core_principles)) {
        prompt += `\nCore Principles:\n`;
        qaAgent.persona.core_principles.forEach(principle => {
          prompt += `- ${principle}\n`;
        });
      }

      prompt += `\n`;
    }

    prompt += `# TASK: Comprehensive Quality Analysis & Insights\n\n`;
    prompt += `Perform a thorough quality analysis of this repository and provide **8-12 actionable insights** in valid JSON format.\n\n`;

    prompt += `## Repository Information\n`;
    prompt += `Repository: ${context.repository}\n`;
    prompt += `Metrics: ${context.metrics?.fileCount || 0} files, ${context.metrics?.totalLines?.toLocaleString() || 0} lines, ${context.metrics?.languageCount || 0} languages\n\n`;

    prompt += `Top Files:\n`;
    prompt += `${context.topFiles.slice(0, 10).map(f => `${f.path} (${f.language})`).join('\n')}\n\n`;

    prompt += `## Analysis Requirements\n\n`;
    prompt += `Analyze ALL of the following areas and provide insights for each:\n\n`;
    prompt += `1. **Code Quality** (2-3 insights)\n`;
    prompt += `   - File size and complexity (large files >500 lines, extremely large >1000 lines)\n`;
    prompt += `   - Code organization and structure\n`;
    prompt += `   - Language-specific best practices (TypeScript vs JS, preprocessors, etc.)\n`;
    prompt += `   - Maintainability concerns\n\n`;

    prompt += `2. **Testing & Coverage** (2-3 insights)\n`;
    prompt += `   - Test file detection and coverage estimation\n`;
    prompt += `   - Testing framework usage\n`;
    prompt += `   - Missing test patterns\n\n`;

    prompt += `3. **Security** (1-2 insights)\n`;
    prompt += `   - Security vulnerabilities and risks\n`;
    prompt += `   - Dependency security concerns\n`;
    prompt += `   - Authentication/authorization patterns\n\n`;

    prompt += `4. **Performance** (1-2 insights)\n`;
    prompt += `   - Performance bottlenecks\n`;
    prompt += `   - Optimization opportunities\n`;
    prompt += `   - Resource usage patterns\n\n`;

    prompt += `5. **Documentation & Project Health** (2-3 insights)\n`;
    prompt += `   - Missing critical files (README, LICENSE, .gitignore)\n`;
    prompt += `   - Documentation quality\n`;
    prompt += `   - Project setup and onboarding\n\n`;

    prompt += `6. **Architecture & Maintainability** (1-2 insights)\n`;
    prompt += `   - Codebase size assessment (>100k lines = large, >50k = medium)\n`;
    prompt += `   - Language diversity (>6 languages = high diversity)\n`;
    prompt += `   - Directory structure and organization\n`;
    prompt += `   - Architectural patterns and decisions\n\n`;

    prompt += `## Output Format\n\n`;
    prompt += `Respond ONLY with a JSON array containing 8-12 insights. Each insight must have:\n`;
    prompt += `- category: one of ["security", "performance", "codeQuality", "maintainability", "testing"]\n`;
    prompt += `- severity: one of ["low", "medium", "high", "critical"]\n`;
    prompt += `- title: brief title (max 60 chars)\n`;
    prompt += `- description: detailed explanation (100-150 words)\n`;
    prompt += `- suggestion: specific actionable recommendation with concrete steps\n`;
    prompt += `- files: array of affected file paths (if applicable, max 3)\n\n`;

    prompt += `**Example format:**\n`;
    prompt += `[\n`;
    prompt += `  {\n`;
    prompt += `    "category": "security",\n`;
    prompt += `    "severity": "high",\n`;
    prompt += `    "title": "Missing Input Validation",\n`;
    prompt += `    "description": "The API endpoints lack proper input validation which could lead to injection attacks and data corruption. This is particularly critical in user-facing endpoints that handle sensitive data.",\n`;
    prompt += `    "suggestion": "Implement input validation using a library like Joi or Zod. Add schema validation for all API endpoints, especially those handling user input, file uploads, and database operations.",\n`;
    prompt += `    "files": ["src/api/users.js", "src/api/posts.js"]\n`;
    prompt += `  }\n`;
    prompt += `]\n\n`;

    prompt += `**CRITICAL:** \n`;
    prompt += `- Provide EXACTLY 8-12 insights (not fewer)\n`;
    prompt += `- Cover ALL 6 analysis areas mentioned above\n`;
    prompt += `- Be specific and actionable, not generic\n`;
    prompt += `- Reference actual files from the top files list when relevant\n`;
    prompt += `- Output ONLY valid JSON, no markdown code blocks, no explanations before or after\n`;
    prompt += `- Ensure the JSON is properly formatted and parseable`;

    const response = await aiService.call(prompt, qaAgent, 3, {
      action: 'repository_insights',
      repositoryId: analysis.repositoryId,
      maxTokens: 8000 // Increased for comprehensive insights (8-12 items)
    }, analysis.userId.toString());

    return parseAIInsights(response.content);

  } catch (error) {
    logger.error('Failed to generate AI insights:', error);
    return null;
  }
}

/**
 * Parse AI insights response into structured format
 */
function parseAIInsights(aiResponse) {
  if (!aiResponse) return [];

  try {
    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = aiResponse.trim();

    // Remove markdown code blocks (```json ... ```)
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

    // Try to find JSON array in the response
    const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('No JSON array found in AI insights response');
      return [];
    }

    const parsedInsights = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsedInsights)) {
      logger.warn('AI insights response is not an array');
      return [];
    }

    // Transform AI insights to match expected structure
    return parsedInsights.map((insight, index) => ({
      id: `ai-insight-${index}`,
      type: mapCategoryToType(insight.category),
      severity: insight.severity || 'medium',
      title: insight.title || 'AI-Generated Insight',
      description: insight.description || '',
      suggestion: insight.suggestion || '',
      tags: ['ai-generated', insight.category || 'general'],
      files: insight.files || [],
      source: 'ai',
      category: insight.category
    }));

  } catch (error) {
    logger.error('Failed to parse AI insights JSON:', error.message);
    logger.debug('AI Response:', aiResponse.substring(0, 500));
    return [];
  }
}

/**
 * Map category to insight type for UI display
 */
function mapCategoryToType(category) {
  const typeMap = {
    'security': 'bug',
    'performance': 'warning',
    'codeQuality': 'quality',
    'maintainability': 'suggestion',
    'testing': 'warning'
  };
  return typeMap[category] || 'info';
}

/**
 * Merge AI insights with existing insights
 */
function mergeAIInsights(insights, aiInsights) {
  if (!aiInsights || !Array.isArray(aiInsights)) return;

  // Distribute AI insights across categories based on their category field
  aiInsights.forEach(insight => {
    const category = insight.category || 'codeQuality';

    // Map to the correct category
    const categoryMap = {
      'security': 'security',
      'performance': 'performance',
      'codeQuality': 'codeQuality',
      'maintainability': 'maintainability',
      'testing': 'testing'
    };

    const targetCategory = categoryMap[category] || 'codeQuality';

    // Ensure the category array exists
    if (insights.categories[targetCategory]) {
      insights.categories[targetCategory].push(insight);
    } else {
      // Fallback to codeQuality if category doesn't exist
      insights.categories.codeQuality.push(insight);
    }
  });
}

/**
 * Calculate insights summary
 */
function calculateInsightsSummary(insights) {
  let critical = 0;
  let warnings = 0;
  let suggestions = 0;

  Object.values(insights.categories).forEach(category => {
    category.forEach(insight => {
      switch (insight.type) {
        case 'bug':
          critical++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'suggestion':
        case 'info':
          suggestions++;
          break;
      }
    });
  });

  return {
    total: critical + warnings + suggestions,
    critical,
    warnings,
    suggestions
  };
}