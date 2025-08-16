/**
 * Document Generator for BMAD System
 * 
 * Provides template-based document generation utilities that work with 
 * existing BMAD templates and agent responses. Agents can use this when
 * they need to generate structured markdown documents from template data.
 */

const { TemplateEngine } = require('./TemplateEngine.js');
const path = require('path');

class DocumentGenerator {
  constructor() {
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate a document from a BMAD template and data
   * This works with existing BMAD YAML templates
   */
  async generateFromTemplate(templatePath, data) {
    try {
      // Resolve template path relative to .bmad-core/templates
      const fullTemplatePath = path.join(process.cwd(), '.bmad-core', 'templates', templatePath);
      
      const result = await this.templateEngine.renderTemplate(fullTemplatePath, data);
      
      return {
        content: result.content,
        filename: result.filename,
        format: result.format,
        metadata: result.metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate document from template ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Generate markdown from template string and data
   * Useful for quick template generation
   */
  async generateFromString(templateString, data) {
    try {
      const content = await this.templateEngine.renderFromString(templateString, data);
      return {
        content,
        format: 'markdown'
      };
    } catch (error) {
      throw new Error(`Failed to generate document from template string: ${error.message}`);
    }
  }

  /**
   * Validate template syntax before using
   */
  validateTemplate(templateContent) {
    return this.templateEngine.validateTemplate(templateContent);
  }

  /**
   * Convert markdown to HTML if needed
   */
  markdownToHtml(markdown) {
    return this.templateEngine.markdownToHtml(markdown);
  }

  /**
   * Get available template helpers for documentation
   */
  getAvailableHelpers() {
    return this.templateEngine.getAvailableHelpers();
  }
}

module.exports = { DocumentGenerator };