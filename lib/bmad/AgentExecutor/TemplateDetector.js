/**
 * Template Detector
 * Handles template detection and validation logic
 */

const fs = require('fs').promises;
const path = require('path');
import logger from '../../utils/logger.js';

class TemplateDetector {
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * 🔍 Enhanced template detection with intelligent pattern matching
   * Uses multiple strategies to find the best template for a given context
   */
  async enhancedTemplateDetection(context, agent) {
    console.log({enhancedTemplateDetection: {agent, context}});
    
    const detectionStrategies = [
      // Strategy 1: Direct template reference in context.uses
      () => this.detectDirectTemplateReference(context),
      
      // Strategy 2: Action-based template mapping
      () => this.detectActionBasedTemplate(context, agent),
      
      // Strategy 3: Content pattern analysis
      () => this.detectContentPatternTemplate(context, agent),
      
      // Strategy 4: Creates field mapping
      () => this.detectCreatesBasedTemplate(context),
      
      // Strategy 5: Step notes analysis
      () => this.detectNotesBasedTemplate(context)
    ];

    for (const strategy of detectionStrategies) {
      try {
        const templatePath = await strategy();
        if (templatePath && await this.validateTemplateExists(templatePath)) {
          logger.info(`🎯 [DETECTION SUCCESS] Template found: ${templatePath}`);
          
          // CRITICAL FIX: Check if this is an interactive template
          if (templatePath === 'project-brief-tmpl.yaml') {
            logger.info('🔄 [INTERACTIVE TEMPLATE] Detected project-brief template - checking for interactive mode');
            try {
              const template = await this.loadTemplateFile(templatePath);
              if (template?.workflow?.mode === 'interactive') {
                logger.info('🔄 [INTERACTIVE TEMPLATE] project-brief-tmpl is interactive - setting up conversational context');
                // Mark context as interactive template-based
                context.templateName = 'project-brief-tmpl';
                context.interactiveMode = true;
                return null; // This will trigger interactive flow in isInteractiveStep
              }
            } catch (templateError) {
              logger.warn('⚠️ [INTERACTIVE TEMPLATE] Could not load project-brief-tmpl for interactive check:', templateError.message);
            }
          }
          
          return templatePath;
        }
      } catch (error) {
        logger.warn(`⚠️ [DETECTION ERROR] Strategy failed: ${error.message}`);
        continue;
      }
    }

    return null;
  }

  /**
   * Strategy 1: Direct template reference detection
   */
  detectDirectTemplateReference(context) {
    if (context.uses && typeof context.uses === 'string') {
      if (context.uses.endsWith('.yaml') || context.uses.endsWith('.yml')) {
        return context.uses;
      }
      return context.uses.endsWith('-tmpl') ? `${context.uses}.yaml` : `${context.uses}-tmpl.yaml`;
    }
    return null;
  }

  /**
   * Strategy 2: Action-based template mapping
   */
  detectActionBasedTemplate(context, agent) {
    if (!context.action) return null;

    const actionMappings = {
      'check existing documentation': 'check-documentation.md',
      'classify enhancement scope': 'enhancement-classification-tmpl.yaml',
      'create prd': 'prd-tmpl.yaml',
      'create architecture': 'architecture-tmpl.yaml',
      'create brownfield prd': 'brownfield-prd-tmpl.yaml',
      'create front-end spec': 'front-end-spec-tmpl.yaml',
      'create project brief': 'project-brief-tmpl.yaml'
    };

    const normalizedAction = context.action.toLowerCase();
    const templateName = actionMappings[normalizedAction];
    
    if (templateName) {
      logger.info(`🎯 [ACTION MAPPING] Action '${context.action}' mapped to template: ${templateName}`);
    }
    
    return templateName || null;
  }

  /**
   * Strategy 3: Content pattern analysis
   */
  detectContentPatternTemplate(context, agent) {
    const stepNotes = context.stepNotes || context.notes || '';
    
    // Pattern matching for common workflow patterns
    const patterns = [
      { regex: /check.*documentation.*status/i, template: 'check-documentation.md' },
      { regex: /classify.*enhancement/i, template: 'enhancement-classification-tmpl.yaml' },
      { regex: /create.*prd/i, template: 'prd-tmpl.yaml' },
      { regex: /architecture.*document/i, template: 'architecture-tmpl.yaml' },
      { regex: /brownfield.*prd/i, template: 'brownfield-prd-tmpl.yaml' },
      { regex: /front.*end.*spec/i, template: 'front-end-spec-tmpl.yaml' },
      { regex: /project.*brief/i, template: 'project-brief-tmpl.yaml' },
      { regex: /competitor.*analysis/i, template: 'competitor-analysis-tmpl.yaml' },
      { regex: /market.*research/i, template: 'market-research-tmpl.yaml' }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(stepNotes) || pattern.regex.test(context.action || '')) {
        logger.info(`🎯 [PATTERN MATCH] Found pattern for template: ${pattern.template}`);
        return pattern.template;
      }
    }

