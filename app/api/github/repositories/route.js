/**
 * GitHub Repositories API
 * Provides endpoints for scanning and selecting GitHub repositories for BMAD workflows
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/github/repositories
 * List user's accessible repositories with workflow context information
 */
export async function GET(request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'owned', 'collaborated', 'all'
    const per_page = parseInt(searchParams.get('per_page') || '30');
    const page = parseInt(searchParams.get('page') || '1');
    const sort = searchParams.get('sort') || 'updated'; // 'created', 'updated', 'pushed', 'full_name'

    // Initialize Git Integration Service with user context
    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    // Get repositories from GitHub with rate limiting and proper error handling
    const cacheKey = `repositories-${type}-${page}-${per_page}-${sort}`;
    let repositories = [];
    
    try {
      const result = await gitService.githubPlugin.getRepositories({
        type,
        per_page,
        page,
        sort
      });
      
      // Ensure we have an array - handle different response formats
      repositories = Array.isArray(result) ? result : (result?.data || []);
      
    } catch (error) {
      logger.error('Failed to fetch repositories from GitHub:', error.message);

      // Try to get cached repositories as fallback
      const cachedResult = await gitService.githubPlugin.getFromCache(cacheKey, 'repositories');
      repositories = Array.isArray(cachedResult) ? cachedResult : [];

      // If no cache available, return empty array with error info
      if (repositories.length === 0) {
        return NextResponse.json({
          success: false,
          repositories: [],
          error: 'Failed to fetch repositories',
          message: error.message.includes('rate limit') 
            ? 'GitHub API rate limit exceeded. Please try again in a few minutes.'
            : 'Unable to fetch repositories at this time.',
          rateLimit: {
            remaining: gitService.githubPlugin.rateLimitInfo.remaining,
            limit: gitService.githubPlugin.rateLimitInfo.limit,
            reset: gitService.githubPlugin.rateLimitInfo.reset,
            enhanced: false
          }
        }, { status: error.message.includes('rate limit') ? 429 : 500 });
      }
    }

    // Enhanced mode - only fetch additional data if explicitly requested (saves API calls)
    const enhance = searchParams.get('enhance') === 'true';
    
    // Safety check - ensure repositories is an array before mapping
    if (!Array.isArray(repositories)) {
      logger.error('Repositories is not an array:', typeof repositories, repositories);
      return NextResponse.json({
        success: false,
        repositories: [],
        error: 'Invalid repository data format',
        message: 'Received invalid data from GitHub API'
      }, { status: 500 });
    }
    
    // Enhance repositories with workflow context information (rate-limited)
    const enhancedRepos = await Promise.all(
      repositories.map(async (repo) => {
        try {
          let hasBmadArtifacts = false;
          let languages = {};
          
          // Only perform expensive API calls if enhancement is requested
          if (enhance && gitService.githubPlugin.rateLimitInfo.remaining > 50) {
            // Check for existing BMAD artifacts (single API call)
            hasBmadArtifacts = await checkForBmadArtifacts(gitService, repo.owner.login, repo.name);
            
            // Get repository languages (single API call)  
            languages = await getRepositoryLanguages(gitService, repo.owner.login, repo.name);
          }
          
          // Determine repository type/framework (no API calls)
          const repoType = inferRepositoryType(repo.name, repo.description, languages);
          
          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            private: repo.private,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url,
              type: repo.owner.type
            },
            html_url: repo.html_url,
            clone_url: repo.clone_url,
            ssh_url: repo.ssh_url,
            default_branch: repo.default_branch,
            language: repo.language,
            languages: languages,
            repository_type: repoType,
            topics: repo.topics || [],
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            pushed_at: repo.pushed_at,
            size: repo.size,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            
            // BMAD-specific enhancements
            bmad_context: {
              has_existing_artifacts: hasBmadArtifacts,
              workflow_ready: !hasBmadArtifacts, // Prefer brownfield projects without existing BMAD artifacts
              suggested_workflow: suggestWorkflow(repoType, hasBmadArtifacts),
              estimated_complexity: estimateComplexity(repo.size, languages)
            }
          };
        } catch (error) {
          logger.warn(`Failed to enhance repository ${repo.full_name}: ${error.message}`);
          
          // Return basic repository info if enhancement fails
          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            private: repo.private,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url,
              type: repo.owner.type
            },
            html_url: repo.html_url,
            clone_url: repo.clone_url,
            default_branch: repo.default_branch,
            language: repo.language,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            
            // Default BMAD context
            bmad_context: {
              has_existing_artifacts: false,
              workflow_ready: true,
              suggested_workflow: 'brownfield-fullstack',
              estimated_complexity: 'medium'
            }
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      repositories: enhancedRepos,
      pagination: {
        page,
        per_page,
        total_count: repositories.length
      },
      rateLimit: {
        remaining: gitService.githubPlugin.rateLimitInfo.remaining,
        limit: gitService.githubPlugin.rateLimitInfo.limit,
        reset: gitService.githubPlugin.rateLimitInfo.reset,
        enhanced: enhance
      }
    });

  } catch (error) {
    logger.error('GitHub repositories API error:', error);
    
    // Handle specific rate limit errors
    if (error.status === 403 && error.message.includes('rate limit')) {
      return NextResponse.json({
        success: false,
        error: 'GitHub API rate limit exceeded',
        message: 'Please wait a few minutes before trying again. Consider using cached data.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((gitService?.githubPlugin?.rateLimitInfo?.reset - Date.now()) / 1000) || 3600
      }, { status: 429 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch repositories',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/github/repositories
 * Create a new repository optimized for BMAD workflows
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const {
      name,
      description,
      private: isPrivate = false,
      template = 'fullstack', // 'basic', 'fullstack', 'api', 'frontend'
      initialize_with_bmad = true
    } = await request.json();

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Repository name is required'
      }, { status: 400 });
    }

    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    // Create repository with BMAD-optimized setup
    const result = await gitService.setupWorkflowRepository({
      name,
      description: description || `BMAD-managed ${template} project`,
      private: isPrivate,
      template
    });

    logger.info(`✅ Created BMAD-ready repository: ${result.repoUrl}`);

    // Get the full repository data from the result
    const fullRepositoryData = result.repository || result;
    
    // Format the repository data to match the expected structure
    const repositoryData = {
      id: fullRepositoryData.id,
      name: fullRepositoryData.name,
      full_name: fullRepositoryData.full_name,
      description: fullRepositoryData.description,
      private: fullRepositoryData.private,
      html_url: fullRepositoryData.html_url,
      clone_url: fullRepositoryData.clone_url,
      ssh_url: fullRepositoryData.ssh_url,
      default_branch: fullRepositoryData.default_branch || 'main',
      language: fullRepositoryData.language,
      languages: {},
      repository_type: template === 'api' ? 'api' : template === 'frontend' ? 'frontend' : 'fullstack',
      topics: fullRepositoryData.topics || [],
      created_at: fullRepositoryData.created_at,
      updated_at: fullRepositoryData.updated_at,
      pushed_at: fullRepositoryData.pushed_at,
      size: fullRepositoryData.size || 0,
      stargazers_count: fullRepositoryData.stargazers_count || 0,
      forks_count: fullRepositoryData.forks_count || 0,
      owner: {
        login: fullRepositoryData.owner.login,
        avatar_url: fullRepositoryData.owner.avatar_url,
        type: fullRepositoryData.owner.type
      },
      bmad_context: {
        has_existing_artifacts: initialize_with_bmad,
        workflow_ready: true,
        suggested_workflow: template === 'api' ? 'brownfield-backend' : 
                          template === 'frontend' ? 'brownfield-frontend' : 
                          'brownfield-fullstack',
        estimated_complexity: 'low'
      }
    };

    return NextResponse.json({
      success: true,
      repository: repositoryData,
      message: 'Repository created successfully'
    });

  } catch (error) {
    logger.error('Create repository error:', error);
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (error.status === 422 || error.message.includes('already exists')) {
      statusCode = 422; // Unprocessable Entity
    } else if (error.status === 401 || error.message.includes('authentication')) {
      statusCode = 401; // Unauthorized
    } else if (error.status === 403 || error.message.includes('rate limit')) {
      statusCode = 429; // Too Many Requests
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create repository',
      message: error.message
    }, { status: statusCode });
  }
}

