/**
 * Tool definitions for the AI agent.
 */
import { tool } from 'ai';
import { z } from 'zod';
import { toolExecutor } from './toolExecutor.js';

export const tools = {
  readFile: tool({
    description: 'Read the contents of a file from the repository.',
    parameters: z.object({
      path: z.string().describe('The path to the file in the repository.'),
      owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
      repo: z.string().optional().describe('Repository name (will use context if not provided).'),
      branch: z.string().optional().describe('Branch name to read from (defaults to main branch if not provided).'),
    }),
    execute: async ({ path, owner, repo, branch }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'readFile', 
        args: { path, owner, repo, branch } 
      });
      if (!result.success) {
        throw new Error(result.error || 'File read failed');
      }
      return result.result;
    },
  }),
  writeFile: tool({
    description: 'Write content to a file.',
    parameters: z.object({
      path: z.string().describe('The path to the file.'),
      content: z.string().describe('The content to write.'),
    }),
    execute: async ({ path, content }) => toolExecutor.execute({ toolName: 'writeFile', args: { path, content } }),
  }),
  createBranch: tool({
    description: 'Create a new branch and switch to it.',
    parameters: z.object({
      branchName: z.string().describe('The name of the new branch.'),
      owner: z.string().optional().describe('Repository owner (for user repos).'),
      repo: z.string().optional().describe('Repository name (for user repos).'),
    }),
    execute: async ({ branchName, owner, repo }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'createBranch', 
        args: { branchName, owner, repo } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Branch creation failed');
      }
      return result.result;
    },
  }),
  deleteBranch: tool({
    description: 'Delete a git branch from a repository.',
    parameters: z.object({
      branchName: z.string().describe('The name of the branch to delete.'),
      owner: z.string().optional().describe('Repository owner (for user repos).'),
      repo: z.string().optional().describe('Repository name (for user repos).'),
    }),
    execute: async ({ branchName, owner, repo }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'deleteBranch', 
        args: { branchName, owner, repo } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Branch deletion failed');
      }
      return result.result;
    },
  }),
  createOrUpdateFile: tool({
    description: 'Create or update a file in a repository. You MUST provide the complete file content - do not skip this parameter!',
    parameters: z.object({
      filePath: z.string().describe('The path to the file (e.g., "package.json", "src/App.jsx"). REQUIRED.'),
      content: z.string().describe('The COMPLETE file content to write. You must provide the full content, not a placeholder or description. REQUIRED.'),
      message: z.string().describe('Git commit message describing the change (e.g., "Add React dependency"). REQUIRED.'),
      owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
      repo: z.string().optional().describe('Repository name (will use context if not provided).'),
      branch: z.string().optional().describe('Branch name to commit to (defaults to working branch if not provided).'),
    }),
    execute: async (args) => {
      // Log the args to debug
      console.log('🔍 createOrUpdateFile called with args:', JSON.stringify({
        filePath: args.filePath,
        hasContent: !!args.content,
        contentLength: args.content?.length || 0,
        message: args.message,
        commitMessage: args.commitMessage, // AI might be using this instead
        allKeys: Object.keys(args)
      }, null, 2));

      // Handle both 'message' and 'commitMessage' (AI uses different names)
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

      try {
        const result = await toolExecutor.execute({
          toolName: 'createOrUpdateFile',
          args: { filePath, content, message, owner, repo, branch }
        });
        if (!result.success) {
          console.error('❌ Tool execution failed:', result.error);
          throw new Error(result.error || 'File operation failed');
        }
        console.log('✅ File operation succeeded:', result.result);
        return result.result;
      } catch (error) {
        console.error('❌ Tool execution exception:', error.message);
        throw error;
      }
    },
  }),
  createCommit: tool({
    description: 'Create a commit with multiple file changes.',
    parameters: z.object({
      message: z.string().describe('The commit message.'),
      changes: z.array(z.object({
        path: z.string().describe('File path.'),
        content: z.string().describe('File content.')
      })).describe('Array of file changes.'),
      owner: z.string().describe('Repository owner.'),
      repo: z.string().describe('Repository name.'),
      branch: z.string().describe('Branch name to commit to.'),
    }),
    execute: async ({ message, changes, owner, repo, branch }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'createCommit', 
        args: { message, changes, owner, repo, branch } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Commit creation failed');
      }
      return result.result;
    },
  }),
  createPullRequest: tool({
    description: 'Create a new pull request from the current working branch.',
    parameters: z.object({
      owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
      repo: z.string().optional().describe('Repository name (will use context if not provided).'),
      title: z.string().describe('The title of the pull request. REQUIRED.'),
      body: z.string().describe('The body/description of the pull request. REQUIRED.'),
      head: z.string().optional().describe('The branch with your changes (defaults to current working branch if not provided).'),
      base: z.string().optional().describe('The target branch for the PR (defaults to main/master if not provided).'),
    }),
    execute: async ({ owner, repo, title, body, head, base }) => {
      const result = await toolExecutor.execute({
        toolName: 'createPullRequest',
        args: { owner, repo, title, body, head, base }
      });
      if (!result.success) {
        throw new Error(result.error || 'Pull request creation failed');
      }
      return result.result;
    },
  }),
  getRepositoryInfo: tool({
    description: 'Get git-specific information about a repository (clone URLs, default branch, etc).',
    parameters: z.object({
      owner: z.string().describe('The owner of the repository.'),
      repo: z.string().describe('The name of the repository.'),
    }),
    execute: async ({ owner, repo }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'getRepositoryInfo', 
        args: { owner, repo } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Repository info retrieval failed');
      }
      return result.result;
    },
  }),
  switchWorkingBranch: tool({
    description: 'Switch the current working branch context (does not create the branch).',
    parameters: z.object({
      branchName: z.string().describe('The name of the branch to switch to.'),
    }),
    execute: async ({ branchName }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'switchWorkingBranch', 
        args: { branchName } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Branch switch failed');
      }
      return result.result;
    },
  }),
  getWorkflowStatus: tool({
    description: 'Get the current git workflow status including working branch.',
    parameters: z.object({
      owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
      repo: z.string().optional().describe('Repository name (will use context if not provided).'),
    }),
    execute: async ({ owner, repo }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'getWorkflowStatus', 
        args: { owner, repo } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Workflow status retrieval failed');
      }
      return result.result;
    },
  }),
  listBranches: tool({
    description: 'List all branches in the repository.',
    parameters: z.object({
      owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
      repo: z.string().optional().describe('Repository name (will use context if not provided).'),
    }),
    execute: async ({ owner, repo }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'listBranches', 
        args: { owner, repo } 
      });
      if (!result.success) {
        throw new Error(result.error || 'Branch listing failed');
      }
      return result.result;
    },
  }),
};

export { toolExecutor };
