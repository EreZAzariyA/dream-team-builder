/**
 * Centralized Context Builder
 * Systematically builds AI context from all available sources
 * 
 * Responsibilities:
 * - Repository analysis integration
 * - Workflow history and artifacts
 * - User interaction context
 * - Agent persona and capabilities
 * - Step requirements and outputs
 */

import logger from '../../utils/logger.js';

class ContextBuilder {
  constructor(options = {}) {
    this.maxContentLength = options.maxContentLength || 2000;
    this.includeFileContents = options.includeFileContents || false;
    this.maxHistoryItems = options.maxHistoryItems || 10;
  }

  /**
   * Build comprehensive agent execution context
   */
  async buildAgentContext(agent, step, workflow, options = {}) {
    logger.info(`🔧 [CONTEXT] Building agent context for ${agent.name || step.agent}`);
    
    const context = {
      // Agent identity and capabilities
      agent: this.buildAgentIdentity(agent),
      
      // Current step context
      step: this.buildStepContext(step),
      
      // Workflow state and progress
      workflow: this.buildWorkflowContext(workflow),
      
      // Repository and codebase context
      repository: await this.buildRepositoryContext(workflow.repositoryAnalysis),
      
      // Artifacts and previous outputs
      artifacts: this.buildArtifactsContext(workflow.context?.artifacts),
      
      // User interaction history
      history: this.buildHistoryContext(workflow.context?.elicitationHistory),
      
      // Requirements and dependencies
      requirements: this.buildRequirementsContext(step, workflow.context?.artifacts)
    };

    logger.info(`✅ [CONTEXT] Built comprehensive context: ${Object.keys(context).length} sections`);
    return context;
  }

  /**
   * Build workflow routing context for AI decision making
   */
  async buildRoutingContext(workflow, currentStep) {
    logger.info(`🔧 [CONTEXT] Building routing context for ${currentStep.step || 'routing_decision'}`);
    
    const context = {
      // Workflow metadata
      workflowTemplate: workflow.template,
      workflowName: workflow.title,
      userPrompt: workflow.userPrompt,
      
      // Current state
      currentStep: workflow.bmadWorkflowData?.currentStep || 0,
      totalSteps: workflow.bmadWorkflowData?.sequence?.length || 0,
      currentStepDefinition: currentStep,
      
      // Progress tracking
      completedSteps: this.extractCompletedSteps(workflow),
      artifacts: this.buildArtifactsSummary(workflow.context?.artifacts),
      
      // Repository context (condensed for routing)
      repository: await this.buildRepositoryContextCondensed(workflow.repositoryAnalysis),
      
      // Decision history
      previousDecisions: workflow.context?.routingDecisions || {},
      
      // User interactions
      userResponses: this.extractUserResponses(workflow.context?.elicitationHistory)
    };

    logger.info(`✅ [CONTEXT] Built routing context with ${context.artifacts ? Object.keys(context.artifacts).length : 0} artifacts`);
    return context;
  }

  /**
   * Build agent identity and capabilities
   */
  buildAgentIdentity(agent) {
    return {
      name: agent.name || agent.role || 'Assistant',
      title: agent.title || agent.name || 'AI Agent',
      role: agent.persona?.role || agent.role || 'assistant',
      expertise: agent.persona?.focus || agent.whenToUse || 'general assistance',
      style: agent.persona?.style || 'professional',
      principles: agent.persona?.core_principles || [],
      capabilities: this.extractAgentCapabilities(agent)
    };
  }

  /**
   * Build current step context
   */
  buildStepContext(step) {
    return {
      stepName: step.step || 'unnamed_step',
      action: step.action || 'execute',
      creates: step.creates || null,
      requires: step.requires || [],
      notes: step.notes || '',
      condition: step.condition || null,
      isArtifactStep: !!(step.creates && step.creates.trim()),
      isDecisionStep: !!(step.routes || step.condition),
      isInformationGathering: !!(step.action && !step.creates)
    };
  }

  /**
   * Build workflow state context
   */
  buildWorkflowContext(workflow) {
    return {
      id: workflow.workflowId,
      template: workflow.template,
      title: workflow.title,
      userPrompt: workflow.userPrompt,
      status: workflow.status,
      progress: {
        currentStep: workflow.bmadWorkflowData?.currentStep || 0,
        totalSteps: workflow.bmadWorkflowData?.sequence?.length || 0,
        percentage: this.calculateProgress(workflow)
      },
      startedAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    };
  }

