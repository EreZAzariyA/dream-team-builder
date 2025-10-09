/**
 * Secure Tool Executor
 * Executes tool calls from the AI model with security validation.
 */

import * as fileSystemTools from './fileSystemTools.js';
import * as gitTools from './gitTools.js';
import logger from '../../utils/logger.js';

const toolImplementations = {
  ...fileSystemTools,
  ...gitTools,
};

// Global context for current user ID and repository (thread-safe for single-threaded Node.js)
let currentUserId = null;
let currentRepository = null;
let currentWorkingBranch = null; // Track the active working branch for git operations

// Security configuration
const SECURITY_CONFIG = {
  // File system restrictions
  allowedFileExtensions: ['.js', '.json', '.md', '.txt', '.yaml', '.yml', '.env.example'],
  forbiddenPaths: ['/etc', '/bin', '/usr/bin', '/system32', 'node_modules'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Git restrictions
  allowedBranches: ['feature/', 'fix/', 'dev-', 'test-'],
  maxCommitsPerSession: 10
};

/**
 * Set the current user context for tool execution
 */
export function setUserContext(userId, repository = null) {
  currentUserId = userId;
  currentRepository = repository;
  logger.info(`🔧 Set tool execution context for user: ${userId}${repository ? `, repo: ${repository.owner}/${repository.name}` : ''}`);
}

/**
 * Set repository context for git operations
 */
export function setRepositoryContext(repository) {
  currentRepository = repository;
  // Reset working branch when repository context changes
  currentWorkingBranch = null;
  logger.info(`🗂️ Set repository context: ${repository.owner}/${repository.name}`);
}

/**
 * Set the current working branch context
 */
export function setWorkingBranch(branchName) {
  currentWorkingBranch = branchName;
  logger.info(`🌿 Set working branch context: ${branchName}`);
}

/**
 * Get the current working branch context
 */
export function getCurrentWorkingBranch() {
  return currentWorkingBranch;
}

/**
 * Clear the current user context
 */
export function clearUserContext() {
  currentUserId = null;
  currentRepository = null;
  currentWorkingBranch = null;
}

/**
 * Clean up memory and force garbage collection
 */
export function cleanup() {
  clearUserContext();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

/**
 * Validate tool execution permissions and safety
 */
function validateToolSecurity(toolName, args, userId) {
  logger.info(`🔒 Validating security for tool: ${toolName}, user: ${userId}`);

  // Basic validation
  if (!toolName || typeof toolName !== 'string') {
    throw new Error('Invalid tool name');
  }

  if (!userId) {
    throw new Error('User ID required for tool execution');
  }

  // GitHub file operations security checks
  if (toolName === 'readFile') {
    const { path } = args;
    
    if (!path || typeof path !== 'string') {
      logger.error(`❌ File path validation failed for ${toolName}:`, { path, args, type: typeof path });
      throw new Error(`Invalid file path for ${toolName}. Expected string, received: ${typeof path}`);
    }

    // Basic path validation for GitHub files
    if (path.includes('..')) {
      throw new Error('Path traversal not allowed in repository files');
    }
  }

  // Local file system security checks (for writeFile if it's still local)
  if (toolName === 'writeFile') {
    const { path } = args;
    
    if (!path || typeof path !== 'string') {
      logger.error(`❌ File path validation failed for ${toolName}:`, { path, args, type: typeof path });
      throw new Error(`Invalid file path for ${toolName}. Expected string, received: ${typeof path}`);
    }

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('~')) {
      throw new Error('Path traversal not allowed');
    }

    // Check forbidden paths
    const normalizedPath = path.toLowerCase();
    for (const forbidden of SECURITY_CONFIG.forbiddenPaths) {
      if (normalizedPath.includes(forbidden)) {
        throw new Error(`Access to ${forbidden} is not allowed`);
      }
    }

    // Check file extensions for write operations
    const extension = path.substring(path.lastIndexOf('.'));
    if (!SECURITY_CONFIG.allowedFileExtensions.includes(extension)) {
      throw new Error(`File extension ${extension} not allowed`);
    }
  }

  // Git security checks
  if (['createBranch', 'deleteBranch', 'commit', 'push', 'createPullRequest', 'getRepositoryInfo', 'readFile', 'switchWorkingBranch', 'getWorkflowStatus', 'listBranches'].includes(toolName)) {
    if (toolName === 'createBranch') {
      const { branchName } = args;
      if (!branchName || typeof branchName !== 'string') {
        throw new Error('Branch name is required and must be a string');
      }
      
      const isAllowedBranch = SECURITY_CONFIG.allowedBranches.some(
        prefix => branchName.startsWith(prefix)
      );
      
      // Allow any branch name for now - commented out security restriction
      // if (!isAllowedBranch) {
      //   throw new Error(`Branch name must start with one of: ${SECURITY_CONFIG.allowedBranches.join(', ')}`);
      // }
    }

    if (toolName === 'deleteBranch') {
      const { branchName } = args;
      if (!branchName || typeof branchName !== 'string') {
        throw new Error('Branch name is required and must be a string');
      }
      
      // Prevent deletion of common protected branches
      const protectedBranches = ['main', 'master', 'develop', 'dev', 'production', 'prod'];
      if (protectedBranches.includes(branchName.toLowerCase())) {
        throw new Error(`Cannot delete protected branch: ${branchName}`);
      }
    }

    if (toolName === 'commit') {
      const { message } = args;
      if (!message || message.trim().length < 10) {
        throw new Error('Commit message must be at least 10 characters');
      }
    }
  }

  logger.info(`✅ Security validation passed for tool: ${toolName}`);
  return true;
}

export const toolExecutor = {
  execute: async (toolCall, userId = null) => {
    const { toolName, args } = toolCall;
    
    // Use context userId if not explicitly passed
    const effectiveUserId = userId || currentUserId;
    
    try {
      // Security validation
      validateToolSecurity(toolName, args, effectiveUserId);

      // Execute tool if it exists
      if (toolImplementations[toolName]) {
        logger.info(`🛠️ Executing tool: ${toolName} for user: ${effectiveUserId}`);
        
        // Add userId to args for GitHub operations and handle repository context
        let enhancedArgs = args;
        
        if (['createPullRequest', 'getRepositoryInfo'].includes(toolName)) {
          enhancedArgs = { ...args, userId: effectiveUserId };
        }
        
        // Add userId to git operations that need GitHub API access
        if (['createBranch', 'deleteBranch', 'createOrUpdateFile', 'createCommit', 'readFile', 'switchWorkingBranch', 'getWorkflowStatus', 'listBranches'].includes(toolName)) {
          enhancedArgs = { ...args, userId: effectiveUserId };
          
          // Add repository context if available and not already provided
          if (currentRepository && !args.owner && !args.repo) {
            enhancedArgs.owner = currentRepository.owner;
            enhancedArgs.repo = currentRepository.name;
            logger.info(`🗂️ Using repository context: ${currentRepository.owner}/${currentRepository.name}`);
          }
          
          // Add working branch context for operations that need it
          if (['createOrUpdateFile', 'readFile', 'getWorkflowStatus'].includes(toolName) && currentWorkingBranch && !args.branch) {
            enhancedArgs.branch = currentWorkingBranch;
            logger.info(`🌿 Injecting working branch context: ${currentWorkingBranch}`);
          }
          
          // Add working branch to getWorkflowStatus for display
          if (toolName === 'getWorkflowStatus') {
            enhancedArgs.workingBranch = currentWorkingBranch;
          }
        }
        
        // Handle branch context setting after successful operations
        if (toolName === 'createBranch') {
          const result = await toolImplementations[toolName](enhancedArgs);
          if (enhancedArgs.branchName) {
            setWorkingBranch(enhancedArgs.branchName);
          }
          logger.info(`✅ Tool execution completed: ${toolName}`);
          return { toolName, result, success: true };
        }
        
        if (toolName === 'switchWorkingBranch') {
          const result = await toolImplementations[toolName](enhancedArgs);
          if (enhancedArgs.branchName) {
            setWorkingBranch(enhancedArgs.branchName);
          }
          logger.info(`✅ Tool execution completed: ${toolName}`);
          return { toolName, result, success: true };
        }
        
        const result = await toolImplementations[toolName](enhancedArgs);
        
        logger.info(`✅ Tool execution completed: ${toolName}`, { result: typeof result === 'object' ? Object.keys(result) : result });
        const toolResult = { toolName, result, success: true };
        logger.info(`🔍 Returning tool result:`, toolResult);
        return toolResult;
        
      } else {
        logger.warn(`❌ Tool not found: ${toolName}`);
        return { toolName, error: 'Tool not found', success: false };
      }
      
    } catch (error) {
      logger.error(`❌ Tool execution failed: ${toolName}`, error);
      return { 
        toolName, 
        error: error.message, 
        success: false,
        securityViolation: error.message.includes('not allowed') || error.message.includes('required')
      };
    }
  },

  // Get list of available tools with descriptions
  getAvailableTools: () => {
    return {
      fileSystem: ['writeFile'],
      git: ['readFile', 'createBranch', 'deleteBranch', 'createOrUpdateFile', 'createCommit', 'createPullRequest', 'getRepositoryInfo', 'switchWorkingBranch', 'getWorkflowStatus', 'listBranches'],
      security: SECURITY_CONFIG
    };
  },

  // Validate if user has permission for specific tool
  hasToolPermission: (userId, toolName) => {
    try {
      // Basic permission check - in a real app you'd check user roles/permissions
      return userId && toolName && toolImplementations[toolName];
    } catch {
      return false;
    }
  }
};
