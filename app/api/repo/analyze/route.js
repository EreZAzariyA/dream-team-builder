
/**
 * Repository Analysis API - Analyze Route
 * Starts analysis of a GitHub repository
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import { GitIntegrationService } from '@/lib/integrations/GitIntegrationService.js';
import RepoAnalysis from '@/lib/database/models/RepoAnalysis.js';
import { connectMongoose } from '@/lib/database/mongodb.js';
import logger from '@/lib/utils/logger.js';
import { generateAISummary } from '@/lib/ai/summarizer.js';
import { PusherService } from '@/lib/bmad/orchestration/PusherService.js';

/**
 * POST /api/repo/analyze
 * Start repository analysis
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
    const { owner, name, repositoryId, branch = 'main', options = {}, forceRestart = false } = body;

    // Validate required fields
    if (!owner || !name || !repositoryId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: owner, name, repositoryId'
      }, { status: 400 });
    }

    // Check if analysis already exists and is recent (unless forcing restart)
    const existingAnalysis = !forceRestart ? await RepoAnalysis.findOne({
      $or: [
        { repositoryId },
        { owner, name, userId: session.user.id }
      ]
    }).sort({ createdAt: -1 }) : null;

    if (existingAnalysis && !forceRestart) {
      const analysisAge = Date.now() - new Date(existingAnalysis.createdAt).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      // If analysis is completed and recent, return it
      if (existingAnalysis.status === 'completed' && analysisAge < maxAge) {
        logger.info(`Using existing completed analysis for ${owner}/${name}`);
        return NextResponse.json({
          success: true,
          analysisId: existingAnalysis._id.toString(),
          status: 'completed',
          cached: true,
          analysis: existingAnalysis
        });
      }
      
      // If analysis is still processing, check if it's actually stuck
      if (existingAnalysis.status === 'processing' || existingAnalysis.status === 'pending') {
        const processingAge = Date.now() - new Date(existingAnalysis.updatedAt || existingAnalysis.createdAt).getTime();
        const maxProcessingTime = 10 * 60 * 1000; // 10 minutes max processing time
        
        if (processingAge < maxProcessingTime) {
          logger.info(`Found existing analysis in progress for ${owner}/${name} (${Math.round(processingAge / 1000)}s old)`);
          return NextResponse.json({
            success: true,
            analysisId: existingAnalysis._id.toString(),
            status: existingAnalysis.status,
            message: 'Analysis already in progress'
          });
        } else {
          logger.info(`Found stuck analysis for ${owner}/${name} (${Math.round(processingAge / 1000)}s old), marking as failed and creating new one`);
          // Mark stuck analysis as failed
          await existingAnalysis.markAsFailed('Analysis timed out after 10 minutes');
          // Continue to create new analysis
        }
      }
      
      // If analysis failed or is old, we'll create a new one
      const shouldCreateNew = existingAnalysis.status === 'failed' || 
                             analysisAge >= maxAge || 
                             existingAnalysis.status === 'processing' || 
                             existingAnalysis.status === 'pending';
                             
      if (shouldCreateNew) {
        logger.info(`Creating new analysis for ${owner}/${name} - reason: ${existingAnalysis.status} status or ${Math.round(analysisAge / 1000 / 60)} minutes old`);
      } else {
        // This should not happen, but if it does, create new analysis anyway
        logger.warn(`Unexpected condition - creating new analysis anyway for ${owner}/${name}`);
      }
    }

    // Create new analysis record
    const analysisData = {
      repositoryId,
      owner,
      name,
      fullName: `${owner}/${name}`,
      branch,
      userId: session.user.id,
      status: 'pending',
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB
      maxFiles: options.maxFiles || 10000,
      includeTests: options.includeTests !== false,
      includeDocs: options.includeDocs || false
    };

    const analysis = new RepoAnalysis(analysisData);
    await analysis.save();

    // Start background analysis (don't await - let it run async)
    performRepositoryAnalysis(analysis._id.toString(), session.user)
      .catch(error => {
        logger.error('Background analysis failed:', error);
        // Mark analysis as failed in database
        RepoAnalysis.findById(analysis._id)
          .then(doc => {
            if (doc) {
              doc.markAsFailed(error.message, { 
                stack: error.stack,
                timestamp: new Date()
              });
            }
          })
          .catch(err => logger.error('Failed to mark analysis as failed:', err));
      });

    logger.info(`Started analysis for repository ${owner}/${name}`);

    return NextResponse.json({
      success: true,
      analysisId: analysis._id.toString(),
      status: 'pending',
      message: 'Analysis started'
    });

  } catch (error) {
    logger.error('Repository analysis error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start repository analysis',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Background analysis function
 */
