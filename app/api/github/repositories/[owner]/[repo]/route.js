/**
 * GitHub Repository Context API
 * Provides detailed context information for a specific repository
 * Used by workflow initialization to understand the target project
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import logger from '@/lib/utils/logger.js';

/**
 * GET /api/github/repositories/[owner]/[repo]
 * Get comprehensive repository context for workflow initialization
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { owner, repo } = await params;
    
    if (!owner || !repo) {
      return NextResponse.json({
        success: false,
        error: 'Owner and repository name are required'
      }, { status: 400 });
    }

    const gitService = new GitIntegrationService(session.user);
    await gitService.initialize();

    // Get comprehensive repository context
    const [repositoryInfo, repoContext, fileStructure, readme] = await Promise.all([
      getBasicRepositoryInfo(gitService, owner, repo),
      gitService.getRepositoryContext(owner, repo),
      getRepositoryStructure(gitService, owner, repo),
      getRepositoryReadme(gitService, owner, repo)
    ]);

    // Analyze existing documentation and artifacts
    const existingArtifacts = await analyzeExistingArtifacts(gitService, owner, repo);
    
    // Get recent activity and contributors
    const [recentCommits, contributors] = await Promise.all([
      getRecentCommits(gitService, owner, repo),
      getRepositoryContributors(gitService, owner, repo)
    ]);

    const repositoryContext = {
      // Basic repository information
      repository: repositoryInfo,
      
      // Git context (branches, releases)
      git: {
        branches: repoContext.branches,
        releases: repoContext.releases,
        default_branch: repositoryInfo.default_branch
      },
      
      // Project structure and files
      structure: fileStructure,
      
      // Documentation
      documentation: {
        readme: readme,
        existing_artifacts: existingArtifacts,
        has_docs_folder: fileStructure.some(item => item.path === 'docs' && item.type === 'dir')
      },
      
      // Development context
      development: {
        languages: repositoryInfo.languages || {},
        framework: inferFramework(fileStructure, repositoryInfo.languages),
        build_system: inferBuildSystem(fileStructure),
        package_managers: inferPackageManagers(fileStructure),
        testing_framework: inferTestingFramework(fileStructure)
      },
      
      // Activity and collaboration
      activity: {
        recent_commits: recentCommits,
        contributors: contributors,
        last_pushed: repositoryInfo.pushed_at,
        commit_frequency: calculateCommitFrequency(recentCommits)
      },
      
      // BMAD workflow recommendations
      bmad_analysis: {
        workflow_recommendation: recommendWorkflow(repositoryInfo, fileStructure, existingArtifacts),
        complexity_assessment: assessComplexity(repositoryInfo, fileStructure),
        enhancement_potential: assessEnhancementPotential(repositoryInfo, recentCommits),
        setup_requirements: getSetupRequirements(fileStructure),
        existing_bmad_artifacts: existingArtifacts.bmad_files.length > 0
      }
    };

    return NextResponse.json({
      success: true,
      context: repositoryContext
    });

  } catch (error) {
    logger.error(`Repository context API error for ${params?.owner}/${params?.repo}:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch repository context',
      message: error.message
    }, { status: 500 });
  }
}

// ========== HELPER FUNCTIONS ==========

async function getBasicRepositoryInfo(gitService, owner, repo) {
  try {
    // Use Octokit for better error handling and type safety
    const { data: repoData } = await gitService.githubPlugin.octokit.rest.repos.get({
      owner,
      repo
    });
    
    // Also get languages
    let languages = {};
    try {
      const { data: languagesData } = await gitService.githubPlugin.octokit.rest.repos.listLanguages({
        owner,
        repo
      });
      languages = languagesData;
    } catch (languagesError) {
      logger.debug(`Could not get languages for ${owner}/${repo}: ${languagesError.message}`);
    }
    
    return {
      ...repoData,
      languages
    };
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
    }
    throw error;
  }
}

async function getRepositoryStructure(gitService, owner, repo, path = '', maxDepth = 2, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];
  
  try {
    const response = await gitService.githubPlugin.makeAuthenticatedRequest(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    );
    
    if (!response.ok) return [];
    
    const contents = await response.json();
    const structure = [];
    
    for (const item of contents) {
      const structureItem = {
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size || 0
      };
      
      // For directories, recursively get contents (up to maxDepth)
      if (item.type === 'dir' && currentDepth < maxDepth - 1) {
        const subItems = await getRepositoryStructure(
          gitService, 
          owner, 
          repo, 
          item.path, 
          maxDepth, 
          currentDepth + 1
        );
        structureItem.children = subItems;
      }
      
      structure.push(structureItem);
    }
    
    return structure;
  } catch (error) {
    logger.debug(`Could not get repository structure for ${owner}/${repo}:${path} - ${error.message}`);
    return [];
  }
}

async function getRepositoryReadme(gitService, owner, repo) {
  const readmeFiles = ['README.md', 'README.rst', 'README.txt', 'readme.md', 'Readme.md'];
  
  for (const readmeFile of readmeFiles) {
    try {
      const response = await gitService.githubPlugin.makeAuthenticatedRequest(
        `https://api.github.com/repos/${owner}/${repo}/contents/${readmeFile}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return {
          filename: readmeFile,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
          size: data.size,
          path: data.path
        };
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

async function analyzeExistingArtifacts(gitService, owner, repo) {
  const artifactPaths = {
    bmad_files: [
      'docs/prd.md',
      'docs/architecture.md',
      'docs/brownfield-analysis.md',
      'docs/project-brief.md',
      '.bmad-core/',
      'docs/stories/'
    ],
    documentation: [
      'docs/',
      'documentation/',
      'wiki/',
      'CHANGELOG.md',
      'API.md',
      'CONTRIBUTING.md'
    ],
    config_files: [
      'package.json',
      'requirements.txt',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      'composer.json',
      'Gemfile',
      'go.mod'
    ]
  };
  
  const existingArtifacts = {
    bmad_files: [],
    documentation: [],
    config_files: []
  };
  
  for (const [category, paths] of Object.entries(artifactPaths)) {
    for (const path of paths) {
      try {
        const response = await gitService.githubPlugin.makeAuthenticatedRequest(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
        );
        
        if (response.ok) {
          const data = await response.json();
          existingArtifacts[category].push({
            path,
            type: data.type || 'file',
            size: data.size || 0,
            found: true
          });
        }
      } catch (error) {
        // Path doesn't exist, continue
        continue;
      }
    }
  }
  
  return existingArtifacts;
}

async function getRecentCommits(gitService, owner, repo, count = 10) {
  try {
    const response = await gitService.githubPlugin.makeAuthenticatedRequest(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${count}`
    );
    
    if (response.ok) {
      const commits = await response.json();
      return commits.map(commit => ({
        sha: commit.sha.substring(0, 7),
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url
      }));
    }
    
    return [];
  } catch (error) {
    logger.debug(`Could not get commits for ${owner}/${repo}: ${error.message}`);
    return [];
  }
}

async function getRepositoryContributors(gitService, owner, repo) {
  try {
    const response = await gitService.githubPlugin.makeAuthenticatedRequest(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`
    );
    
    if (response.ok) {
      const contributors = await response.json();
      return contributors.map(contributor => ({
        login: contributor.login,
        contributions: contributor.contributions,
        avatar_url: contributor.avatar_url,
        profile_url: contributor.html_url
      }));
    }
    
    return [];
  } catch (error) {
    return [];
  }
}

function inferFramework(fileStructure, languages) {
  const files = flattenFileStructure(fileStructure);
  const filenames = files.map(f => f.name.toLowerCase());
  
  // Check for specific framework files
  if (filenames.includes('next.config.js') || filenames.includes('next.config.ts')) return 'Next.js';
  if (filenames.includes('nuxt.config.js') || filenames.includes('nuxt.config.ts')) return 'Nuxt.js';
  if (filenames.includes('vue.config.js') || filenames.includes('vite.config.js')) return 'Vue.js';
  if (filenames.includes('angular.json')) return 'Angular';
  if (filenames.includes('ember-cli-build.js')) return 'Ember.js';
  if (filenames.includes('svelte.config.js')) return 'Svelte';
  if (filenames.includes('gatsby-config.js')) return 'Gatsby';
  if (filenames.includes('astro.config.js')) return 'Astro';
  
  // Check for backend frameworks
  if (filenames.includes('manage.py')) return 'Django';
  if (filenames.includes('app.py') || filenames.includes('main.py')) return 'Flask/FastAPI';
  if (filenames.includes('spring-boot-starter') || languages.Java) return 'Spring Boot';
  if (filenames.includes('gemfile') || languages.Ruby) return 'Ruby on Rails';
  if (filenames.includes('main.go') || languages.Go) return 'Go';
  if (filenames.includes('cargo.toml') || languages.Rust) return 'Rust';
  
  // Check for JavaScript/TypeScript projects
  if (languages.JavaScript || languages.TypeScript) {
    if (filenames.some(f => f.includes('react'))) return 'React';
    if (filenames.some(f => f.includes('express'))) return 'Express.js';
    return 'JavaScript/TypeScript';
  }
  
  return 'Unknown';
}

function inferBuildSystem(fileStructure) {
  const files = flattenFileStructure(fileStructure);
  const filenames = files.map(f => f.name.toLowerCase());
  
  if (filenames.includes('webpack.config.js')) return 'Webpack';
  if (filenames.includes('vite.config.js')) return 'Vite';
  if (filenames.includes('rollup.config.js')) return 'Rollup';
  if (filenames.includes('gulpfile.js')) return 'Gulp';
  if (filenames.includes('gruntfile.js')) return 'Grunt';
  if (filenames.includes('makefile')) return 'Make';
  if (filenames.includes('build.gradle') || filenames.includes('build.gradle.kts')) return 'Gradle';
  if (filenames.includes('pom.xml')) return 'Maven';
  if (filenames.includes('cargo.toml')) return 'Cargo';
  
  return 'Unknown';
}

function inferPackageManagers(fileStructure) {
  const files = flattenFileStructure(fileStructure);
  const filenames = files.map(f => f.name.toLowerCase());
  const managers = [];
  
  if (filenames.includes('package.json')) {
    if (filenames.includes('yarn.lock')) managers.push('Yarn');
    else if (filenames.includes('pnpm-lock.yaml')) managers.push('pnpm');
    else managers.push('npm');
  }
  if (filenames.includes('requirements.txt') || filenames.includes('pyproject.toml')) managers.push('pip');
  if (filenames.includes('gemfile')) managers.push('Bundler');
  if (filenames.includes('composer.json')) managers.push('Composer');
  if (filenames.includes('cargo.toml')) managers.push('Cargo');
  if (filenames.includes('go.mod')) managers.push('Go Modules');
  
  return managers;
}

function inferTestingFramework(fileStructure) {
  const files = flattenFileStructure(fileStructure);
  const paths = files.map(f => f.path.toLowerCase());
  const filenames = files.map(f => f.name.toLowerCase());
  
  if (filenames.includes('jest.config.js') || paths.some(p => p.includes('__tests__'))) return 'Jest';
  if (filenames.includes('mocha.opts') || filenames.includes('.mocharc.js')) return 'Mocha';
  if (filenames.includes('cypress.json') || paths.some(p => p.includes('cypress'))) return 'Cypress';
  if (filenames.includes('pytest.ini') || paths.some(p => p.includes('test_'))) return 'pytest';
  if (filenames.includes('phpunit.xml')) return 'PHPUnit';
  if (paths.some(p => p.includes('test') || p.includes('spec'))) return 'Generic Testing';
  
  return 'Unknown';
}

function flattenFileStructure(structure, result = []) {
  for (const item of structure) {
    result.push(item);
    if (item.children) {
      flattenFileStructure(item.children, result);
    }
  }
  return result;
}

function recommendWorkflow(repoInfo, fileStructure, existingArtifacts) {
  // If BMAD artifacts already exist, suggest enhancement workflow
  if (existingArtifacts.bmad_files.length > 0) {
    return {
      type: 'enhancement',
      template: 'existing-bmad-project',
      reason: 'Repository already contains BMAD artifacts'
    };
  }
  
  const framework = inferFramework(fileStructure, repoInfo.languages);
  const languages = Object.keys(repoInfo.languages || {});
  
  // Recommend based on project type
  if (framework.includes('Next.js') || framework.includes('React') || framework.includes('Vue') || framework.includes('Angular')) {
    return {
      type: 'brownfield',
      template: 'brownfield-fullstack',
      reason: `Detected ${framework} full-stack application`
    };
  }
  
  if (framework.includes('Express') || framework.includes('Django') || framework.includes('Spring') || framework.includes('Rails')) {
    return {
      type: 'brownfield',
      template: 'brownfield-backend',
      reason: `Detected ${framework} backend service`
    };
  }
  
  if (languages.includes('JavaScript') || languages.includes('TypeScript')) {
    return {
      type: 'brownfield',
      template: 'brownfield-fullstack',
      reason: 'JavaScript/TypeScript project detected'
    };
  }
  
  return {
    type: 'brownfield',
    template: 'brownfield-fullstack',
    reason: 'Generic brownfield project'
  };
}

function assessComplexity(repoInfo, fileStructure) {
  const files = flattenFileStructure(fileStructure);
  const fileCount = files.length;
  const languageCount = Object.keys(repoInfo.languages || {}).length;
  const repoSize = repoInfo.size || 0; // in KB
  
  let score = 0;
  
  // File count factor
  if (fileCount > 500) score += 3;
  else if (fileCount > 100) score += 2;
  else if (fileCount > 20) score += 1;
  
  // Language diversity factor
  if (languageCount > 5) score += 3;
  else if (languageCount > 3) score += 2;
  else if (languageCount > 1) score += 1;
  
  // Repository size factor
  if (repoSize > 50000) score += 3; // > 50MB
  else if (repoSize > 10000) score += 2; // > 10MB
  else if (repoSize > 1000) score += 1; // > 1MB
  
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function assessEnhancementPotential(repoInfo, recentCommits) {
  const daysSinceLastCommit = recentCommits.length > 0 
    ? Math.floor((Date.now() - new Date(recentCommits[0].date)) / (1000 * 60 * 60 * 24))
    : 999;
  
  const commitFrequency = calculateCommitFrequency(recentCommits);
  
  if (daysSinceLastCommit < 7 && commitFrequency === 'high') return 'high';
  if (daysSinceLastCommit < 30 && commitFrequency !== 'low') return 'medium';
  return 'low';
}

function getSetupRequirements(fileStructure) {
  const files = flattenFileStructure(fileStructure);
  const filenames = files.map(f => f.name.toLowerCase());
  const requirements = [];
  
  if (filenames.includes('package.json')) requirements.push('Node.js and npm/yarn');
  if (filenames.includes('requirements.txt')) requirements.push('Python and pip');
  if (filenames.includes('gemfile')) requirements.push('Ruby and Bundler');
  if (filenames.includes('composer.json')) requirements.push('PHP and Composer');
  if (filenames.includes('cargo.toml')) requirements.push('Rust and Cargo');
  if (filenames.includes('go.mod')) requirements.push('Go');
  if (filenames.includes('pom.xml')) requirements.push('Java and Maven');
  if (filenames.includes('build.gradle')) requirements.push('Java and Gradle');
  
  return requirements;
}

function calculateCommitFrequency(commits) {
  if (commits.length < 2) return 'low';
  
  const dates = commits.map(c => new Date(c.date));
  const daySpan = Math.floor((dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24)) || 1;
  const commitsPerDay = commits.length / daySpan;
  
  if (commitsPerDay >= 1) return 'high';
  if (commitsPerDay >= 0.5) return 'medium';
  return 'low';
}