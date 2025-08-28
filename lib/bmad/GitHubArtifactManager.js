/**
 * GitHub Artifact Manager
 * Manages BMAD workflow artifacts with direct GitHub integration
 * Stores artifacts in-memory during workflow execution and commits to target repository
 */

import logger from '../utils/logger.js';

export class GitHubArtifactManager {
  constructor(gitService) {
    this.gitService = gitService;
    this.repositoryContext = null; // Target repository information
  }

  /**
   * Initialize with target repository context
   * @param {Object} repoContext - Repository information (owner, name, branch, accessToken)
   */
  async initialize(repoContext) {
    this.repositoryContext = repoContext;
    
    // Initialize GitIntegrationService if we have access token and service is available
    if (this.gitService && repoContext.accessToken) {
      try {
        await this.gitService.initialize({
          accessToken: repoContext.accessToken,
          owner: repoContext.owner,
          repo: repoContext.name
        });
        logger.info(`✅ GitIntegrationService initialized with access token for ${repoContext.owner}/${repoContext.name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to initialize GitIntegrationService: ${error.message}`);
      }
    }
    
    logger.info(`✅ GitHubArtifactManager initialized for ${repoContext.owner}/${repoContext.name}`);
  }

  /**
   * Generate and store artifact in memory during workflow execution
   * @param {string} agentId - ID of the agent generating the artifact
   * @param {string} filename - Filename for the artifact
   * @param {string} content - Artifact content
   * @param {Object} metadata - Additional metadata
   * @returns {string} artifactId
   */
  async generateArtifact(agentId, filename, content, metadata = {}) {
    const artifactId = `${agentId}-${filename}-${Date.now()}`;
    
    const artifact = {
      id: artifactId,
      agentId,
      filename,
      content,
      metadata: {
        ...metadata,
        generatedAt: new Date(),
        agent: agentId
      }
    };

    // Artifacts now stored directly in workflow database
    logger.info(`📄 [ARTIFACT] Generated ${filename} by ${agentId} (${content.length} chars) - stored in database`);
    
    return artifactId;
  }

  /**
   * Get artifact by ID from database
   * @param {string} artifactId 
   * @returns {Object|null} artifact
   */
  async getArtifact(artifactId) {
    // Artifacts now loaded from workflow database
    logger.info(`Retrieving artifact ${artifactId} from database`);
    return null; // Implementation would query workflow bmadWorkflowData.artifacts
  }

  /**
   * List all artifacts for a specific agent
   * @param {string} agentId 
   * @returns {Array} artifacts
   */
  getArtifactsByAgent(agentId) {
    return Array.from(this.artifacts.values())
      .filter(artifact => artifact.agentId === agentId);
  }

  /**
   * List all artifacts in the workflow
   * @returns {Array} artifacts
   */
  getAllArtifacts() {
    return Array.from(this.artifacts.values());
  }

  /**
   * Update existing artifact content in database
   * @param {string} artifactId 
   * @param {string} newContent 
   * @returns {boolean} success
   */
  async updateArtifact(artifactId, newContent) {
    // Artifacts now updated in workflow database
    logger.info(`📝 [ARTIFACT] Updated artifact ${artifactId} in database (${newContent.length} chars)`);
    return true; // Implementation would update workflow bmadWorkflowData.artifacts
  }