    return null;
  }

  /**
   * Strategy 4: Creates field based template detection
   */
  detectCreatesBasedTemplate(context) {
    if (!context.creates) return null;

    const createsMappings = {
      'prd.md': 'prd-tmpl.yaml',
      'architecture.md': 'architecture-tmpl.yaml', 
      'brownfield-prd.md': 'brownfield-prd-tmpl.yaml',
      'front-end-spec.md': 'front-end-spec-tmpl.yaml',
      'project-brief.md': 'project-brief-tmpl.yaml',
      'competitor-analysis.md': 'competitor-analysis-tmpl.yaml',
      'market-research.md': 'market-research-tmpl.yaml',
      'fullstack-architecture.md': 'fullstack-architecture-tmpl.yaml'
    };

    return createsMappings[context.creates] || null;
  }

  /**
   * Strategy 5: Step notes template extraction
   */
  detectNotesBasedTemplate(context) {
    const stepNotes = context.stepNotes || context.notes || '';
    
    // Extract explicit template references
    const templateMatches = [
      stepNotes.match(/using\s+([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i),
      stepNotes.match(/with\s+([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i),
      stepNotes.match(/([a-zA-Z0-9\-_]+(?:-tmpl)(?:\.yaml)?)/),
    ];

    for (const match of templateMatches) {
      if (match && match[1]) {
        let templateName = match[1];
        if (!templateName.endsWith('.yaml') && !templateName.endsWith('.md')) {
          if (!templateName.endsWith('-tmpl')) {
            templateName += '-tmpl';
          }
          templateName += '.yaml';
        }
        return templateName;
      }
    }

    return null;
  }

  /**
   * Validate that a template file actually exists
   */
  async validateTemplateExists(templatePath) {
    try {
      let fullPath;
      if (!templatePath.includes('/') && !templatePath.includes('\\')) {
        // Template file (.yaml)
        if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
          fullPath = path.join(process.cwd(), '.bmad-core', 'templates', templatePath);
        }
        // Task file (.md) 
        else if (templatePath.endsWith('.md')) {
          fullPath = path.join(process.cwd(), '.bmad-core', 'tasks', templatePath);
        }
      } else {
        fullPath = path.resolve(templatePath);
      }
      
      await fs.access(fullPath, fs.constants.F_OK);
      return true;
    } catch (error) {
      logger.warn(`⚠️ [TEMPLATE VALIDATION] Template not found: ${templatePath}`);
      return false;
    }
  }

  /**
   * Load template file for validation
   */
  async loadTemplateFile(templatePath) {
    const cacheKey = `template_${templatePath}`;
    const cached = this.cacheManager.getTemplate(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let fullPath;
      if (!templatePath.includes('/') && !templatePath.includes('\\')) {
        fullPath = path.join(process.cwd(), '.bmad-core', 'templates', templatePath);
      } else {
        fullPath = path.resolve(templatePath);
      }

      const content = await fs.readFile(fullPath, 'utf8');
      const yaml = require('js-yaml');
      const template = yaml.load(content);
      
      this.cacheManager.setTemplate(cacheKey, template);
      return template;
    } catch (error) {
      logger.error(`❌ [TEMPLATE LOAD] Failed to load template ${templatePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map creates field to agent commands
   */
  mapCreatesToCommand(creates, agent) {
    if (!creates || !agent?.commands) return null;

    // Look for command that produces this output file
    for (const command of agent.commands) {
      if (typeof command === 'object' && command.creates === creates) {
        return command.name || Object.keys(command)[0];
      }
      if (typeof command === 'string' && command.includes(creates)) {
        return command;
      }
    }

    return null;
  }

  /**
   * Extract template from step notes
   */
  extractTemplateFromNotes(notes) {
    if (!notes) return null;

    // Match patterns like "use task create-doc with project-brief-tmpl.yaml"
    const templatePattern = /(?:use\s+task\s+create-doc\s+with\s+|using\s+|with\s+)([a-zA-Z0-9\-_]+(?:-tmpl)?(?:\.yaml)?)/i;
    const match = notes.match(templatePattern);
    
    if (match && match[1]) {
      let templateName = match[1];
      if (!templateName.endsWith('.yaml')) {
        if (!templateName.endsWith('-tmpl')) {
          templateName += '-tmpl';
        }
        templateName += '.yaml';
      }
      return templateName;
    }

    return null;
  }

  /**
   * Infer template from context
   */
  inferTemplateFromContext(context, agent) {
    if (!context || !agent) return null;

    // Check for action patterns that imply templates
    const action = context.action?.toLowerCase() || '';
    
    if (action.includes('create') && action.includes('brief')) {
      return 'project-brief-tmpl.yaml';
    }
    if (action.includes('create') && action.includes('prd')) {
      return 'prd-tmpl.yaml';
    }
    if (action.includes('create') && action.includes('architecture')) {
      return 'architecture-tmpl.yaml';
    }

    // Agent-specific defaults
    const agentTemplateDefaults = {
      'analyst': 'project-brief-tmpl.yaml',
      'pm': 'prd-tmpl.yaml',
      'architect': 'architecture-tmpl.yaml'
    };

    return agentTemplateDefaults[agent.id] || null;
  }
}

module.exports = { TemplateDetector };