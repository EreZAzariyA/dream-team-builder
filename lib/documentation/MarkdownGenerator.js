import { DocumentationManager } from './DocumentationManager.js';
import logger from '../utils/logger.js';

export class MarkdownGenerator {
  constructor() {
    this.docManager = new DocumentationManager();
  }

  /**
   * Generates Markdown content for a document based on a template and collected data.
   * @param {string} docType - The type of document (e.g., 'existing_documentation_or_analysis').
   * @param {object} data - The collected data to populate the template.
   * @returns {Promise<string>} The generated Markdown content.
   */
  async generateMarkdown(docType, data) {
    const templateFileName = `${docType}_tmpl.md`;
    let templateContent;
    try {
      templateContent = await this.docManager.getDocTemplate(templateFileName);
    } catch (error) {
      logger.error(`Failed to get template for ${docType}: ${error.message}`);
      throw new Error(`Could not generate Markdown: Template missing for ${docType}`);
    }

    let markdown = templateContent;
    for (const key in data) {
      if (Object.hasOwnProperty.call(data, key)) {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        markdown = markdown.replace(placeholder, data[key] || '');
      }
    }

    // Replace current_date placeholder
    markdown = markdown.replace(/{{current_date}}/g, new Date().toISOString().split('T')[0]);

    return markdown;
  }
}
