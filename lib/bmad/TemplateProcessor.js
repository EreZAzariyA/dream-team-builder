/**
 * BMAD Template Processing Engine
 * 
 * Parses and processes BMAD's YAML-based document templates to generate interactive documents.
 * This engine is a cornerstone of Phase 2, enabling document-driven workflows.
 * 
 * Key Features:
 * - Parses complex YAML document templates.
 * - Handles variable substitution (e.g., {{variable}}).
 * - Processes conditional and repeatable sections.
 * - Manages nested section hierarchy.
 * - Integrates the mandatory Elicitation System (`elicit: true`).
 * - Respects agent permissions for section editing.
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { validateFilePath } = require('../utils/fileValidator');
import logger from '../utils/logger.js';

class TemplateProcessor {
  constructor(configurationManager, agentActivationEngine) {
    this.configManager = configurationManager;
    this.agentEngine = agentActivationEngine;
    this.templateCache = new Map();
  }

  /**
   * Load and parse a document template from the filesystem.
   * @param {string} templateName - The name of the template (e.g., 'prd-tmpl').
   * @returns {Object} The parsed template object.
   */
  async loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatesPath = this.configManager.getBmadCorePaths().templates;
    const templatePath = path.join(templatesPath, `${templateName}.yaml`);
    logger.info(`📄 [TEMPLATE] Loading template: ${templatePath}`);

    try {
      validateFilePath(templatePath);
      const content = await fs.readFile(templatePath, 'utf8');
      const template = yaml.load(content);
      
      this.validateTemplate(template, templateName);
      this.templateCache.set(templateName, template);
      
      logger.info(`✅ [TEMPLATE] Successfully loaded and validated template: ${templateName}`);
      return template;

    } catch (error) {
      logger.error(`❌ [TEMPLATE] Failed to load template ${templateName}:`, error.message);
      throw new Error(`Failed to load or parse template ${templateName}: ${error.message}`);
    }
  }

  /**
   * Validate the basic structure of a parsed template.
   * @param {Object} template - The parsed template object.
   * @param {string} templateName - The name of the template for logging.
   */
  validateTemplate(template, templateName) {
    if (!template || typeof template !== 'object') {
      throw new Error(`Template ${templateName} is not a valid object.`);
    }
    if (!template.template || !template.template.id || !template.template.name) {
      throw new Error(`Template ${templateName} is missing required metadata (id, name).`);
    }
    if (!template.sections || !Array.isArray(template.sections)) {
      throw new Error(`Template ${templateName} is missing a valid 'sections' array.`);
    }
  }

  /**
   * Process a template to generate a document or elicit information.
   * This is the main entry point for the engine.
   * @param {string} templateName - The name of the template to process.
   * @param {Object} context - An object containing data for variable substitution.
   * @param {string} activeAgentId - The ID of the agent performing the action.
   * @returns {Object} An object containing the generated document or elicitation details.
   */
  async process(templateName, context, activeAgentId) {
    const template = await this.loadTemplate(templateName);
    
    // CRITICAL FIX: Check for interactive mode at workflow level
    if (template.workflow?.mode === 'interactive') {
      logger.info(`🔄 [TEMPLATE] Interactive template detected: ${templateName}`);
      
      // For interactive templates, we should start with the introduction section
      // and initiate conversational flow rather than trying to generate all content
      const introSection = template.sections.find(s => s.id === 'introduction');
      if (introSection) {
        // Let the agent handle the interaction naturally using their built-in capabilities
        const naturalInstruction = introSection.instruction || `Let's work together to create a comprehensive project brief. I'll guide you through the process.`;

        return {
          status: 'elicitation_required',
          elicitation: {
            sectionId: 'introduction',
            sectionTitle: 'Project Brief Setup', 
            instruction: naturalInstruction,
            agentId: activeAgentId,
            agentName: 'Project Analyst',
            templateName: templateName,
            interactiveMode: true,
            customElicitation: template.workflow.custom_elicitation || null
          },
          partialDocument: `# ${this.replaceVariables(template.template.title || template.template.name, context)}\n`
        };
      }
    }

    const output = [];
    let elicitationRequired = null;

    // Process the main title
    const title = this.replaceVariables(template.template.title || template.template.name, context);
    output.push(`# ${title}\n`);

    // Process all top-level sections
    for (const section of template.sections) {
      const sectionResult = await this.processSection(section, context, activeAgentId, 1);
      
      if (sectionResult.elicitation) {
        elicitationRequired = sectionResult.elicitation;
        break; // Stop processing if elicitation is required
      }
      
      output.push(sectionResult.content);
    }

    if (elicitationRequired) {
      return {
        status: 'elicitation_required',
        elicitation: elicitationRequired,
        partialDocument: output.join('\n'),
      };
    }

    return {
      status: 'completed',
      document: output.join('\n'),
    };
  }

  /**
   * Recursively process a single section of the template.
   * @param {Object} section - The section object from the template.
   * @param {Object} context - The data context for variable substitution.
   * @param {string} activeAgentId - The active agent's ID for permission checks.
   * @param {number} level - The current heading level for markdown.
   * @returns {Object} An object with the generated content and any elicitation details.
   */
  async processSection(section, context, activeAgentId, level) {
    // Implement permission checks using this.agentEngine
    if (!this.agentEngine.canAgentEditSection(activeAgentId, section.id)) {
      // If the agent doesn't have permission, we can either return nothing
      // or return a placeholder indicating the restriction.
      return { content: `<!-- Agent ${activeAgentId} does not have permission to edit this section. -->\n` };
    }

    // Implement conditional logic
    if (section.condition && !this.evaluateCondition(section.condition, context)) {
      return { content: '' };
    }
    
    let content = '';
    const title = this.replaceVariables(section.title, context);
    content += `${'#'.repeat(level + 1)} ${title}\n\n`;

    // Process the instruction for the LLM
    const instruction = this.replaceVariables(section.instruction, context);

    // Check for elicitation
    if (section.elicit) {
      const elicitationMethods = await this.getElicitationMethods();
      return {
        elicitation: {
          sectionId: section.id,
          sectionTitle: title,
          instruction: instruction,
          choices: elicitationMethods,
        }
      };
    }
    
    // Implement different section types
    switch (section.type) {
      case 'bullet-list':
        content += this.processList(section, context, '*');
        break;
      case 'numbered-list':
        content += this.processList(section, context, '1.');
        break;
      case 'table':
        content += this.processTable(section, context);
        break;
      case 'code-block':
        content += this.processCodeBlock(section, context);
        break;
      default:
        content += `${instruction || 'Content to be generated by LLM.'}\n\n`;
        break;
    }

    // Process nested sections
    if (section.sections && Array.isArray(section.sections)) {
      for (const subSection of section.sections) {
        const subSectionResult = await this.processSection(subSection, context, activeAgentId, level + 1);
        if (subSectionResult.elicitation) {
          return subSectionResult; // Propagate elicitation up
        }
        content += subSectionResult.content;
      }
    }

    return { content };
  }

  /**
   * Replace placeholder variables in a string with values from the context.
   * @param {string} text - The string containing variables (e.g., "Title for {{project_name}}").
   * @param {Object} context - The data context.
   * @returns {string} The string with variables replaced.
   */
  replaceVariables(text = '', context = {}) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      return context[variableName] || match;
    });
  }

  /**
   * Load the available elicitation methods.
   * @returns {Array<Object>} A list of elicitation methods.
   */
  async getElicitationMethods() {
    // This is a placeholder. In a real implementation, this would read
    // from .bmad-core/data/elicitation-methods.md or a similar config file.
    return [
      { id: 'proceed', title: 'Proceed as instructed' },
      { id: 'clarify', title: 'Ask clarifying questions' },
      { id: 'brainstorm', title: 'Brainstorm alternative approaches' },
      { id: 'analogy', title: 'Explain with an analogy' },
    ];
  }
  
  /**
   * Evaluates a condition string from the template.
   * @param {string} condition - The condition string (e.g., "has_ui_requirements").
   * @param {Object} context - The current workflow context.
   * @returns {boolean} - The result of the condition evaluation.
   */
  evaluateCondition(condition, context) {
    // Placeholder for condition evaluation logic
    // This would check the context for flags like `context.has_ui_requirements === true`
    return true;
  }
}

module.exports = { TemplateProcessor };