async function performRepositoryAnalysis(analysisId, user) {
  const startTime = Date.now();
  logger.info(`Starting background analysis: ${analysisId}`);
  
  // Initialize Pusher for real-time updates
  const pusherService = new PusherService();
  const channelName = `repo-analysis-${analysisId}`;

  try {
    // Get analysis record
    const analysis = await RepoAnalysis.findById(analysisId);
    if (!analysis) {
      throw new Error('Analysis record not found');
    }

    // Mark as analyzing and send initial update
    await analysis.markAsAnalyzing();
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'initializing',
      message: `Starting analysis of ${analysis.fullName}...`,
      progress: 0
    });

    // Initialize Git service
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'git-setup',
      message: 'Connecting to GitHub...',
      progress: 10
    });
    
    const gitService = new GitIntegrationService(user);
    await gitService.initialize();

    // Step 1: Get repository structure
    logger.info(`Fetching repository structure for ${analysis.fullName}`);
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'repo-structure',
      message: 'Fetching repository structure...',
      progress: 20
    });
    
    const repoStructure = await gitService.githubPlugin.getRepositoryContents(
      analysis.owner,
      analysis.name,
      analysis.branch
    );
    
    logger.info(`📁 Repository structure fetched: ${repoStructure?.length || 0} items`);
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'repo-structure-complete',
      message: `Found ${repoStructure?.length || 0} items in repository`,
      progress: 30
    });

    // Step 2: Build file index
    logger.info(`Building file index for ${analysis.fullName}`);
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'file-indexing',
      message: 'Building file index and reading code...',
      progress: 40
    });
    
    const fileIndex = await buildFileIndex(
      gitService,
      analysis.owner,
      analysis.name,
      analysis.branch,
      {
        maxFileSize: analysis.maxFileSize,
        maxFiles: analysis.maxFiles,
        includeTests: analysis.includeTests,
        includeDocs: analysis.includeDocs
      },
      // Add progress callback for file processing
      (processed, total) => {
        const fileProgress = 40 + (processed / total) * 30; // 40-70%
        pusherService.trigger(channelName, 'analysis-progress', {
          step: 'file-processing',
          message: `Processing files: ${processed}/${total}`,
          progress: Math.round(fileProgress)
        });
      },
      // Add file status callback for individual file updates
      (filePath, status) => {
        pusherService.trigger(channelName, 'file-status', {
          step: 'file-processing',
          file: filePath,
          message: `File ${filePath} ${status}`,
          status: status
        });
      }
    );

    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'file-index-complete',
      message: `Processed ${fileIndex.length} files`,
      progress: 70
    });

    // Step 3: Calculate metrics
    logger.info(`Calculating metrics for ${analysis.fullName}`);
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'metrics',
      message: 'Calculating code metrics...',
      progress: 75
    });
    
    const metrics = calculateMetrics(fileIndex);

    // Step 4: Generate AI summary
    logger.info(`Generating AI summary for ${analysis.fullName}`);
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'ai-summary',
      message: 'Generating AI insights and summary...',
      progress: 85
    });
    
    const summaryResult = await generateAISummary(analysis, fileIndex, metrics, user.id);

    // Log AI summary result
    if (summaryResult.success) {
      logger.info(`✅ AI summary generated successfully using ${summaryResult.provider}`);
    } else {
      logger.error(`❌ AI summary failed: ${summaryResult.error}`);
    }

    // Step 5: Save results
    await pusherService.trigger(channelName, 'analysis-progress', {
      step: 'saving',
      message: 'Saving analysis results...',
      progress: 95
    });

    const duration = Date.now() - startTime;
    await analysis.markAsCompleted({
      summary: summaryResult.success ? summaryResult.content : null, // Only save if successful
      metrics,
      fileIndex: fileIndex.slice(0, 1000), // Limit stored file index
      duration
    });

    // Final completion update
    await pusherService.trigger(channelName, 'analysis-complete', {
      step: 'completed',
      message: `Analysis completed in ${Math.round(duration / 1000)}s`,
      progress: 100,
      duration,
      metrics: {
        files: fileIndex.length,
        lines: metrics.totalLines,
        size: metrics.totalSize
      }
    });

    logger.info(`Completed analysis for ${analysis.fullName} in ${duration}ms`);

  } catch (error) {
    logger.error(`Analysis failed for ${analysisId}:`, error);
    
    // Send error update
    await pusherService.trigger(channelName, 'analysis-error', {
      step: 'error',
      message: `Analysis failed: ${error.message}`,
      error: error.message,
      progress: -1
    });
    
    // Mark as failed
    const analysis = await RepoAnalysis.findById(analysisId);
    if (analysis) {
      await analysis.markAsFailed(error.message, {
        stack: error.stack,
        timestamp: new Date(),
        duration: Date.now() - startTime
      });
    }
    
    throw error;
  }
}

