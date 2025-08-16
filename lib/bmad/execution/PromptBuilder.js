class PromptBuilder {
  constructor(agent, template, context) {
    this.agent = agent;
    this.template = template;
    this.context = context;
  }

  build() {
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
    const task = this.template.template?.name || 'Document Generation';
    const sections = this.template.sections || [];
    
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
    
    return `Project Context:\n- Project Name: ${parsedContext.projectName}\n- Project Type: ${parsedContext.projectType}\n- User Requirements: ${parsedContext.originalPrompt}`;
  }

  buildFormatPrompt() {
    const templateOutput = this.template.template?.output || {};
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
    const templateName = this.template.template?.name || 'deliverable';
    const templateQuality = this.template.template?.quality || [];
    
    // Use template-defined quality standards instead of hardcoded ones
    if (templateQuality.length > 0) {
      return `Quality Standards:\n${templateQuality.map(standard => `- ${standard}`).join('\n')}`;
    }
    
    // Minimal fallback if no template quality standards
    return `Quality Standards:\n- Complete all required sections\n- Make content specific to user requirements\n- Use professional language for ${templateName}`;
  }

  assemblePrompt(promptTemplate) {
    // Check if this is an interactive template
    if (this.template.workflow?.mode === 'interactive') {
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