  /**
   * Build comprehensive repository context
   */
  async buildRepositoryContext(repositoryAnalysis) {
    if (!repositoryAnalysis) {
      return { available: false, reason: 'No repository analysis provided' };
    }

    return {
      available: true,
      name: repositoryAnalysis.repository?.fullName || repositoryAnalysis.fullName || 'Unknown Repository',
      description: repositoryAnalysis.repository?.description || repositoryAnalysis.summary || 'No description available',
      
      // Metrics and structure
      metrics: {
        files: repositoryAnalysis.metrics?.fileCount || 0,
        lines: repositoryAnalysis.metrics?.totalLines || 0,
        size: repositoryAnalysis.metrics?.totalSize || 0,
        languages: this.formatLanguages(repositoryAnalysis.metrics?.languages)
      },
      
      // Key files and structure
      structure: this.buildStructureContext(repositoryAnalysis),
      
      // Framework and technology detection
      technology: {
        framework: repositoryAnalysis.development?.framework || 'Unknown',
        languages: repositoryAnalysis.development?.languages || {},
        dependencies: repositoryAnalysis.dependencies || []
      },
      
      // File access information
      fileAccess: {
        indexed: repositoryAnalysis.fileIndex?.length || 0,
        searchable: !!(repositoryAnalysis.fileIndex && repositoryAnalysis.fileIndex.length > 0),
        lastAnalyzed: repositoryAnalysis.updatedAt || repositoryAnalysis.analyzedAt
      }
    };
  }

  /**
   * Build condensed repository context for routing decisions
   */
  async buildRepositoryContextCondensed(repositoryAnalysis) {
    if (!repositoryAnalysis) return null;

    return {
      name: repositoryAnalysis.repository?.fullName || repositoryAnalysis.fullName,
      summary: repositoryAnalysis.summary || '',
      size: `${repositoryAnalysis.metrics?.fileCount || 0} files, ${repositoryAnalysis.metrics?.totalLines?.toLocaleString() || 0} lines`,
      framework: repositoryAnalysis.development?.framework,
      complexity: this.assessComplexity(repositoryAnalysis.metrics)
    };
  }

  /**
   * Build artifacts context with content summaries
   */
  buildArtifactsContext(artifacts) {
    if (!artifacts || artifacts.size === 0) {
      return { available: false, reason: 'No artifacts created yet' };
    }

    const artifactsList = {};
    for (const [name, artifact] of artifacts.entries()) {
      artifactsList[name] = {
        name: artifact.name,
        type: this.classifyArtifact(name),
        size: artifact.content?.length || 0,
        preview: this.createContentPreview(artifact.content),
        metadata: artifact.metadata,
        createdAt: artifact.metadata?.createdAt
      };
    }

    return {
      available: true,
      count: artifacts.size,
      artifacts: artifactsList
    };
  }

  /**
   * Build artifacts summary for routing (condensed)
   */
  buildArtifactsSummary(artifacts) {
    if (!artifacts || artifacts.size === 0) return {};

    const summary = {};
    for (const [name, artifact] of artifacts.entries()) {
      summary[name] = {
        name: artifact.name,
        type: this.classifyArtifact(name),
        size: artifact.content?.length || 0,
        preview: artifact.content?.substring(0, 200) + '...' || ''
      };
    }
    return summary;
  }

  /**
   * Build interaction history context
   */
  buildHistoryContext(elicitationHistory) {
    if (!elicitationHistory || elicitationHistory.length === 0) {
      return { available: false, reason: 'No interaction history' };
    }

    const recentHistory = elicitationHistory
      .slice(-this.maxHistoryItems)
      .map(item => ({
        type: item.type || 'interaction',
        agent: item.agent || 'system',
        message: item.message || '',
        userResponse: item.userResponse || '',
        timestamp: item.timestamp
      }));

    return {
      available: true,
      count: elicitationHistory.length,
      recent: recentHistory,
      summary: this.summarizeInteractionHistory(recentHistory)
    };
  }

