/**
 * GitHub Context Utilities
 * 
 * Shared utilities for GitHub repository context restoration and management
 */

// Import logger with fallback to console
let logger;
try {
  // Try importing as ES6 module first
  const loggerModule = require('../../utils/logger.js');
  logger = loggerModule.default || loggerModule;
} catch (e) {
  // Fallback logger with console methods
  logger = {
    info: (...args) => console.log('[GitHubContextUtils]', ...args),
    warn: (...args) => console.warn('[GitHubContextUtils]', ...args),
    error: (...args) => console.error('[GitHubContextUtils]', ...args)
  };
}

/**
 * Restores GitHub repository context from database workflow metadata
 * @param {Object} dbWorkflow - Database workflow object containing metadata
 * @param {Object} targetContext - Context object to restore GitHub info into
 * @param {string} logPrefix - Prefix for log messages (e.g., '[GITHUB RECOVERY]', '[ENGINE REHYDRATION]')
 * @returns {boolean} - True if GitHub context was restored, false otherwise
 */
function restoreGitHubContext(dbWorkflow, targetContext, logPrefix = '[GITHUB RESTORE]') {
  console.log(`🔄 ${logPrefix} Attempting to restore GitHub context...`);
  
  if (!dbWorkflow?.metadata?.github) {
    console.log(`❌ ${logPrefix} No GitHub metadata found in workflow - cannot restore context`);
    logger.warn(`❌ ${logPrefix} No GitHub metadata found in workflow - cannot restore context`);
    return false;
  }

  // Restore GitHub repository context from database metadata using shared helper
  targetContext.githubRepository = createGitHubRepositoryObject(dbWorkflow.metadata.github);
  targetContext.targetBranch = dbWorkflow.metadata.github.targetBranch;
  targetContext.githubCapabilities = dbWorkflow.metadata.github.capabilities;
  
  const successMessage = `✅ ${logPrefix} Successfully restored GitHub context: ${targetContext.githubRepository.full_name}`;
  console.log(successMessage);
  logger.info(successMessage);
  
  return true;
}

/**
 * Logs GitHub metadata analysis for debugging
 * @param {Object} dbWorkflow - Database workflow object
 * @param {string} logPrefix - Prefix for log messages
 */
function logGitHubMetadataCheck(dbWorkflow, logPrefix = '[GITHUB DEBUG]') {
  const debugInfo = {
    hasMetadata: !!dbWorkflow?.metadata,
    hasGitHub: !!dbWorkflow?.metadata?.github,
    githubOwner: dbWorkflow?.metadata?.github?.owner,
    githubName: dbWorkflow?.metadata?.github?.name,
    workflowId: dbWorkflow?.workflowId || dbWorkflow?._id,
    template: dbWorkflow?.template
  };
  
  // Double-log to ensure visibility
  console.log(`🔍 ${logPrefix} Checking for GitHub metadata in database:`, debugInfo);
  logger.info(`🔍 ${logPrefix} Checking for GitHub metadata in database:`, debugInfo);
  
  // Additional detailed logging if GitHub metadata exists
  if (dbWorkflow?.metadata?.github) {
    const githubDetail = {
      owner: dbWorkflow.metadata.github.owner,
      name: dbWorkflow.metadata.github.name,
      targetBranch: dbWorkflow.metadata.github.targetBranch,
      repositoryUrl: dbWorkflow.metadata.github.repositoryUrl,
      capabilities: dbWorkflow.metadata.github.capabilities
    };
    console.log(`📋 ${logPrefix} GitHub metadata details:`, githubDetail);
    logger.info(`📋 ${logPrefix} GitHub metadata details:`, githubDetail);
  } else {
    console.log(`❌ ${logPrefix} NO GitHub metadata found in workflow`);
    logger.warn(`❌ ${logPrefix} NO GitHub metadata found in workflow`);
  }
}

/**
 * Creates a GitHub repository object from workflow metadata
 * @param {Object} githubMetadata - GitHub metadata from workflow.metadata.github
 * @returns {Object} - GitHub repository object
 */
function createGitHubRepositoryObject(githubMetadata) {
  if (!githubMetadata) {
    return null;
  }

  return {
    full_name: `${githubMetadata.owner}/${githubMetadata.name}`,
    name: githubMetadata.name,
    owner: githubMetadata.owner,
    html_url: githubMetadata.repositoryUrl,
    private: false // Default assumption for team deployments
  };
}

/**
 * Injects GitHub context into workflow context if missing (for prepareAgentContext)
 * @param {Object} workflow - Workflow object with metadata and context
 * @returns {Object} - Additional context properties to spread into workflowContext
 */
function injectGitHubContextIfMissing(workflow) {
  if (workflow.metadata?.github && !workflow.context?.githubRepository) {
    return {
      githubRepository: createGitHubRepositoryObject(workflow.metadata.github),
      targetBranch: workflow.metadata.github.targetBranch,
      githubCapabilities: workflow.metadata.github.capabilities
    };
  }
  return {};
}

module.exports = {
  restoreGitHubContext,
  logGitHubMetadataCheck,
  createGitHubRepositoryObject,
  injectGitHubContextIfMissing
};