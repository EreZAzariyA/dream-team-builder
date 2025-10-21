/**
 * Git tools for the AI agent.
 * Uses GitHub API for all git operations - no local cloning needed.
 */
import { Octokit } from '@octokit/rest';
import { User } from '../../database/models/index.js';
import logger from '../../utils/logger.js';

export async function createBranch({ branchName, owner, repo, userId }) {
  try {
    logger.info(`Creating branch ${branchName} in ${owner}/${repo} using GitHub API`);
    
    const octokit = await createOctokit(userId);
    
    // Get the default branch to use as base
    const repoInfo = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;
    
    // Get the SHA of the default branch
    const { data: defaultBranchRef } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });
    
    // Check if branch already exists
    try {
      await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
      logger.info(`Branch ${branchName} already exists`);
      return `Branch ${branchName} already exists in ${owner}/${repo}`;
    } catch (error) {
      if (error.status !== 404) throw error;
      // Branch doesn't exist, continue to create it
    }
    
    // Create new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: defaultBranchRef.object.sha
    });
    
    logger.info(`✅ Branch ${branchName} created successfully`);
    
    // Set this as the working branch context for subsequent operations  
    // Note: This will be set by the caller to avoid circular imports
    
    return `Created branch ${branchName} in ${owner}/${repo} from ${defaultBranch}. This is now your active working branch for file operations.`;
    
  } catch (error) {
    logger.error(`Failed to create branch ${branchName}:`, error);
    throw new Error(`Failed to create branch ${branchName}: ${error.message}`);
  }
}

export async function deleteBranch({ branchName, owner, repo, userId }) {
  try {
    logger.info(`Deleting branch ${branchName} in ${owner}/${repo} using GitHub API`);
    
    const octokit = await createOctokit(userId);
    
    // Check if branch exists
    try {
      await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
    } catch (error) {
      if (error.status === 404) {
        logger.info(`Branch ${branchName} does not exist`);
        return `Branch ${branchName} does not exist in ${owner}/${repo}`;
      }
      throw error;
    }
    
    // Prevent deletion of default/protected branches
    const repoInfo = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;
    
    if (branchName === defaultBranch) {
      throw new Error(`Cannot delete default branch: ${branchName}`);
    }
    
    // Common protected branch names
    const protectedBranches = ['main', 'master', 'develop', 'dev', 'production', 'prod'];
    if (protectedBranches.includes(branchName.toLowerCase())) {
      throw new Error(`Cannot delete protected branch: ${branchName}`);
    }
    
    // Delete the branch
    await octokit.git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
    
    logger.info(`✅ Branch ${branchName} deleted successfully`);
    return `Deleted branch ${branchName} from ${owner}/${repo}`;
    
  } catch (error) {
    logger.error(`Failed to delete branch ${branchName}:`, error);
    throw new Error(`Failed to delete branch ${branchName}: ${error.message}`);
  }
}

export async function createOrUpdateFile({ filePath, content, message, owner, repo, branch, userId }) {
  try {
    // Validate required parameters
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required and must be a string');
    }
    
    if (content === undefined || content === null) {
      throw new Error('File content is required');
    }
    
    // Convert content to string if it's not already
    const fileContent = typeof content === 'string' ? content : String(content);
    
    const octokit = await createOctokit(userId);
    
    // Branch will be injected by toolExecutor to avoid circular imports
    if (!branch) {
      const repoInfo = await octokit.repos.get({ owner, repo });
      branch = repoInfo.data.default_branch;
      logger.info(`Using default branch: ${branch}`);
    }
    
    logger.info(`Creating/updating file ${filePath} in ${owner}/${repo}:${branch}`);
    
    // Try to get existing file to get its SHA for update
    let existingFile = null;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });
      existingFile = data;
    } catch (error) {
      if (error.status !== 404) throw error;
      // File doesn't exist, will create new
    }
    
    // Create or update file
    const result = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: message || `Update ${filePath}`,
      content: Buffer.from(fileContent).toString('base64'),
      branch,
      ...(existingFile && { sha: existingFile.sha })
    });
    
    logger.info(`✅ File ${filePath} ${existingFile ? 'updated' : 'created'} successfully`);
    return {
      action: existingFile ? 'updated' : 'created',
      path: filePath,
      commit: result.data.commit.sha,
      message: `${existingFile ? 'Updated' : 'Created'} ${filePath} in ${owner}/${repo}:${branch}`
    };
    
  } catch (error) {
    logger.error(`Failed to create/update file ${filePath}:`, error);
    throw new Error(`Failed to create/update file ${filePath}: ${error.message}`);
  }
}

export async function createCommit({ message, changes, owner, repo, branch, userId }) {
  try {
    logger.info(`Creating commit in ${owner}/${repo}:${branch} with ${changes.length} changes`);
    
    const octokit = await createOctokit(userId);
    
    // Get current branch reference
    const { data: branchRef } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });
    
    // Get the commit tree
    const { data: baseCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: branchRef.object.sha
    });
    
    // Create tree with changes
    const tree = [];
    for (const change of changes) {
      tree.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        content: change.content
      });
    }
    
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      tree,
      base_tree: baseCommit.tree.sha
    });
    
    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: newTree.sha,
      parents: [branchRef.object.sha]
    });
    
    // Update branch reference
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    });
    
    logger.info(`✅ Commit ${newCommit.sha} created successfully`);
    return `Created commit ${newCommit.sha} with message: "${message}" in ${owner}/${repo}:${branch}`;
    
  } catch (error) {
    logger.error(`Failed to create commit:`, error);
    throw new Error(`Failed to create commit: ${error.message}`);
  }
}

