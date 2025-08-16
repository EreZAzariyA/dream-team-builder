import Handlebars from 'handlebars';
import MarkdownIt from 'markdown-it';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export class TemplateEngine {
  constructor() {
    this.handlebars = Handlebars.create();
    this.markdown = new MarkdownIt({
      html: true,
      breaks: true,
      linkify: true
    });
    
    this.registerHelpers();
  }

  registerHelpers() {
    // Helper for markdown formatting
    this.handlebars.registerHelper('markdown', (text) => {
      return new this.handlebars.SafeString(this.markdown.render(text || ''));
    });

    // Helper for conditional sections
    this.handlebars.registerHelper('if_exists', function(value, options) {
      if (value && value.length > 0) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper for iteration with index
    this.handlebars.registerHelper('each_with_index', function(array, options) {
      let result = '';
      for (let i = 0; i < array.length; i++) {
        result += options.fn({
          ...array[i],
          index: i,
          first: i === 0,
          last: i === array.length - 1
        });
      }
      return result;
    });

    // Helper for date formatting
    this.handlebars.registerHelper('date_format', (date, format) => {
      const d = new Date(date);
      if (format === 'iso') return d.toISOString().split('T')[0];
      if (format === 'full') return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      return d.toLocaleDateString();
    });

    // Helper for code blocks
    this.handlebars.registerHelper('code_block', function(code, language) {
      return new this.handlebars.SafeString(`\`\`\`${language || ''}\n${code}\n\`\`\``);
    });
  }

  async loadTemplate(templatePath) {
    try {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const templateData = yaml.load(templateContent);
      
      if (!templateData.template || !templateData.template.content) {
        throw new Error('Template must have a template.content property');
      }

      return {
        content: templateData.template.content,
        metadata: templateData.template,
        config: templateData
      };
    } catch (error) {
      throw new Error(`Failed to load template from ${templatePath}: ${error.message}`);
    }
  }

  compileTemplate(templateContent) {
    return this.handlebars.compile(templateContent);
  }

  async renderTemplate(templatePath, data) {
    const template = await this.loadTemplate(templatePath);
    const compiled = this.compileTemplate(template.content);
    
    // Merge template metadata with provided data
    const renderData = {
      ...data,
      generated_date: new Date().toISOString(),
      template_version: template.metadata.version || '1.0',
      ...template.metadata.defaults
    };

    const rendered = compiled(renderData);
    
    return {
      content: rendered,
      filename: this.handlebars.compile(template.metadata.filename || 'document.md')(renderData),
      format: template.metadata.format || 'markdown',
      metadata: template.metadata
    };
  }

  async renderFromString(templateString, data) {
    const compiled = this.compileTemplate(templateString);
    
    const renderData = {
      ...data,
      generated_date: new Date().toISOString()
    };

    return compiled(renderData);
  }

  // Convert markdown to HTML if needed
  markdownToHtml(markdown) {
    return this.markdown.render(markdown);
  }

  // Validate template syntax
  validateTemplate(templateContent) {
    try {
      this.handlebars.compile(templateContent);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  // Get available helpers
  getAvailableHelpers() {
    return Object.keys(this.handlebars.helpers);
  }
}

export default TemplateEngine;