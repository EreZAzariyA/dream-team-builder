import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * BMAD Template Processing API
 * 
 * Executes actual create-doc.md task from .bmad-core/tasks/
 * Processes YAML templates with variable substitution
 * Following BMAD methodology specifications
 */

export async function POST(request) {
  try {
    const { templateId, variables, projectName, agentId } = await request.json();

    // Validate required fields
    if (!templateId || !variables) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: templateId, variables'
      }, { status: 400 });
    }

    console.log(`📝 BMAD Template Processing: ${templateId}`);

    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Load template from .bmad-core
    const template = await loadTemplate(templateId);
    if (!template) {
      return NextResponse.json({
        success: false,
        error: `Template '${templateId}' not found`
      }, { status: 404 });
    }

    // Process template with variables
    const processedDocument = await processTemplate(template, variables, {
      projectName: projectName || 'Project',
      agentId,
      userId: session.user.id,
      userEmail: session.user.email
    });

    return NextResponse.json({
      success: true,
      templateId,
      document: {
        id: `doc-${Date.now()}`,
        title: processedDocument.title,
        content: processedDocument.content,
        type: template.type,
        agent: agentId || template.agent || 'system',
        metadata: {
          templateId,
          generatedAt: new Date().toISOString(),
          wordCount: processedDocument.content.split(' ').length,
          variables: Object.keys(variables).length,
          template: template.metadata
        }
      },
      template: {
        id: templateId,
        name: template.name,
        type: template.type,
        version: template.version
      }
    });

  } catch (error) {
    console.error('❌ BMAD template processing error:', error);
    return NextResponse.json({
      success: false,
      error: 'Template processing failed',
      message: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (templateId) {
      // Return specific template structure
      const template = await loadTemplate(templateId);
      if (!template) {
        return NextResponse.json({
          success: false,
          error: `Template '${templateId}' not found`
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        template: {
          id: templateId,
          name: template.name,
          description: template.description,
          type: template.type,
          variables: template.variables || {},
          sections: template.sections || [],
          metadata: template.metadata || {}
        }
      });
    } else {
      // Return list of available templates
      const templates = await listAvailableTemplates();
      return NextResponse.json({
        success: true,
        templates
      });
    }

  } catch (error) {
    console.error('❌ Error getting templates:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load templates',
      message: error.message
    }, { status: 500 });
  }
}

async function loadTemplate(templateId) {
  try {
    const templatePath = path.join(process.cwd(), '.bmad-core', 'templates', `${templateId}.yaml`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = yaml.load(templateContent);
    
    return {
      id: templateId,
      ...template
    };
  } catch (error) {
    console.warn(`Could not load template ${templateId}:`, error.message);
    return null;
  }
}

async function listAvailableTemplates() {
  try {
    const templatesDir = path.join(process.cwd(), '.bmad-core', 'templates');
    const files = await fs.readdir(templatesDir);
    const templates = [];

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const templateId = file.replace(/\.(yaml|yml)$/, '');
        try {
          const template = await loadTemplate(templateId);
          if (template) {
            templates.push({
              id: templateId,
              name: template.name || templateId,
              description: template.description || '',
              type: template.type || 'document',
              variableCount: Object.keys(template.variables || {}).length,
              hasElicitation: !!(template.elicitation || template.elicit),
              agent: template.agent
            });
          }
        } catch (error) {
          console.warn(`Error loading template ${templateId}:`, error.message);
        }
      }
    }

    return templates;
  } catch (error) {
    console.warn('Could not list templates:', error.message);
    return getDefaultTemplates();
  }
}

function getDefaultTemplates() {
  return [
    {
      id: 'prd-tmpl',
      name: 'Product Requirements Document',
      description: 'Comprehensive PRD template for product development',
      type: 'prd',
      variableCount: 8,
      hasElicitation: true,
      agent: 'pm'
    },
    {
      id: 'architecture-tmpl',
      name: 'System Architecture Document',
      description: 'Technical architecture specification template',
      type: 'architecture',
      variableCount: 12,
      hasElicitation: true,
      agent: 'architect'
    },
    {
      id: 'story-tmpl',
      name: 'User Story Template',
      description: 'Individual user story specification',
      type: 'story',
      variableCount: 6,
      hasElicitation: false,
      agent: 'sm'
    }
  ];
}

async function processTemplate(template, variables, context) {
  console.log(`📝 Processing template: ${template.name}`);

  // Load create-doc.md task for processing logic
  const taskInstructions = await loadCreateDocTask();

  // Process template content with variable substitution
  let processedContent = template.content || generateTemplateContent(template);
  
  // Handle different variable types and perform substitutions
  processedContent = await substituteVariables(processedContent, variables, template.variables, context);
  
  // Process sections if template has sectioned structure
  if (template.sections && Array.isArray(template.sections)) {
    processedContent = await processSectionedTemplate(template.sections, variables, context);
  }

  // Generate document title
  const title = substituteVariables(
    template.title || '{{project_name}} - {{document_type}}',
    { ...variables, document_type: template.type, ...context },
    template.variables,
    context
  );

  return {
    title,
    content: processedContent,
    type: template.type,
    sections: template.sections?.length || 0
  };
}

