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

/**
 * POST /api/repo/insights
 * Generate repository insights and suggestions
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
    const { analysisId, repositoryId } = body;

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

    // Generate insights
    const insights = await generateRepositoryInsights(analysis, session.user.id);

    return NextResponse.json({
      success: true,
      insights
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
 * Generate comprehensive repository insights
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

  // Basic metrics analysis
  if (analysis.metrics) {
    await analyzeCodeMetrics(analysis.metrics, insights);
  }

  // File structure analysis
  if (analysis.fileIndex) {
    await analyzeFileStructure(analysis.fileIndex, insights);
  }

  // Generate AI-powered insights if available
  try {
    const aiInsights = await generateAIInsights(analysis, userId);
    if (aiInsights) {
      mergeAIInsights(insights, aiInsights);
    }
  } catch (error) {
    logger.warn('Failed to generate AI insights:', error.message);
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
 * Generate AI-powered insights
 */
async function generateAIInsights(analysis, userId) {
  try {
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

    const prompt = `As a senior software architect, analyze this repository and provide specific insights:

Repository: ${context.repository}
Summary: ${context.summary || 'No summary available'}

Key Metrics:
- Files: ${context.metrics?.fileCount || 0}
- Lines: ${context.metrics?.totalLines?.toLocaleString() || 0}
- Languages: ${context.metrics?.languageCount || 0}

Top Files:
${context.topFiles.map(f => `- ${f.path} (${f.language}, ${f.lines} lines)`).join('\n')}

Provide insights in the following areas:
1. Architecture and Design Patterns
2. Code Organization and Structure
3. Potential Performance Issues
4. Security Considerations
5. Best Practices Recommendations

Focus on actionable insights and specific recommendations. Be concise but thorough.`;

    const response = await aiService.call(prompt, null, 1, {
      action: 'repository_insights',
      repositoryId: analysis.repositoryId
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
  // This is a simplified parser - in a real implementation,
  // you might use more sophisticated NLP or structured AI responses
  const insights = [];
  
  if (aiResponse) {
    // Look for common patterns in AI response
    const sections = aiResponse.split(/\n\d+\./);
    
    sections.forEach((section, index) => {
      if (section.trim() && section.length > 50) {
        const title = section.split('\n')[0].trim();
        const content = section.substring(title.length).trim();
        
        if (title && content) {
          insights.push({
            id: `ai-insight-${index}`,
            type: 'suggestion',
            severity: 'medium',
            title: title.replace(/^[\d\.\s-]+/, '').trim(),
            description: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            suggestion: content,
            tags: ['ai-generated', 'architecture'],
            source: 'ai'
          });
        }
      }
    });
  }
  
  return insights;
}

/**
 * Merge AI insights with existing insights
 */
function mergeAIInsights(insights, aiInsights) {
  if (aiInsights && Array.isArray(aiInsights)) {
    // Distribute AI insights across categories
    aiInsights.forEach(insight => {
      // Categorize based on content keywords
      if (insight.description.toLowerCase().includes('security')) {
        insights.categories.security.push(insight);
      } else if (insight.description.toLowerCase().includes('performance')) {
        insights.categories.performance.push(insight);
      } else if (insight.description.toLowerCase().includes('test')) {
        insights.categories.testing.push(insight);
      } else {
        insights.categories.codeQuality.push(insight);
      }
    });
  }
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