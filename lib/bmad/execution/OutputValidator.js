class OutputValidator {
  constructor(template) {
    this.template = template;
  }

  validate(output) {
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (this.template.template?.output?.format === 'markdown' && !this.isValidMarkdown(output)) {
      validationResults.isValid = false;
      validationResults.errors.push('Output is not valid markdown format');
    }

    const requiredSections = this.template.sections?.filter(s => s.required !== false) || [];
    for (const section of requiredSections) {
      if (!this.outputContainsSection(output, section.title)) {
        validationResults.isValid = false;
        validationResults.errors.push(`Missing required section: ${section.title}`);
      }
    }

    if (output.length < 100) {
      validationResults.isValid = false;
      validationResults.errors.push('Output too short - appears incomplete');
    }

    if (this.containsPlaceholderContent(output)) {
      validationResults.isValid = false;
      validationResults.errors.push('Output contains placeholder or generic content');
    }

    return validationResults;
  }

  isValidMarkdown(content) {
    return typeof content === 'string' && content.trim().length > 0;
  }

  outputContainsSection(output, sectionTitle) {
    const escapedTitle = sectionTitle.replace(/[.*+?^${}()|[\\]/g, '\\$&');
    
    const patterns = [
      new RegExp(`#{1,6}\s*${escapedTitle}`, 'i'),
      new RegExp(`#{1,6}\s*\d+\.?\s*${escapedTitle}`, 'i'),
      new RegExp(`\b${escapedTitle}\b`, 'i'),
      new RegExp(escapedTitle.replace(/\s+/g, '\\s*').replace(/[()]/g, '\\s*\\(?\\)?\\s*'), 'i')
    ];
    
    return patterns.some(pattern => pattern.test(output));
  }

  containsPlaceholderContent(output) {
    const problematicPatterns = [
      /\{\{[^}]+\}\}/,
      /Lorem ipsum/i,
      /Add Your API Keys/i,
      /provide your own API keys/i,
      /shared quota.*exhausted/i,
      /To continue using AI features/i,
      /Get free API keys/i,
      /I don't have/i,
      /I cannot/i,
      /As an AI/i,
      /I'm sorry.*unable/i,
      /generic placeholder/i,
      /replace this.*text/i,
      /fill in.*details/i
    ];
    
    return problematicPatterns.some(pattern => pattern.test(output));
  }
}

module.exports = { OutputValidator };