// ========== HELPER FUNCTIONS ==========

async function checkForBmadArtifacts(gitService, owner, repo) {
  try {
    // Use single API call to check repository contents instead of multiple calls
    const cacheKey = `bmad-artifacts-${owner}-${repo}`;
    
    const contents = await gitService.githubPlugin.makeRateLimitedRequest(
      async () => {
        return await gitService.githubPlugin.octokit.rest.repos.getContent({
          owner,
          repo,
          path: '',
        });
      },
      cacheKey,
      'contents'
    );

    // Check if any BMAD indicators exist in root directory
    const files = Array.isArray(contents) ? contents : [contents];
    const bmadIndicators = ['docs', '.bmad-core', 'prd.md', 'architecture.md'];
    
    return files.some(file => 
      bmadIndicators.some(indicator => 
        file.name.includes(indicator) || file.name.startsWith('.')
      )
    );
  } catch (error) {
    logger.debug(`Could not check BMAD artifacts for ${owner}/${repo}: ${error.message}`);
    return false; // Default to false on error to avoid blocking
  }
}

async function getRepositoryLanguages(gitService, owner, repo) {
  try {
    const cacheKey = `languages-${owner}-${repo}`;
    
    const languages = await gitService.githubPlugin.makeRateLimitedRequest(
      async () => {
        return await gitService.githubPlugin.octokit.rest.repos.listLanguages({
          owner,
          repo,
        });
      },
      cacheKey,
      'repository'
    );
    
    return languages || {};
  } catch (error) {
    logger.debug(`Could not get languages for ${owner}/${repo}: ${error.message}`);
    return {}; // Default to empty object on error to avoid blocking
  }
}