/**
 * Build comprehensive file index
 */
async function buildFileIndex(gitService, owner, name, branch, options, progressCallback = null, fileStatusCallback = null) {
  const fileIndex = [];
  const { maxFileSize, maxFiles, includeTests, includeDocs } = options;

  try {
    // Get all files recursively
    const files = await gitService.githubPlugin.getRepositoryContents(owner, name, branch);

    logger.info(`🔍 Starting to process ${files?.length || 0} files from repository structure`);

    const totalFiles = files?.length || 0;

    // Filter files first (skip, size checks, etc.)
    const filesToProcess = files
      .slice(0, maxFiles) // Limit total files
      .filter(file => {
        // Skip large files
        if (file.size > maxFileSize) {
          logger.info(`⏭️  Skipping large file: ${file.path} (${file.size} > ${maxFileSize})`);
          fileStatusCallback?.(file.path, 'skipped (too large)');
          return false;
        }

        // Skip binary files and unwanted directories
        if (shouldSkipFile(file.path, { includeTests, includeDocs })) {
          logger.info(`⏭️  Skipping file due to skip pattern: ${file.path}`);
          fileStatusCallback?.(file.path, 'skipped (excluded pattern)');
          return false;
        }

        return true;
      });

    logger.info(`📋 Processing ${filesToProcess.length} files after filtering`);

    // Process files in parallel batches (10 at a time to avoid rate limits)
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      batches.push(filesToProcess.slice(i, i + BATCH_SIZE));
    }

    let processedFiles = 0;

    for (const batch of batches) {
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const language = getLanguageFromPath(file.path);
          const extension = getFileExtension(file.path);
          const isText = isTextFile(extension);
          const sizeOk = file.size < maxFileSize;

          let lines = 0;

          if (sizeOk && isText) {
            try {
              const content = await gitService.githubPlugin.getFileContent(
                owner, name, file.path, branch
              );

              if (content) {
                lines = countLines(content);
                logger.info(`✅ Processed ${file.path}: ${lines} lines`);
                fileStatusCallback?.(file.path, `processed (${lines} lines)`);
              } else {
                fileStatusCallback?.(file.path, 'processed (empty content)');
              }
            } catch (error) {
              logger.error(`❌ Failed to read ${file.path}: ${error.message}`);
              fileStatusCallback?.(file.path, `failed (${error.message})`);
              // Estimate lines based on size
              if (file.size > 0) {
                lines = Math.max(1, Math.floor(file.size / 80));
              }
            }
          } else if (file.size >= maxFileSize) {
            // For large files, estimate lines
            lines = Math.max(1, Math.floor(file.size / 80));
            fileStatusCallback?.(file.path, `estimated (${lines} lines, large file)`);
          }

          return {
            path: file.path,
            language,
            extension,
            size: file.size || 0,
            lines,
            sha: file.sha,
            lastModified: new Date()
          };
        })
      );

      // Add batch results to fileIndex
      fileIndex.push(...batchResults);
      processedFiles += batchResults.length;

      // Send progress update
      if (progressCallback) {
        progressCallback(processedFiles, filesToProcess.length);
      }

      logger.info(`📊 Batch complete: ${processedFiles}/${filesToProcess.length} files processed`);
    }

    const totalLines = fileIndex.reduce((sum, file) => sum + (file.lines || 0), 0);
    const totalSize = fileIndex.reduce((sum, file) => sum + (file.size || 0), 0);
    
    logger.info(`📋 Built file index: ${fileIndex.length} files, ${totalLines.toLocaleString()} lines, ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
    return fileIndex;

  } catch (error) {
    logger.error('Failed to build file index:', error);
    throw error;
  }
}

/**
 * Calculate repository metrics from file index
 */
function calculateMetrics(fileIndex) {
  const metrics = {
    fileCount: fileIndex.length,
    totalLines: 0,
    totalSize: 0,
    languageCount: 0,
    languages: new Map(),
    largestFiles: []
  };

  // Language statistics
  const languageStats = new Map();

  for (const file of fileIndex) {
    metrics.totalLines += file.lines || 0;
    metrics.totalSize += file.size || 0;

    // Language statistics
    if (file.language) {
      if (!languageStats.has(file.language)) {
        languageStats.set(file.language, {
          lines: 0,
          files: 0,
          percentage: 0
        });
      }
      
      const stats = languageStats.get(file.language);
      stats.lines += file.lines || 0;
      stats.files += 1;
    }
  }

  // Calculate language percentages
  for (const [language, stats] of languageStats) {
    stats.percentage = metrics.totalLines > 0 ? 
      (stats.lines / metrics.totalLines) * 100 : 0;
  }

  metrics.languages = languageStats;
  metrics.languageCount = languageStats.size;

  // Find largest files
  metrics.largestFiles = fileIndex
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, 20);

  return metrics;
}

/**
 * Helper functions
 */
function shouldSkipFile(path, options) {
  const skipPatterns = [
    /package-lock\.json$/,
    /node_modules\//,
    /\.git\//,
    /\.next\//,
    /dist\//,
    /build\//,
    /coverage\//,
    /\.nyc_output\//,
    /vendor\//,
    /\.venv\//,
    /__pycache__\//,
    /\.pytest_cache\//,
    /target\// // Rust/Java
  ];

  if (!options.includeTests) {
    skipPatterns.push(
      /test\//,
      /tests\//,
      /spec\//,
      /\.test\./,
      /\.spec\./,
      /__tests__\//
    );
  }

  if (!options.includeDocs) {
    skipPatterns.push(
      /docs\//,
      /documentation\//,
      /\.md$/,
      /\.rst$/,
      /\.txt$/
    );
  }

  return skipPatterns.some(pattern => pattern.test(path));
}

function getLanguageFromPath(path) {
  const extension = getFileExtension(path);
  const languageMap = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.cpp': 'C++',
    '.c': 'C',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.scala': 'Scala',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.less': 'Less',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    '.json': 'JSON',
    '.xml': 'XML',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.md': 'Markdown',
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.sql': 'SQL'
  };

  return languageMap[extension] || 'Unknown';
}

function getFileExtension(path) {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.substring(lastDot);
}

function isTextFile(extension) {
  const textExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs',
    '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.scala',
    '.html', '.css', '.scss', '.less', '.vue', '.svelte',
    '.json', '.xml', '.yaml', '.yml', '.md', '.txt', '.sh', '.bash', '.sql'
  ];
  return textExtensions.includes(extension);
}

function countLines(content) {
  if (!content) return 0;
  return content.split('\n').length;
}

// Export for use by workflow launch
export { performRepositoryAnalysis };