  /**
   * Build requirements context based on step dependencies
   */
  buildRequirementsContext(step, artifacts) {
    if (!step.requires) {
      return { hasRequirements: false };
    }

    const requirements = Array.isArray(step.requires) ? step.requires : [step.requires];
    const fulfilled = {};
    const missing = [];

    requirements.forEach(req => {
      if (artifacts && artifacts.has(req)) {
        fulfilled[req] = {
          name: req,
          available: true,
          artifact: artifacts.get(req)
        };
      } else {
        missing.push(req);
      }
    });

    return {
      hasRequirements: true,
      total: requirements.length,
      fulfilled: Object.keys(fulfilled).length,
      missing: missing.length,
      requirements: fulfilled,
      missingRequirements: missing
    };
  }

  // Helper methods
  extractAgentCapabilities(agent) {
    const capabilities = [];
    
    if (agent.commands) {
      if (agent.commands instanceof Map) {
        capabilities.push(...Array.from(agent.commands.keys()));
      } else if (typeof agent.commands === 'object') {
        capabilities.push(...Object.keys(agent.commands));
      }
    }
    
    return capabilities;
  }

  formatLanguages(languages) {
    if (!languages) return [];
    
    if (languages instanceof Map) {
      return Array.from(languages.entries())
        .sort(([,a], [,b]) => (b.percentage || 0) - (a.percentage || 0))
        .slice(0, 5)
        .map(([lang, stats]) => ({
          name: lang,
          percentage: stats.percentage || 0,
          lines: stats.lines || 0
        }));
    }
    
    return [];
  }

  buildStructureContext(repositoryAnalysis) {
    if (!repositoryAnalysis.metrics?.largestFiles) return {};

    return {
      keyFiles: repositoryAnalysis.metrics.largestFiles.slice(0, 10).map(f => ({
        path: f.path,
        language: f.language,
        lines: f.lines,
        size: f.size || 0
      })),
      directories: repositoryAnalysis.structure?.directories || [],
      patterns: this.identifyPatterns(repositoryAnalysis.metrics?.largestFiles || [])
    };
  }

  assessComplexity(metrics) {
    if (!metrics) return 'unknown';
    
    const fileCount = metrics.fileCount || 0;
    const lineCount = metrics.totalLines || 0;
    const langCount = metrics.languageCount || 0;
    
    if (fileCount < 10 && lineCount < 1000) return 'simple';
    if (fileCount < 50 && lineCount < 10000) return 'moderate';
    if (fileCount < 200 && lineCount < 50000) return 'complex';
    return 'very-complex';
  }

  classifyArtifact(name) {
    if (name.endsWith('.md')) return 'documentation';
    if (name.includes('architecture')) return 'architecture';
    if (name.includes('prd') || name.includes('requirements')) return 'requirements';
    if (name.includes('story') || name.includes('epic')) return 'user-story';
    if (name.includes('test')) return 'test';
    return 'document';
  }

  createContentPreview(content) {
    if (!content) return '';
    return content.substring(0, this.maxContentLength) + (content.length > this.maxContentLength ? '...' : '');
  }

  calculateProgress(workflow) {
    if (!workflow.bmadWorkflowData?.sequence) return 0;
    const current = workflow.bmadWorkflowData.currentStep || 0;
    const total = workflow.bmadWorkflowData.sequence.length;
    return Math.round((current / total) * 100);
  }

  extractCompletedSteps(workflow) {
    // Extract completed steps from workflow history
    return workflow.bmadWorkflowData?.currentStep || 0;
  }

  extractUserResponses(elicitationHistory) {
    if (!elicitationHistory) return [];
    
    return elicitationHistory
      .filter(item => item.userResponse)
      .slice(-5)
      .map(item => ({
        question: item.message || '',
        response: item.userResponse || '',
        timestamp: item.timestamp
      }));
  }

  identifyPatterns(largestFiles) {
    const patterns = {
      hasTests: largestFiles.some(f => f.path.includes('test')),
      hasConfig: largestFiles.some(f => f.path.includes('config') || f.path.includes('.json')),
      hasComponents: largestFiles.some(f => f.path.includes('component')),
      hasAPI: largestFiles.some(f => f.path.includes('api') || f.path.includes('route')),
      hasDatabase: largestFiles.some(f => f.path.includes('model') || f.path.includes('schema'))
    };
    
    return patterns;
  }

  summarizeInteractionHistory(history) {
    if (!history.length) return 'No interactions';
    
    const agentCounts = {};
    history.forEach(item => {
      agentCounts[item.agent] = (agentCounts[item.agent] || 0) + 1;
    });
    
    const primaryAgent = Object.entries(agentCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'system';
    
    return `${history.length} interactions, primarily with ${primaryAgent}`;
  }
}

export default ContextBuilder;