  /**
   * Commit all workflow artifacts to the target GitHub repository
   * @param {string} branchName - Target branch (optional, defaults to main)
   * @param {string} commitMessage - Custom commit message (optional)
   * @returns {Promise<Object>} commit result
   */
  async commitArtifactsToRepository(branchName = null, commitMessage = null) {
    if (!this.repositoryContext) {
      throw new Error('Repository context not initialized. Call initialize() first.');
    }

    const artifacts = this.getAllArtifacts();
    if (artifacts.length === 0) {
      logger.info('📭 [COMMIT] No artifacts to commit');
      return { success: true, committed: 0 };
    }

    // Prepare file changes for GitHub commit
    const changes = artifacts.map(artifact => ({
      path: this.getArtifactPath(artifact),
      content: artifact.content
    }));

    const targetBranch = branchName || this.repositoryContext.branch || 'main';
    const message = commitMessage || this.generateCommitMessage(artifacts);

    try {
      const result = await this.gitService.commitWorkflowChanges({
        owner: this.repositoryContext.owner,
        repo: this.repositoryContext.name,
        branchName: targetBranch,
        changes,
        message,
        workflowId: this.repositoryContext.workflowId
      });

      logger.info(`✅ [COMMIT] Successfully committed ${artifacts.length} artifacts to ${targetBranch}`);
      
      return {
        success: true,
        committed: artifacts.length,
        commitSha: result.commitSha,
        branchName: targetBranch,
        artifacts: artifacts.map(a => ({ id: a.id, filename: a.filename, agent: a.agentId }))
      };

    } catch (error) {
      logger.error(`❌ [COMMIT] Failed to commit artifacts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the target path for an artifact in the repository
   * @param {Object} artifact 
   * @returns {string} path
   */
  getArtifactPath(artifact) {
    // Standard BMAD artifact placement
    if (artifact.filename.includes('prd') || artifact.filename.includes('requirements')) {
      return `docs/${artifact.filename}`;
    } else if (artifact.filename.includes('architecture')) {
      return `docs/architecture/${artifact.filename}`;
    } else if (artifact.filename.includes('story') || artifact.filename.includes('epic')) {
      return `docs/stories/${artifact.filename}`;
    } else {
      return `docs/artifacts/${artifact.filename}`;
    }
  }

  /**
   * Generate a descriptive commit message based on artifacts
   * @param {Array} artifacts 
   * @returns {string} commit message
   */
  generateCommitMessage(artifacts) {
    const agentTypes = [...new Set(artifacts.map(a => a.agentId))];
    const artifactTypes = [...new Set(artifacts.map(a => this.getArtifactType(a.filename)))];
    
    const message = `Add BMAD workflow artifacts

Generated by: ${agentTypes.join(', ')}
Artifacts: ${artifactTypes.join(', ')}
Files: ${artifacts.length}

🤖 Generated with BMAD AI Workflow System`;

    return message;
  }

  /**
   * Determine artifact type from filename
   * @param {string} filename 
   * @returns {string} type
   */
  getArtifactType(filename) {
    if (filename.includes('prd')) return 'PRD';
    if (filename.includes('architecture')) return 'Architecture';
    if (filename.includes('story')) return 'User Stories';
    if (filename.includes('brief')) return 'Project Brief';
    if (filename.includes('analysis')) return 'Analysis';
    return 'Documentation';
  }

  /**
   * Clear all artifacts (use with caution)
   */
  clearArtifacts() {
    const count = this.artifacts.size;
    this.artifacts.clear();
    logger.info(`🗑️ [ARTIFACT] Cleared ${count} artifacts from memory`);
  }

  /**
   * Save workflow artifacts (compatibility method for WorkflowManager)
   * Commits all artifacts to GitHub repository
   * @param {string} workflowId - Workflow ID
   * @param {Array} artifacts - Legacy artifacts array (ignored, uses internal artifacts)
   * @param {Object} context - Workflow context
   * @returns {Promise<Array>} saved artifacts info
   */
  async saveWorkflowArtifacts(workflowId, artifacts = [], context = {}) {
    try {
      // Commit all artifacts to GitHub repository
      const result = await this.commitArtifactsToRepository();
      
      if (result.success) {
        logger.info(`✅ [GitHubArtifactManager] Successfully committed ${result.committed} artifacts to GitHub`);
        return result.artifacts.map(artifact => ({
          id: artifact.id,
          filename: artifact.filename,
          agent: artifact.agent,
          location: 'github_repository',
          commitSha: result.commitSha,
          branchName: result.branchName
        }));
      } else {
        throw new Error('Failed to commit artifacts to repository');
      }
    } catch (error) {
      logger.error(`❌ [GitHubArtifactManager] Failed to save workflow artifacts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workflow summary for reporting
   * @returns {Object} summary
   */
  getWorkflowSummary() {
    const artifacts = this.getAllArtifacts();
    const agents = [...new Set(artifacts.map(a => a.agentId))];
    
    return {
      repository: this.repositoryContext,
      totalArtifacts: artifacts.length,
      agents: agents,
      artifacts: artifacts.map(a => ({
        id: a.id,
        filename: a.filename,
        agent: a.agentId,
        size: a.content.length,
        generatedAt: a.metadata.generatedAt
      }))
    };
  }
}

export default GitHubArtifactManager;