/**
 * Get user's GitHub token from user profile
 */
async function getUserGitHubToken(userId) {
  if (!userId) {
    throw new Error('User ID is required for GitHub operations');
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.githubAccessToken) {
      throw new Error('No GitHub integration found. Please connect your GitHub account in the integrations page.');
    }

    return user.githubAccessToken;
  } catch (error) {
    logger.error('❌ Failed to get GitHub token:', error);
    throw error;
  }
}

/**
 * Create GitHub API client with user token
 */
async function createOctokit(userId) {
  const token = await getUserGitHubToken(userId);
  return new Octokit({
    auth: token,
  });
}

export async function createPullRequest({ owner, repo, title, body, head, base, userId }) {
  try {
    if (!userId) {
      throw new Error('User ID is required for GitHub operations');
    }

    const octokit = await createOctokit(userId);

    // Get default branch if base not provided
    if (!base) {
      const repoInfo = await octokit.repos.get({ owner, repo });
      base = repoInfo.data.default_branch;
      logger.info(`Using default branch as PR base: ${base}`);
    }

    logger.info(`Creating PR: ${head} -> ${base} in ${owner}/${repo}`);

    const response = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });

    logger.info(`✅ Pull request created: #${response.data.number}`);
    return {
      number: response.data.number,
      url: response.data.html_url,
      title: response.data.title,
      state: response.data.state,
      message: `Created pull request #${response.data.number}: ${title}`
    };
  } catch (error) {
    logger.error(`Failed to create pull request:`, error);
    throw new Error(`Failed to create pull request: ${error.message}`);
  }
}

/**
 * Read file contents from GitHub repository
 */
export async function readFile({ path: filePath, owner, repo, branch, userId }) {
  try {
    // Validate required parameters
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required and must be a string');
    }
    
    const octokit = await createOctokit(userId);
    
    // Branch will be injected by toolExecutor to avoid circular imports
    if (!branch) {
      const repoInfo = await octokit.repos.get({ owner, repo });
      branch = repoInfo.data.default_branch;
      logger.info(`Using default branch: ${branch}`);
    }
    
    logger.info(`Reading file ${filePath} from ${owner}/${repo}:${branch}`);
    
    // Get file contents from GitHub
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch
    });
    
    // Handle file vs directory
    if (data.type !== 'file') {
      throw new Error(`Path ${filePath} is not a file`);
    }
    
    // Decode base64 content
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    logger.info(`✅ File ${filePath} read successfully (${content.length} characters)`);
    return {
      path: filePath,
      content,
      size: data.size,
      sha: data.sha
    };
    
  } catch (error) {
    logger.error(`Failed to read file ${filePath}:`, error);
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Switch working branch context (does not create the branch)
 */
export async function switchWorkingBranch({ branchName, userId }) {
  try {
    if (!branchName || typeof branchName !== 'string') {
      throw new Error('Branch name is required and must be a string');
    }
    
    // Working branch will be set by toolExecutor to avoid circular imports
    return `Switched working branch context to: ${branchName}. All file operations will now use this branch.`;
  } catch (error) {
    throw new Error(`Failed to switch working branch: ${error.message}`);
  }
}

/**
 * Get current git workflow status
 */
export async function getWorkflowStatus({ owner, repo, userId, workingBranch = null }) {
  try {
    return {
      currentWorkingBranch: workingBranch || 'No working branch set (will use main)',
      repository: `${owner}/${repo}`,
      message: workingBranch 
        ? `Currently working on branch: ${workingBranch}` 
        : 'No working branch set. Use createBranch or switchWorkingBranch to set one.'
    };
  } catch (error) {
    throw new Error(`Failed to get workflow status: ${error.message}`);
  }
}

/**
 * List all branches in the repository
 */
export async function listBranches({ owner, repo, userId }) {
  try {
    const octokit = await createOctokit(userId);
    
    logger.info(`Getting all branches for ${owner}/${repo}`);
    
    // Get all branches from GitHub API
    const { data: branches } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100 // Get up to 100 branches
    });
    
    // Get repository info to identify default branch
    const repoInfo = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;
    
    const branchList = branches.map(branch => ({
      name: branch.name,
      isDefault: branch.name === defaultBranch,
      protected: branch.protected || false,
      lastCommit: {
        sha: branch.commit.sha.substring(0, 7),
        url: branch.commit.url
      }
    }));
    
    logger.info(`✅ Found ${branchList.length} branches in ${owner}/${repo}`);
    
    const result = {
      repository: `${owner}/${repo}`,
      defaultBranch,
      totalBranches: branchList.length,
      branches: branchList,
      message: `Found ${branchList.length} branches in ${owner}/${repo}. Default branch: ${defaultBranch}`
    };
    
    logger.info(`🔍 listBranches returning result:`, result);
    
    return result;
    
  } catch (error) {
    logger.error(`Failed to list branches for ${owner}/${repo}:`, error);
    throw new Error(`Failed to list branches: ${error.message}`);
  }
}

/**
 * Get repository information for git operations
 */
export async function getRepositoryInfo({ owner, repo, userId }) {
  if (!userId) {
    throw new Error('User ID is required for GitHub operations');
  }

  const octokit = await createOctokit(userId);
  const response = await octokit.repos.get({
    owner,
    repo,
  });
  
  // Return only git-relevant information
  return {
    name: response.data.name,
    full_name: response.data.full_name,
    default_branch: response.data.default_branch,
    clone_url: response.data.clone_url,
    ssh_url: response.data.ssh_url,
    html_url: response.data.html_url
  };
}

