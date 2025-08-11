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
    let expertiseString = '';
    if (persona.expertise && typeof persona.expertise === 'string') {
      expertiseString = persona.expertise;
    } else if (this.agent.commands && Array.isArray(this.agent.commands)) {
      expertiseString = this.agent.commands.map(cmd => {
        if (typeof cmd === 'string') {
          return cmd.split(':')[0];
        } else if (typeof cmd === 'object' && cmd !== null) {
          return Object.keys(cmd)[0];
        }
        return 'unknown';
      }).join(', ');
    }
    
    return `You are an expert ${role} with specialized knowledge in: ${expertiseString}.\n\nYour role in this BMAD workflow is to:\n- ${persona.responsibilities || 'Generate high-quality deliverables based on your expertise'}\n- Follow best practices for ${role} work\n- Ensure deliverables meet professional standards\n- Collaborate effectively with other team members in the workflow\n\nPersonality traits: ${persona.traits || 'Professional, thorough, and detail-oriented'}`;
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
    const filename = this.template.template?.output?.filename || 'document.md';
    
    return `Output Format Requirements:\n- Format: JSON\n- The JSON object must contain the following top-level keys:\n  - \"summary\": A concise, 1-2 sentence summary of the response.\n  - \"main_response\": The primary, detailed content of your response, formatted in Markdown.\n  - \"key_points\": A Markdown-formatted bulleted list of key takeaways or important considerations.\n- Ensure the JSON is valid and properly escaped.\n- Filename: ${filename}\n- Structure: Follow the template sections exactly within the 'main_response' field.\n- Quality: Professional-grade deliverable ready for handoff to next agent`;
  }

  buildQualityPrompt() {
    return `Quality Standards:\n- All sections must be complete and substantive.\n- Content must be specific to the user's project requirements.\n- Use professional language appropriate for ${this.template.template?.name || 'business documentation'}.\n- Ensure consistency with BMAD workflow standards.\n- Include all required elements from template instructions.\n- **CRITICAL:** Adhere strictly to the specified JSON output format, providing content for 'summary', 'main_response', and 'key_points'.`;
  }

  assemblePrompt(promptTemplate) {
    return `${promptTemplate.system}\n\n${promptTemplate.task}\n\n${promptTemplate.context}\n\n${promptTemplate.format}\n\n${promptTemplate.quality}\n\nPlease generate the complete deliverable now:`
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
    const prompt = (userPrompt || '').toLowerCase();
    const features = [];
    let projectName = 'Project';
    let projectType = 'web_app';

    const todoMatch = prompt.match(/to-?do\s+app/i);
    const ecommerceMatch = prompt.match(/e-?commerce|shop|store/i);
    const blogMatch = prompt.match(/blog|cms/i);
    
    if (todoMatch) {
      projectName = 'To-Do App';
      projectType = 'task_management';
    } else if (ecommerceMatch) {
      projectName = 'E-Commerce Platform';
      projectType = 'ecommerce';
    } else if (blogMatch) {
      projectName = 'Blog/CMS';
      projectType = 'content_management';
    }

    if (prompt.includes('jwt') || prompt.includes('auth')) {
      features.push('authentication');
    }
    if (prompt.includes('registration') || prompt.includes('signup') || prompt.includes('register')) {
      features.push('user_registration');
    }
    if (prompt.includes('task') || prompt.includes('todo') || prompt.includes('management')) {
      features.push('task_management');
    }
    if (prompt.includes('modern ui') || prompt.includes('clean ui') || prompt.includes('responsive')) {
      features.push('modern_ui');
    }
    if (prompt.includes('api') || prompt.includes('rest') || prompt.includes('endpoint')) {
      features.push('api_backend');
    }
    if (prompt.includes('database') || prompt.includes('mongodb') || prompt.includes('mysql') || prompt.includes('postgres')) {
      features.push('database');
    }
    if (prompt.includes('real-time') || prompt.includes('websocket') || prompt.includes('live')) {
      features.push('real_time');
    }

    return {
      projectName,
      projectType,
      features,
      originalPrompt: userPrompt
    };
  }
}

module.exports = { PromptBuilder };