function inferRepositoryType(name, description, languages) {
  const nameAndDesc = `${name} ${description || ''}`.toLowerCase();
  const languageKeys = Object.keys(languages);
  
  // Check for specific frameworks/types
  if (nameAndDesc.includes('next') || nameAndDesc.includes('react')) return 'nextjs';
  if (nameAndDesc.includes('vue')) return 'vue';
  if (nameAndDesc.includes('angular')) return 'angular';
  if (nameAndDesc.includes('express') || nameAndDesc.includes('node')) return 'nodejs';
  if (nameAndDesc.includes('spring') || languageKeys.includes('Java')) return 'spring';
  if (nameAndDesc.includes('django') || nameAndDesc.includes('flask')) return 'python-web';
  if (nameAndDesc.includes('rails') || languageKeys.includes('Ruby')) return 'rails';
  if (nameAndDesc.includes('api') || nameAndDesc.includes('service')) return 'api';
  if (nameAndDesc.includes('frontend') || nameAndDesc.includes('ui')) return 'frontend';
  
  // Infer from primary language
  if (languageKeys.includes('TypeScript') || languageKeys.includes('JavaScript')) return 'web';
  if (languageKeys.includes('Python')) return 'python';
  if (languageKeys.includes('Java')) return 'java';
  if (languageKeys.includes('Go')) return 'go';
  if (languageKeys.includes('Rust')) return 'rust';
  if (languageKeys.includes('C#')) return 'dotnet';
  
  return 'generic';
}

function suggestWorkflow(repoType, hasBmadArtifacts) {
  if (hasBmadArtifacts) {
    return 'enhancement-only'; // Don't create new artifacts if they already exist
  }
  
  // Suggest workflow based on repository type
  const workflowMap = {
    'nextjs': 'brownfield-fullstack',
    'vue': 'brownfield-fullstack', 
    'angular': 'brownfield-fullstack',
    'nodejs': 'brownfield-backend',
    'spring': 'brownfield-backend',
    'python-web': 'brownfield-backend',
    'rails': 'brownfield-fullstack',
    'api': 'brownfield-api',
    'frontend': 'brownfield-frontend',
    'web': 'brownfield-fullstack',
    'python': 'brownfield-backend',
    'java': 'brownfield-backend',
    'go': 'brownfield-backend',
    'rust': 'brownfield-backend',
    'dotnet': 'brownfield-fullstack',
    'generic': 'brownfield-fullstack'
  };
  
  return workflowMap[repoType] || 'brownfield-fullstack';
}

function estimateComplexity(sizeKb, languages) {
  const languageCount = Object.keys(languages).length;
  
  if (sizeKb > 10000 || languageCount > 5) return 'high';
  if (sizeKb > 1000 || languageCount > 3) return 'medium';
  return 'low';
}