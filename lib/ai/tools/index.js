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
    description: 'Create or update a file in a repository.',
    parameters: z.object({
      filePath: z.string().describe('The path to the file.'),
      content: z.string().describe('The file content.'),
      message: z.string().describe('Commit message for the change.'),
      owner: z.string().optional().describe('Repository owner (will use context if not provided).'),
      repo: z.string().optional().describe('Repository name (will use context if not provided).'),
      branch: z.string().optional().describe('Branch name to commit to (defaults to main branch if not provided).'),
    }),
    execute: async ({ filePath, content, message, owner, repo, branch }) => {
      const result = await toolExecutor.execute({ 
        toolName: 'createOrUpdateFile', 
        args: { filePath, content, message, owner, repo, branch } 
      });
      if (!result.success) {
        throw new Error(result.error || 'File operation failed');
      }
      return result.result;
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
    description: 'Create a new pull request.',
    parameters: z.object({
      owner: z.string().describe('The owner of the repository.'),
      repo: z.string().describe('The name of the repository.'),
      title: z.string().describe('The title of the pull request.'),
      body: z.string().describe('The body of the pull request.'),
      head: z.string().describe('The name of the branch where your changes are implemented.'),
      base: z.string().describe('The name of the branch you want the changes pulled into.'),
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