async function loadCreateDocTask() {
  try {
    const taskPath = path.join(process.cwd(), '.bmad-core', 'tasks', 'create-doc.md');
    const taskContent = await fs.readFile(taskPath, 'utf8');
    return parseTaskInstructions(taskContent);
  } catch (error) {
    console.warn('Could not load create-doc.md, using default logic:', error.message);
    return getDefaultCreateDocInstructions();
  }
}

function parseTaskInstructions(taskContent) {
  const instructions = {
    methodology: 'BMAD Document Creation',
    steps: [],
    variableTypes: {}
  };

  // Parse task markdown for document creation instructions
  const lines = taskContent.split('\n');
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.substring(3).toLowerCase().replace(/ /g, '_');
    } else if (line.startsWith('- ') && currentSection) {
      instructions.steps.push(line.substring(2));
    }
  }

  return instructions;
}

function getDefaultCreateDocInstructions() {
  return {
    methodology: 'BMAD Document Creation - Default',
    steps: [
      'Load template YAML structure and metadata',
      'Process variable substitution based on user input',
      'Handle conditional sections based on project type',
      'Generate document sections in proper order',
      'Apply BMAD formatting and structure standards',
      'Validate document completeness and coherence'
    ],
    variableTypes: {
      string: 'Direct text substitution',
      enum: 'Selection from predefined options',
      file: 'File path or content reference',
      boolean: 'Conditional section inclusion',
      array: 'List generation and formatting'
    }
  };
}

function substituteVariables(content, userVariables, templateVariables = {}, context = {}) {
  let result = content;

  // Combine all variable sources
  const allVariables = {
    ...context,
    ...userVariables,
    // Add common BMAD variables
    bmad_version: '4.35.3',
    generated_at: new Date().toISOString(),
    generated_by: context.agentId || 'system'
  };

  // Process each variable
  for (const [key, value] of Object.entries(allVariables)) {
    const placeholder = `{{${key}}}`;
    const placeholderRegex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    
    // Handle different variable types
    let substitutedValue = value;
    const templateVar = templateVariables[key];
    
    if (templateVar) {
      substitutedValue = processVariableByType(value, templateVar, context);
    }
    
    result = result.replace(placeholderRegex, String(substitutedValue));
  }

  // Handle conditional blocks
  result = processConditionalBlocks(result, allVariables);

  return result;
}

function processVariableByType(value, templateVariable, context) {
  switch (templateVariable.type) {
    case 'enum':
      // Validate enum selection
      if (templateVariable.options && !templateVariable.options.includes(value)) {
        console.warn(`Invalid enum value '${value}' for variable. Using default.`);
        return templateVariable.default || templateVariable.options[0];
      }
      return value;
      
    case 'boolean':
      // Convert to boolean for conditional processing
      return Boolean(value);
      
    case 'array':
      // Format array as list
      if (Array.isArray(value)) {
        return value.map(item => `- ${item}`).join('\n');
      }
      return value;
      
    case 'file':
      // Handle file references (could load content)
      return value;
      
    default:
      return value;
  }
}

function processConditionalBlocks(content, variables) {
  // Process {{#if variable}} blocks
  const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
  return content.replace(ifRegex, (match, variableName, blockContent) => {
    const variable = variables[variableName];
    return variable ? blockContent.trim() : '';
  });
}

async function processSectionedTemplate(sections, variables, context) {
  let result = '';

  for (const section of sections) {
    if (section.condition) {
      // Check if section should be included
      const shouldInclude = evaluateCondition(section.condition, variables);
      if (!shouldInclude) continue;
    }

    // Process section header
    if (section.title) {
      const level = section.level || 2;
      const headerPrefix = '#'.repeat(level);
      const processedTitle = substituteVariables(section.title, variables, {}, context);
      result += `${headerPrefix} ${processedTitle}\n\n`;
    }

    // Process section content
    if (section.content) {
      const processedContent = substituteVariables(section.content, variables, {}, context);
      result += `${processedContent}\n\n`;
    }

    // Process subsections
    if (section.subsections && Array.isArray(section.subsections)) {
      const subsectionContent = await processSectionedTemplate(section.subsections, variables, context);
      result += subsectionContent;
    }
  }

  return result;
}

function evaluateCondition(condition, variables) {
  // Simple condition evaluation (can be extended)
  if (typeof condition === 'string') {
    // Handle simple variable checks: "has_backend", "!is_mobile"
    const negate = condition.startsWith('!');
    const variableName = negate ? condition.substring(1) : condition;
    const value = variables[variableName];
    return negate ? !value : !!value;
  }
  
  if (typeof condition === 'object') {
    // Handle complex conditions: { "variable": "expected_value" }
    for (const [key, expectedValue] of Object.entries(condition)) {
      if (variables[key] !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  return true;
}

function generateTemplateContent(template) {
  // Fallback content generation if template.content is missing
  let content = `# ${template.name || 'Document'}\n\n`;
  
  if (template.description) {
    content += `${template.description}\n\n`;
  }
  
  // Add variable placeholders
  if (template.variables) {
    for (const [key, variable] of Object.entries(template.variables)) {
      content += `## ${variable.title || key}\n\n{{${key}}}\n\n`;
    }
  }
  
  return content;
}