/**
 * Artifact Management Service
 * Handles artifact creation, storage, and repository integration
 */

import logger from '../../utils/logger.js';

class ArtifactManager {
  constructor(gitService) {
    this.gitService = gitService;
    this.repositoryContext = null; // For compatibility with GitHubArtifactManager
  }

  /**
   * Initialize with configuration - compatibility method
   */
  async initialize(configOrContext, agentLoader = null) {
    // Handle both old GitHubArtifactManager API and direct repository context
    if (configOrContext && typeof configOrContext === 'object') {
      // If it looks like repository context (has owner, name, accessToken)
      if (configOrContext.owner || configOrContext.accessToken) {
        this.repositoryContext = configOrContext;
        logger.info(`✅ ArtifactManager initialized with repository context`);
      } else {
        // Otherwise, it might be a configuration manager
        logger.info(`✅ ArtifactManager initialized with configuration manager`);
      }
    }
    
    // Initialize git service if available
    if (this.gitService && this.repositoryContext?.accessToken) {
      try {
        await this.gitService.initialize({
          accessToken: this.repositoryContext.accessToken,
          owner: this.repositoryContext.owner,
          repo: this.repositoryContext.name
        });
        logger.info(`✅ GitIntegrationService initialized for ${this.repositoryContext.owner}/${this.repositoryContext.name}`);
      } catch (error) {
        logger.warn(`⚠️ Failed to initialize GitIntegrationService: ${error.message}`);
      }
    }
  }

  /**
   * Save approved artifact with metadata
   */
  async saveArtifact(artifactName, aiResponse, workflow, agent) {
    const artifactData = {
      name: artifactName,
      content: aiResponse.content,
      metadata: {
        agent: agent.name || agent.role,
        provider: aiResponse.provider,
        model: aiResponse.model,
        createdAt: new Date(),
        step: workflow.bmadWorkflowData.currentStep,
        stepType: 'agent',
        aiMetrics: aiResponse.usage,
        userApproved: true,
        validation: aiResponse.validation || {
          isValid: true,
          confidence: 0.8,
          warnings: [],
          errors: [],
          sanitized: false
        }
      }
    };
    
    // Store in workflow context
    if (!workflow.context.artifacts) {
      workflow.context.artifacts = new Map();
    }
    workflow.context.artifacts.set(artifactName, artifactData);
    
    // Save to user's repository if available
    if (workflow.context?.githubContext?.gitService) {
      try {
        await this.saveArtifactToRepository(workflow.context.githubContext, artifactName, aiResponse.content, workflow);
        logger.info(`📄 Artifact ${artifactName} saved to user repository (${aiResponse.content.length} chars)`);
        artifactData.metadata.savedToRepository = true;
      } catch (repoError) {
        logger.warn(`⚠️ Could not save ${artifactName} to repository: ${repoError.message}`);
        artifactData.metadata.repositoryError = repoError.message;
      }
    } else {
      logger.info(`📄 Created artifact: ${artifactName} (${aiResponse.content.length} chars) - stored in workflow only`);
      artifactData.metadata.savedToRepository = false;
    }

    return artifactData;
  }

  /**
   * Save artifact to GitHub repository
   */
  async saveArtifactToRepository(githubContext, artifactName, content, workflow) {
    const { gitService, repository, targetBranch } = githubContext;
    
    if (!gitService || !repository) {
      throw new Error('GitHub context not properly configured');
    }

    try {
      // Determine file path based on artifact name and type
      const filePath = this.determineFilePath(artifactName, workflow);
      
      // Create or update file in repository
      const result = await gitService.createOrUpdateFile(
        repository.owner.login,
        repository.name,
        filePath,
        content,
        `Add ${artifactName} via BMAD workflow`,
        targetBranch || 'main'
      );

      logger.info(`✅ Saved ${artifactName} to repository at ${filePath}`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to save artifact to repository: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determine appropriate file path for artifact
   */
  determineFilePath(artifactName, workflow) {
    // Create workflow-specific directory
    const workflowDir = `bmad-output/${workflow.template || 'workflow'}`;
    
    // Use artifact name as-is if it has an extension, otherwise add .md
    const fileName = artifactName.includes('.') ? artifactName : `${artifactName}.md`;
    
    return `${workflowDir}/${fileName}`;
  }

  /**
   * Get all artifacts for a workflow
   */
  async getWorkflowArtifacts(workflowId, lifecycleManager) {
    const workflow = await lifecycleManager.loadWorkflow(workflowId);
    return workflow?.context?.artifacts || new Map();
  }

  /**
   * Get specific artifact
   */
  async getArtifact(workflowId, artifactName, lifecycleManager) {
    const artifacts = await this.getWorkflowArtifacts(workflowId, lifecycleManager);
    return artifacts.get(artifactName);
  }

  /**
   * Update artifact content
   */
  async updateArtifact(workflowId, artifactName, newContent, lifecycleManager) {
    const workflow = await lifecycleManager.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!workflow.context?.artifacts?.has(artifactName)) {
      throw new Error(`Artifact ${artifactName} not found in workflow`);
    }

    const artifact = workflow.context.artifacts.get(artifactName);
    artifact.content = newContent;
    artifact.metadata.updatedAt = new Date();
    
    workflow.context.artifacts.set(artifactName, artifact);
    await lifecycleManager.saveWorkflow(workflow);

    // Update in repository if applicable
    if (workflow.context?.githubContext?.gitService) {
      try {
        await this.saveArtifactToRepository(workflow.context.githubContext, artifactName, newContent, workflow);
        logger.info(`📝 Updated ${artifactName} in repository`);
      } catch (error) {
        logger.warn(`⚠️ Could not update ${artifactName} in repository: ${error.message}`);
      }
    }

    return artifact;
  }

  /**
   * Delete artifact
   */
  async deleteArtifact(workflowId, artifactName, lifecycleManager) {
    const workflow = await lifecycleManager.loadWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!workflow.context?.artifacts?.has(artifactName)) {
      throw new Error(`Artifact ${artifactName} not found in workflow`);
    }

    workflow.context.artifacts.delete(artifactName);
    await lifecycleManager.saveWorkflow(workflow);

    logger.info(`🗑️ Deleted artifact ${artifactName} from workflow ${workflowId}`);
    return true;
  }

  /**
   * Get artifact statistics
   */
  getArtifactStats(artifacts) {
    if (!artifacts || artifacts.size === 0) {
      return { count: 0, totalSize: 0, types: {} };
    }

    let totalSize = 0;
    const types = {};
    
    for (const [name, artifact] of artifacts.entries()) {
      totalSize += artifact.content?.length || 0;
      
      const extension = name.split('.').pop() || 'unknown';
      types[extension] = (types[extension] || 0) + 1;
    }

    return {
      count: artifacts.size,
      totalSize,
      types,
      averageSize: artifacts.size > 0 ? Math.round(totalSize / artifacts.size) : 0
    };
  }
}

export default ArtifactManager;