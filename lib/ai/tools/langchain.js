/**
 * LangChain Tool Definitions
 * Replaces Vercel AI SDK tool() with LangChain DynamicStructuredTool
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { toolExecutor } from './toolExecutor.js';

/**
 * Read file tool
 */
export const readFileTool = new DynamicStructuredTool({
  name: 'readFile',
  description: 'Read the contents of a file from the repository.',
  schema: z.object({
    path: z.string().describe('The path to the file in the repository.'),
    owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
    repo: z.string().optional().describe('Repository name (will use context if not provided).'),
    branch: z.string().optional().describe('Branch name to read from (defaults to main branch if not provided).')
  }),
  func: async ({ path, owner, repo, branch }) => {
    const result = await toolExecutor.execute({
      toolName: 'readFile',
      args: { path, owner, repo, branch }
    });
    if (!result.success) {
      throw new Error(result.error || 'File read failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Write file tool
 */
export const writeFileTool = new DynamicStructuredTool({
  name: 'writeFile',
  description: 'Write content to a file.',
  schema: z.object({
    path: z.string().describe('The path to the file.'),
    content: z.string().describe('The content to write.')
  }),
  func: async ({ path, content }) => {
    const result = await toolExecutor.execute({
      toolName: 'writeFile',
      args: { path, content }
    });
    if (!result.success) {
      throw new Error(result.error || 'File write failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Create branch tool
 */
export const createBranchTool = new DynamicStructuredTool({
  name: 'createBranch',
  description: 'Create a new branch and switch to it.',
  schema: z.object({
    branchName: z.string().describe('The name of the new branch.'),
    owner: z.string().optional().describe('Repository owner (for user repos).'),
    repo: z.string().optional().describe('Repository name (for user repos).')
  }),
  func: async ({ branchName, owner, repo }) => {
    const result = await toolExecutor.execute({
      toolName: 'createBranch',
      args: { branchName, owner, repo }
    });
    if (!result.success) {
      throw new Error(result.error || 'Branch creation failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Delete branch tool
 */
export const deleteBranchTool = new DynamicStructuredTool({
  name: 'deleteBranch',
  description: 'Delete a git branch from a repository.',
  schema: z.object({
    branchName: z.string().describe('The name of the branch to delete.'),
    owner: z.string().optional().describe('Repository owner (for user repos).'),
    repo: z.string().optional().describe('Repository name (for user repos).')
  }),
  func: async ({ branchName, owner, repo }) => {
    const result = await toolExecutor.execute({
      toolName: 'deleteBranch',
      args: { branchName, owner, repo }
    });
    if (!result.success) {
      throw new Error(result.error || 'Branch deletion failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Create or update file tool
 */
export const createOrUpdateFileTool = new DynamicStructuredTool({
  name: 'createOrUpdateFile',
  description: 'Create or update a file in a repository. You MUST provide the complete file content - do not skip this parameter!',
  schema: z.object({
    filePath: z.string().describe('The path to the file (e.g., "package.json", "src/App.jsx"). REQUIRED.'),
    content: z.string().describe('The COMPLETE file content to write. You must provide the full content, not a placeholder or description. REQUIRED.'),
    message: z.string().describe('Git commit message describing the change (e.g., "Add React dependency"). REQUIRED.'),
    owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
    repo: z.string().optional().describe('Repository name (will use context if not provided).'),
    branch: z.string().optional().describe('Branch name to commit to (defaults to working branch if not provided).')
  }),
  func: async (args) => {
    const { filePath, content, owner, repo, branch } = args;
    const message = args.message || args.commitMessage;

    // Validate required parameters
    if (!filePath) {
      throw new Error('Missing required parameter: filePath. The AI must provide the path to the file.');
    }
    if (!content) {
      throw new Error('Missing required parameter: content. The AI must provide the file content to write.');
    }
    if (!message) {
      throw new Error('Missing required parameter: message. The AI must provide a commit message.');
    }

    const result = await toolExecutor.execute({
      toolName: 'createOrUpdateFile',
      args: { filePath, content, message, owner, repo, branch }
    });

    if (!result.success) {
      throw new Error(result.error || 'File operation failed');
    }

    return JSON.stringify(result.result);
  }
});

/**
 * Create commit tool
 */
export const createCommitTool = new DynamicStructuredTool({
  name: 'createCommit',
  description: 'Create a commit with multiple file changes.',
  schema: z.object({
    message: z.string().describe('The commit message.'),
    changes: z.array(z.object({
      path: z.string().describe('File path.'),
      content: z.string().describe('File content.')
    })).describe('Array of file changes.'),
    owner: z.string().describe('Repository owner.'),
    repo: z.string().describe('Repository name.'),
    branch: z.string().describe('Branch name to commit to.')
  }),
  func: async ({ message, changes, owner, repo, branch }) => {
    const result = await toolExecutor.execute({
      toolName: 'createCommit',
      args: { message, changes, owner, repo, branch }
    });
    if (!result.success) {
      throw new Error(result.error || 'Commit creation failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Create pull request tool
 */
export const createPullRequestTool = new DynamicStructuredTool({
  name: 'createPullRequest',
  description: 'Create a new pull request from the current working branch.',
  schema: z.object({
    owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
    repo: z.string().optional().describe('Repository name (will use context if not provided).'),
    title: z.string().describe('The title of the pull request. REQUIRED.'),
    body: z.string().describe('The body/description of the pull request. REQUIRED.'),
    head: z.string().optional().describe('The branch with your changes (defaults to current working branch if not provided).'),
    base: z.string().optional().describe('The target branch for the PR (defaults to main/master if not provided).')
  }),
  func: async ({ owner, repo, title, body, head, base }) => {
    const result = await toolExecutor.execute({
      toolName: 'createPullRequest',
      args: { owner, repo, title, body, head, base }
    });
    if (!result.success) {
      throw new Error(result.error || 'Pull request creation failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Get repository info tool
 */
export const getRepositoryInfoTool = new DynamicStructuredTool({
  name: 'getRepositoryInfo',
  description: 'Get git-specific information about a repository (clone URLs, default branch, etc).',
  schema: z.object({
    owner: z.string().describe('The owner of the repository.'),
    repo: z.string().describe('The name of the repository.')
  }),
  func: async ({ owner, repo }) => {
    const result = await toolExecutor.execute({
      toolName: 'getRepositoryInfo',
      args: { owner, repo }
    });
    if (!result.success) {
      throw new Error(result.error || 'Repository info retrieval failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Switch working branch tool
 */
export const switchWorkingBranchTool = new DynamicStructuredTool({
  name: 'switchWorkingBranch',
  description: 'Switch the current working branch context (does not create the branch).',
  schema: z.object({
    branchName: z.string().describe('The name of the branch to switch to.')
  }),
  func: async ({ branchName }) => {
    const result = await toolExecutor.execute({
      toolName: 'switchWorkingBranch',
      args: { branchName }
    });
    if (!result.success) {
      throw new Error(result.error || 'Branch switch failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Get workflow status tool
 */
export const getWorkflowStatusTool = new DynamicStructuredTool({
  name: 'getWorkflowStatus',
  description: 'Get the current git workflow status including working branch.',
  schema: z.object({
    owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
    repo: z.string().optional().describe('Repository name (will use context if not provided).')
  }),
  func: async ({ owner, repo }) => {
    const result = await toolExecutor.execute({
      toolName: 'getWorkflowStatus',
      args: { owner, repo }
    });
    if (!result.success) {
      throw new Error(result.error || 'Workflow status retrieval failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * List branches tool
 */
export const listBranchesTool = new DynamicStructuredTool({
  name: 'listBranches',
  description: 'List all branches in the repository.',
  schema: z.object({
    owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
    repo: z.string().optional().describe('Repository name (will use context if not provided).')
  }),
  func: async ({ owner, repo }) => {
    const result = await toolExecutor.execute({
      toolName: 'listBranches',
      args: { owner, repo }
    });
    if (!result.success) {
      throw new Error(result.error || 'Branch listing failed');
    }
    return JSON.stringify(result.result);
  }
});

/**
 * Export all tools as array
 */
export const langchainTools = [
  readFileTool,
  writeFileTool,
  createBranchTool,
  deleteBranchTool,
  createOrUpdateFileTool,
  createCommitTool,
  createPullRequestTool,
  getRepositoryInfoTool,
  switchWorkingBranchTool,
  getWorkflowStatusTool,
  listBranchesTool
];

export { toolExecutor };
