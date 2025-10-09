class PromptBuilder {
  constructor(agent, template, context) {
    this.agent = agent;
    this.template = template;
    this.context = context;
  }

  buildPrompt(agent, template, context, options = {}) {
    // Update instance properties if provided as parameters
    if (agent) this.agent = agent;
    if (template) this.template = template;
    if (context) this.context = context;
    this.options = options;
    
    return this.build();
  }

  build() {
    console.log('🔍 [PROMPT BUILDER DEBUG] Context:', {
      chatMode: this.context?.chatMode,
      workflowMode: this.context?.workflowMode,
      hasNotes: !!this.context?.notes,
      hasStepNotes: !!this.context?.stepNotes,
      hasTemplate: !!this.template,
      action: this.context?.action
    });
    
    // Chat mode uses fundamentally different prompt structure
    if (this.context?.chatMode) {
      console.log('🔍 [PROMPT BUILDER] Using buildChatPrompt');
      return this.buildChatPrompt();
    }
    
    // Workflow mode uses step instructions instead of templates
    // Check for workflow mode OR presence of step instructions (indicating workflow execution)
    if ((this.context?.workflowMode || this.context?.stepNotes) && !this.context?.chatMode) {
      console.log('🔍 [PROMPT BUILDER] Using buildWorkflowPrompt (workflow mode or step notes detected)');
      return this.buildWorkflowPrompt();
    }
    
    // If no template is provided, use chat mode
    if (!this.template) {
      console.log('🔍 [PROMPT BUILDER] No template, using buildChatPrompt');
      return this.buildChatPrompt();
    }
    
    // Document mode uses template-based structure
    console.log('🔍 [PROMPT BUILDER] Using buildDocumentPrompt');
    return this.buildDocumentPrompt();
  }

  buildChatPrompt() {
    const persona = this.agent?.persona || {};
    const agentName = this.agent?.agent?.name || this.agent?.name || 'AI Agent';
    const role = persona.role || this.agent?.agent?.title || 'AI Agent';
    const style = persona.style || 'Professional and helpful';
    
    let coreInstructions = '';
    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      coreInstructions = '\n\nCore Principles:\n' + persona.core_principles.map(principle => `- ${principle}`).join('\n');
    }

    const capabilities = this.agent?.agent?.whenToUse || 'Assist with various tasks';
    const userMessage = this.context?.userPrompt || 'Hello';

    return `You are ${agentName}, ${persona.identity || `an expert ${role}`}.

Style: ${style}
Capabilities: ${capabilities}${coreInstructions}

Respond naturally to the user's message: "${userMessage}"

If they asked for help (*help), explain your role and available capabilities in a conversational way.`;
  }

  buildWorkflowPrompt() {
    const persona = this.agent?.persona || {};
    const agentName = this.agent?.agent?.name || this.agent?.name || 'AI Agent';
    const role = persona.role || this.agent?.agent?.title || 'AI Agent';
    const style = persona.style || 'Professional and helpful';
    
    let coreInstructions = '';
    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      coreInstructions = '\n\nCore Principles:\n' + persona.core_principles.map(principle => `- ${principle}`).join('\n');
    }

    const capabilities = this.agent?.agent?.whenToUse || 'Assist with workflow tasks';
    const userMessage = this.context?.userPrompt || 'User request';
    const stepInstructions = this.context?.stepNotes || this.context?.notes || 'Complete the assigned task';
    const stepAction = this.context?.action || 'workflow step';

    console.log('🔍 [WORKFLOW PROMPT] Building prompt with:', {
      agentName,
      stepAction,
      stepInstructions: stepInstructions, // CRITICAL DEBUG: Show full instructions
      userMessage
    });
    
    // CRITICAL DEBUG: Check if Ask user instruction is included
    if (stepAction === 'classify enhancement scope') {
      console.log('🔍 [CLASSIFICATION PROMPT DEBUG] Full step instructions:', stepInstructions);
      console.log('🔍 [CLASSIFICATION PROMPT DEBUG] Contains "Ask user"?', stepInstructions.includes('Ask user'));
    }

    return `You are ${agentName}, ${persona.identity || `an expert ${role}`}.

Style: ${style}
Capabilities: ${capabilities}${coreInstructions}

WORKFLOW CONTEXT:
- User's Original Request: "${userMessage}"
- Current Step: ${stepAction}
- Step Instructions: ${stepInstructions}${this.getRepositoryContext()}

TASK: You are part of a workflow. Your role is to ${stepAction}. 

IMPORTANT: 
- Read the step instructions carefully
- Implement what they ask you to do
- Respond conversationally to the user as if you are helping them directly
- If the instructions contain "Ask user:" followed by quoted text, use that EXACT wording for the question
- For other questions not in quotes, ask them naturally in your own words
- Do not show the raw instructions to the user

Based on the step instructions above, provide your response:`;
  }

  getRepositoryContext() {
    // CRITICAL FIX: Check for GitHub repository context in the correct path from workflow context
    const githubRepo = this.context?.workflowContext?.githubRepository || 
                      this.context?.githubRepository || 
                      this.context?.workflow?.context?.githubRepository ||
                      this.context?.teamContext?.githubIntegration?.repository;
    
    const targetBranch = this.context?.workflowContext?.targetBranch || 
                        this.context?.targetBranch || 
                        this.context?.workflow?.context?.targetBranch ||
                        this.context?.teamContext?.githubIntegration?.targetBranch;

    if (githubRepo) {
      const repoName = githubRepo.full_name || githubRepo.name || 'repository';
      const branch = targetBranch || 'main';
      const repoUrl = githubRepo.html_url || `https://github.com/${repoName}`;
      
      // Include actual repository analysis if available
      const repoAnalysis = this.context?.workflowContext?.repositoryAnalysis || 
                          this.context?.repositoryAnalysis || 
                          githubRepo.analysis;
      
      // CRITICAL DEBUG: Log repository analysis availability
      console.log('🔍 [REPO ANALYSIS DEBUG] Full context structure:', {
        contextKeys: Object.keys(this.context || {}),
        workflowContextKeys: this.context?.workflowContext ? Object.keys(this.context.workflowContext) : 'none',
        hasWorkflowContext: !!this.context?.workflowContext,
        hasRepoAnalysisInWorkflowContext: !!this.context?.workflowContext?.repositoryAnalysis,
        hasRepoAnalysisInContext: !!this.context?.repositoryAnalysis,
        hasGithubRepoAnalysis: !!githubRepo.analysis,
        finalRepoAnalysis: !!repoAnalysis,
        repoAnalysisKeys: repoAnalysis ? Object.keys(repoAnalysis) : 'none'
      });
      
      let contextString = `

GITHUB REPOSITORY CONTEXT:
- Target Repository: ${repoName}
- Repository URL: ${repoUrl}
- Target Branch: ${branch}
- Repository Language: ${githubRepo.language || 'Not specified'}
- Repository Type: ${githubRepo.private ? 'Private' : 'Public'}`;

      if (repoAnalysis) {
        contextString += `

REPOSITORY ANALYSIS:
${this.formatRepositoryAnalysis(repoAnalysis)}`;
      } else {
        contextString += `

IMPORTANT: Repository analysis data is not available. You should base your analysis on the repository name and URL only. Do NOT make assumptions about the codebase structure or technologies without actual data.`;
      }
      
      return contextString;
    }
    
    return '';
  }

  formatRepositoryAnalysis(analysis) {
    if (!analysis) return 'No analysis data available';
    
    let formatted = '';
    
    if (analysis.repository) {
      formatted += `- Description: ${analysis.repository.description || 'No description'}\n`;
      formatted += `- Primary Language: ${analysis.repository.language || 'Not specified'}\n`;
      formatted += `- Size: ${analysis.repository.size ? (analysis.repository.size / 1024).toFixed(1) + ' MB' : 'Unknown'}\n`;
    }
    
    if (analysis.development) {
      formatted += `- Framework: ${analysis.development.framework || 'Unknown'}\n`;
      formatted += `- Languages: ${Object.keys(analysis.development.languages || {}).join(', ') || 'Unknown'}\n`;
      formatted += `- Package Managers: ${(analysis.development.package_managers || []).join(', ') || 'Unknown'}\n`;
      formatted += `- Testing Framework: ${analysis.development.testing_framework || 'Unknown'}\n`;
    }
    
    if (analysis.structure && Array.isArray(analysis.structure)) {
      formatted += `- Key Files: ${analysis.structure.slice(0, 10).map(f => f.name).join(', ')}\n`;
    }
    
    if (analysis.documentation?.readme) {
      const readmeSnippet = analysis.documentation.readme.content ? 
        analysis.documentation.readme.content.substring(0, 500) + '...' : 
        'README content not available';
      formatted += `- README Preview: ${readmeSnippet}\n`;
    }
    
    return formatted;
  }

  buildDocumentPrompt() {
    const promptTemplate = {
      system: this.buildSystemPrompt(),
      task: this.buildTaskPrompt(),
      context: this.buildContextPrompt(),
      format: this.buildFormatPrompt(),
      quality: this.buildQualityPrompt()
    };

    return this.assemblePrompt(promptTemplate);
  }

  buildSystemPrompt() {
    const persona = this.agent.persona || {};
    const role = persona.role || this.agent.agent?.title || 'AI Agent';
    const focus = persona.focus || 'Generate high-quality deliverables based on your expertise';
    const style = persona.style || 'Professional, thorough, and detail-oriented';
    
    // Use core principles from agent definition instead of hardcoded responsibilities
    let coreInstructions = '';
    if (persona.core_principles && Array.isArray(persona.core_principles)) {
      coreInstructions = '\n\nCore Principles:\n' + persona.core_principles.map(principle => `- ${principle}`).join('\n');
    }
    
    // Get capabilities from agent's whenToUse instead of hardcoded file creation text
    const capabilities = this.agent.agent?.whenToUse || 'Handle assigned tasks';
    
    return `You are ${persona.identity || `an expert ${role}`} with focus on: ${focus}.\n\nStyle: ${style}\n\nCapabilities: ${capabilities}${coreInstructions}`;
  }

  buildTaskPrompt() {
    // Safety check for template
    if (!this.template) {
      return `Your current task: Assist with the user's request: "${this.context?.userPrompt || 'No specific task provided'}"`;
    }
    
    const task = this.template?.template?.name || 'Document Generation';
    const sections = this.template?.sections || [];
    
    let taskPrompt = `Your current task: Create a ${task} for the project: \"${this.context.userPrompt}\"\n\nTemplate sections to complete:`

    sections.forEach((section, index) => {
      taskPrompt += `\n${index + 1}. ${section.title}`;
      if (section.instruction) {
        taskPrompt += `\n   Instructions: ${this.processTemplateVariables(section.instruction)}`;
      }
      if (section.examples) {
        taskPrompt += `\n   Examples: ${section.examples.join(', ')}`;
      }
    });

    return taskPrompt;
  }

  buildContextPrompt() {
    const parsedContext = this.parseUserPrompt(this.context.userPrompt || '');
    
    let contextPrompt = `Project Context:\n- Project Name: ${parsedContext.projectName}\n- Project Type: ${parsedContext.projectType}\n- User Requirements: ${parsedContext.originalPrompt}`;
    
    // Add GitHub repository context if available
    const repoContext = this.getRepositoryContext();
    if (repoContext) {
      contextPrompt += repoContext;
    }
    
    return contextPrompt;
  }

  buildFormatPrompt() {
    // Safety check for template
    if (!this.template) {
      return `Output Format: MARKDOWN\nFilename: response.md\nProvide a clear and helpful response.`;
    }
    
    const templateOutput = this.template?.template?.output || {};
    const filename = templateOutput.filename || 'document.md';
    const format = templateOutput.format || 'markdown';
    
    // Use template-defined format instead of hardcoded JSON structure
    if (format === 'json' && templateOutput.structure) {
      const structureKeys = Object.keys(templateOutput.structure).map(key => 
        `  - "${key}": ${templateOutput.structure[key]}`
      ).join('\n');
      
      return `Output Format: ${format.toUpperCase()}\nStructure:\n${structureKeys}\nFilename: ${filename}\nFollow template sections exactly.`;
    }
    
    return `Output Format: ${format.toUpperCase()}\nFilename: ${filename}\nFollow template sections exactly.`;
  }

  buildQualityPrompt() {
    // Safety check for template
    if (!this.template) {
      return `Quality Standards:\n- Provide accurate and helpful information\n- Be clear and professional\n- Address the user's specific needs`;
    }
    
    const templateName = this.template?.template?.name || 'deliverable';
    const templateQuality = this.template?.template?.quality || [];
    
    // Use template-defined quality standards instead of hardcoded ones
    if (templateQuality.length > 0) {
      return `Quality Standards:\n${templateQuality.map(standard => `- ${standard}`).join('\n')}`;
    }
    
    // Minimal fallback if no template quality standards
    return `Quality Standards:\n- Complete all required sections\n- Make content specific to user requirements\n- Use professional language for ${templateName}`;
  }

  assemblePrompt(promptTemplate) {
    // Safety check for template
    if (!this.template) {
      // No template - use simple chat format
      return `${promptTemplate.system}\n\n${promptTemplate.task}\n\nRespond to the user's request naturally and helpfully.`;
    }
    
    // Check if this is an interactive template
    if (this.template?.workflow?.mode === 'interactive') {
      // For interactive templates, ask the AI to start a conversation instead of generating complete content
      return `${promptTemplate.system}\n\n${promptTemplate.task}\n\n${promptTemplate.context}\n\nThis is an INTERACTIVE template. Do not generate the complete document. Instead, read the template instructions carefully and start the conversation as instructed. Begin by following the introduction section's guidance to interact with the user.`;
    } else {
      // Normal template - generate complete content
      return `${promptTemplate.system}\n\n${promptTemplate.task}\n\n${promptTemplate.context}\n\n${promptTemplate.format}\n\n${promptTemplate.quality}\n\nPlease generate the complete deliverable now:`;
    }
  }

  processTemplateVariables(instruction) {
    if (!instruction || typeof instruction !== 'string') {
      console.error('PromptBuilder: Invalid instruction provided:', instruction);
      return instruction || '';
    }

    const parsedContext = this.parseUserPrompt(this.context.userPrompt || '');
    
    return instruction
      ?.replace(/\{\{project_name\}\}/g, parsedContext.projectName || 'Your Project')
      ?.replace(/\{\{user_prompt\}\}/g, parsedContext.originalPrompt || this.context.userPrompt || 'User project requirements')
      ?.replace(/\{\{project_type\}\}/g, parsedContext.projectType || 'application');
  }

  parseUserPrompt(userPrompt) {
    // Extract project name from context if provided, otherwise use the prompt itself
    const projectName = this.context.projectName || 'User Project';
    const projectType = this.context.projectType || 'application';
    
    return {
      projectName,
      projectType,
      originalPrompt: userPrompt
    };
  }
}

module.exports = { PromptBuilder };
