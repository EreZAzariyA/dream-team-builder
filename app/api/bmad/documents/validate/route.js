import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * BMAD Document Validation API
 * 
 * Validates documents against BMAD templates and quality standards
 * Uses .bmad-core/checklists/ for validation criteria
 * Following BMAD methodology specifications
 */

export async function POST(request) {
  try {
    const { documentId, content, documentType, templateId } = await request.json();

    // Validate required fields
    if (!documentId || !content || !documentType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: documentId, content, documentType'
      }, { status: 400 });
    }

    console.log(`✅ BMAD Document Validation: ${documentType} (${documentId})`);

    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Validate document against BMAD standards
    const validationResult = await validateDocument({
      documentId,
      content,
      documentType,
      templateId,
      userId: session.user.id
    });

    return NextResponse.json({
      success: true,
      documentId,
      documentType,
      validation: validationResult,
      validatedAt: new Date().toISOString(),
      bmadCompliant: validationResult.valid
    });

  } catch (error) {
    console.error('❌ BMAD document validation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Document validation failed',
      message: error.message
    }, { status: 500 });
  }
}

async function validateDocument({ documentId, content, documentType, templateId, userId }) {
  console.log(`🔍 Validating ${documentType} document...`);

  // Load validation checklist for document type
  const checklist = await loadValidationChecklist(documentType);
  
  // Load template if specified
  let template = null;
  if (templateId) {
    template = await loadTemplate(templateId);
  }

  // Perform validation checks
  const validationResults = {
    valid: true,
    score: 0,
    maxScore: 0,
    issues: [],
    warnings: [],
    suggestions: [],
    sections: {}
  };

  // 1. Structure Validation
  const structureValidation = validateDocumentStructure(content, documentType, template);
  mergeValidationResults(validationResults, structureValidation, 'structure');

  // 2. Content Quality Validation
  const contentValidation = validateContentQuality(content, documentType);
  mergeValidationResults(validationResults, contentValidation, 'content');

  // 3. Template Compliance (if template provided)
  if (template) {
    const templateValidation = validateTemplateCompliance(content, template);
    mergeValidationResults(validationResults, templateValidation, 'template');
  }

  // 4. BMAD Checklist Validation
  if (checklist) {
    const checklistValidation = await validateAgainstChecklist(content, checklist, documentType);
    mergeValidationResults(validationResults, checklistValidation, 'checklist');
  }

  // Calculate final score and validity
  validationResults.valid = validationResults.issues.length === 0;
  validationResults.scorePercentage = validationResults.maxScore > 0 
    ? Math.round((validationResults.score / validationResults.maxScore) * 100)
    : 100;

  // Add BMAD-specific recommendations
  addBmadRecommendations(validationResults, documentType);

  return validationResults;
}

async function loadValidationChecklist(documentType) {
  try {
    // Map document types to checklist files
    const checklistMap = {
      'prd': 'pm.md',
      'architecture': 'architect.md', 
      'story': 'story-draft.md',
      'stories': 'story-draft.md',
      'analysis': 'analyst.md'
    };

    const checklistFile = checklistMap[documentType];
    if (!checklistFile) {
      console.warn(`No checklist found for document type: ${documentType}`);
      return null;
    }

    const checklistPath = path.join(process.cwd(), '.bmad-core', 'checklists', checklistFile);
    const checklistContent = await fs.readFile(checklistPath, 'utf8');
    return parseChecklistContent(checklistContent);
  } catch (error) {
    console.warn(`Could not load checklist for ${documentType}:`, error.message);
    return getDefaultChecklist(documentType);
  }
}

async function loadTemplate(templateId) {
  try {
    const templatePath = path.join(process.cwd(), '.bmad-core', 'templates', `${templateId}.yaml`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    return yaml.load(templateContent);
  } catch (error) {
    console.warn(`Could not load template ${templateId}:`, error.message);
    return null;
  }
}

function parseChecklistContent(content) {
  const checklist = {
    items: [],
    requirements: [],
    qualityStandards: []
  };

  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.substring(3).toLowerCase();
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- ')) {
      const item = trimmed.replace(/^- \[.\]\s*/, '').replace(/^- /, '');
      
      if (currentSection === 'requirements' || trimmed.includes('must')) {
        checklist.requirements.push(item);
      } else if (currentSection === 'quality' || trimmed.includes('should')) {
        checklist.qualityStandards.push(item);
      } else {
        checklist.items.push(item);
      }
    }
  }

  return checklist;
}

function getDefaultChecklist(documentType) {
  const defaults = {
    prd: {
      requirements: [
        'Document has clear goals and objectives',
        'User stories are well-defined',
        'Functional requirements are complete',
        'Non-functional requirements are specified',
        'Success criteria are measurable'
      ],
      qualityStandards: [
        'Language is clear and professional',
        'Document follows BMAD structure',
        'Acceptance criteria are testable',
        'Dependencies are identified'
      ]
    },
    architecture: {
      requirements: [
        'System components are identified',
        'Data flow is documented',
        'Technology stack is specified',
        'Security considerations included',
        'Scalability approach defined'
      ],
      qualityStandards: [
        'Architecture diagrams are clear',
        'Design patterns are appropriate',
        'Performance considerations addressed',
        'Integration points documented'
      ]
    },
    story: {
      requirements: [
        'Story follows "As a... I want... So that..." format',
        'Acceptance criteria are defined',
        'Story is sized appropriately',
        'Dependencies are identified'
      ],
      qualityStandards: [
        'Story is testable',
        'Business value is clear',
        'Story is independent',
        'Estimates are reasonable'
      ]
    }
  };

  return defaults[documentType] || { requirements: [], qualityStandards: [] };
}

function validateDocumentStructure(content, documentType, template) {
  const validation = {
    valid: true,
    score: 0,
    maxScore: 20,
    issues: [],
    warnings: [],
    suggestions: []
  };

  // Check basic markdown structure
  const lines = content.split('\n');
  const hasTitle = lines.some(line => line.startsWith('# '));
  const hasHeaders = lines.some(line => line.match(/^#{2,6}\s+/));
  const wordCount = content.split(/\s+/).length;

  if (!hasTitle) {
    validation.issues.push('Document missing main title (# Title)');
  } else {
    validation.score += 5;
  }

  if (!hasHeaders) {
    validation.warnings.push('Document has no section headers');
  } else {
    validation.score += 5;
  }

  // Document type specific structure
  switch (documentType) {
    case 'prd':
      validation.maxScore += 15;
      if (content.includes('## Goals') || content.includes('## Objectives')) validation.score += 5;
      if (content.includes('## User Stories') || content.includes('## Requirements')) validation.score += 5;
      if (content.includes('## Success Criteria') || content.includes('## Metrics')) validation.score += 5;
      break;
      
    case 'architecture':
      validation.maxScore += 15;
      if (content.includes('## System Overview') || content.includes('## Architecture')) validation.score += 5;
      if (content.includes('## Components') || content.includes('## Services')) validation.score += 5;
      if (content.includes('## Data Flow') || content.includes('## Integration')) validation.score += 5;
      break;

    case 'story':
      validation.maxScore += 10;
      if (content.includes('As a') && content.includes('I want') && content.includes('So that')) validation.score += 5;
      if (content.includes('Acceptance Criteria') || content.includes('Definition of Done')) validation.score += 5;
      break;
  }

  // Word count validation
  const minWordCounts = { prd: 500, architecture: 300, story: 50, analysis: 200 };
  const minWords = minWordCounts[documentType] || 100;
  
  if (wordCount < minWords) {
    validation.warnings.push(`Document may be too short (${wordCount} words, recommended: ${minWords}+)`);
  }

  // Template structure validation
  if (template && template.sections) {
    const templateValidation = validateTemplateStructure(content, template.sections);
    validation.score += templateValidation.score;
    validation.maxScore += templateValidation.maxScore;
    validation.issues.push(...templateValidation.issues);
  }

  return validation;
}

function validateContentQuality(content, documentType) {
  const validation = {
    valid: true,
    score: 0,
    maxScore: 25,
    issues: [],
    warnings: [],
    suggestions: []
  };

  const lines = content.split('\n');
  const words = content.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Check for placeholder content
  const placeholders = ['lorem ipsum', 'placeholder', 'todo', 'tbd', 'coming soon'];
  const hasPlaceholders = placeholders.some(p => content.toLowerCase().includes(p));
  
  if (hasPlaceholders) {
    validation.issues.push('Document contains placeholder content that needs to be completed');
  } else {
    validation.score += 5;
  }

  // Check for professional language
  const unprofessionalWords = ['gonna', 'wanna', 'kinda', 'sorta', 'yeah', 'nah'];
  const unprofessionalCount = unprofessionalWords.filter(word => words.includes(word)).length;
  
  if (unprofessionalCount > 0) {
    validation.warnings.push(`Found ${unprofessionalCount} informal word(s) - consider using professional language`);
  } else {
    validation.score += 5;
  }

  // Check sentence structure
  const avgSentenceLength = words.length / sentences.length;
  if (avgSentenceLength > 30) {
    validation.suggestions.push('Consider breaking down long sentences for better readability');
  } else {
    validation.score += 3;
  }

  // Check for active voice and clarity
  const passiveIndicators = words.filter(w => ['was', 'were', 'been', 'being'].includes(w)).length;
  const passiveRatio = passiveIndicators / words.length;
  
  if (passiveRatio > 0.1) {
    validation.suggestions.push('Consider using more active voice for clearer communication');
  } else {
    validation.score += 3;
  }

  // Document type specific quality checks
  switch (documentType) {
    case 'prd':
      if (content.includes('measurable') || content.includes('metric') || content.includes('KPI')) validation.score += 3;
      if (content.includes('user') && content.includes('business')) validation.score += 3;
      break;
      
    case 'architecture':
      if (content.includes('scalable') || content.includes('performance') || content.includes('security')) validation.score += 3;
      if (content.includes('pattern') || content.includes('design') || content.includes('principle')) validation.score += 3;
      break;
  }

  return validation;
}

function validateTemplateCompliance(content, template) {
  const validation = {
    valid: true,
    score: 0,
    maxScore: 20,
    issues: [],
    warnings: [],
    suggestions: []
  };

  if (!template.variables) {
    return validation;
  }

  // Check if required variables are present
  Object.entries(template.variables).forEach(([key, variable]) => {
    if (variable.required) {
      const placeholder = `{{${key}}}`;
      if (content.includes(placeholder)) {
        validation.issues.push(`Template variable '${key}' not filled (still shows ${placeholder})`);
      } else {
        validation.score += 2;
      }
      validation.maxScore += 2;
    }
  });

  return validation;
}

async function validateAgainstChecklist(content, checklist, documentType) {
  const validation = {
    valid: true,
    score: 0,
    maxScore: 30,
    issues: [],
    warnings: [],
    suggestions: []
  };

  // Check requirements
  checklist.requirements.forEach(requirement => {
    const passed = checkRequirement(content, requirement, documentType);
    if (passed) {
      validation.score += 3;
    } else {
      validation.issues.push(`Requirement not met: ${requirement}`);
    }
    validation.maxScore += 3;
  });

  // Check quality standards
  checklist.qualityStandards.forEach(standard => {
    const passed = checkQualityStandard(content, standard, documentType);
    if (passed) {
      validation.score += 2;
    } else {
      validation.warnings.push(`Quality standard not met: ${standard}`);
    }
    validation.maxScore += 2;
  });

  return validation;
}

function checkRequirement(content, requirement, documentType) {
  const lowerContent = content.toLowerCase();
  const lowerReq = requirement.toLowerCase();

  // Basic keyword matching (can be enhanced with NLP)
  if (lowerReq.includes('goals') || lowerReq.includes('objectives')) {
    return lowerContent.includes('goal') || lowerContent.includes('objective');
  }
  
  if (lowerReq.includes('user stories')) {
    return lowerContent.includes('as a') && lowerContent.includes('i want');
  }
  
  if (lowerReq.includes('acceptance criteria')) {
    return lowerContent.includes('acceptance') || lowerContent.includes('criteria');
  }
  
  if (lowerReq.includes('security')) {
    return lowerContent.includes('security') || lowerContent.includes('auth');
  }

  // Default: check if key terms from requirement appear in content
  const keywords = lowerReq.split(' ').filter(word => word.length > 3);
  return keywords.some(keyword => lowerContent.includes(keyword));
}

function checkQualityStandard(content, standard, documentType) {
  const lowerContent = content.toLowerCase();
  const lowerStandard = standard.toLowerCase();

  if (lowerStandard.includes('clear') && lowerStandard.includes('professional')) {
    // Check for professional language and clarity
    const unprofessionalWords = ['gonna', 'wanna', 'kinda'];
    return !unprofessionalWords.some(word => lowerContent.includes(word));
  }

  if (lowerStandard.includes('bmad structure')) {
    // Check for BMAD-style headers and organization
    return content.includes('##') && (content.includes('# ') || content.includes('#'));
  }

  if (lowerStandard.includes('testable')) {
    return lowerContent.includes('test') || lowerContent.includes('verify') || lowerContent.includes('validate');
  }

  // Default: assume standard is met if relevant keywords found
  const keywords = lowerStandard.split(' ').filter(word => word.length > 3);
  return keywords.some(keyword => lowerContent.includes(keyword));
}

function validateTemplateStructure(content, sections) {
  const validation = {
    score: 0,
    maxScore: 0,
    issues: []
  };

  sections.forEach(section => {
    validation.maxScore += 2;
    
    if (section.required !== false) {
      const hasSection = content.includes(`## ${section.title}`) || 
                        content.includes(`# ${section.title}`);
      if (hasSection) {
        validation.score += 2;
      } else {
        validation.issues.push(`Missing required section: ${section.title}`);
      }
    }
  });

  return validation;
}

function mergeValidationResults(main, additional, sectionName) {
  main.score += additional.score;
  main.maxScore += additional.maxScore;
  main.issues.push(...additional.issues);
  main.warnings.push(...additional.warnings);
  main.suggestions.push(...additional.suggestions);
  main.sections[sectionName] = {
    score: additional.score,
    maxScore: additional.maxScore,
    valid: additional.issues.length === 0
  };
}

function addBmadRecommendations(validationResults, documentType) {
  // Add BMAD-specific suggestions based on document type and validation results
  if (validationResults.scorePercentage < 70) {
    validationResults.suggestions.push('Consider using BMAD templates to improve document structure');
  }

  if (documentType === 'prd' && !validationResults.sections.checklist?.valid) {
    validationResults.suggestions.push('Run the BMAD PM checklist to ensure all PRD requirements are met');
  }

  if (documentType === 'architecture' && validationResults.score < validationResults.maxScore * 0.8) {
    validationResults.suggestions.push('Consider reviewing BMAD architecture best practices');
  }

  if (validationResults.issues.length > 0) {
    validationResults.suggestions.push('Use @pm *help or @architect *help for BMAD methodology guidance');
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'BMAD Document Validation API',
    description: 'Validates documents against BMAD templates, checklists, and quality standards',
    version: '1.0.0',
    
    usage: {
      method: 'POST',
      endpoint: '/api/bmad/documents/validate',
      body: {
        documentId: 'Document identifier',
        content: 'Document content in markdown',
        documentType: 'prd | architecture | story | analysis',
        templateId: 'Optional template ID for template compliance checking'
      }
    },
    
    features: [
      'Structure validation against BMAD standards',
      'Content quality assessment',
      'Template compliance checking',
      'BMAD checklist validation',
      'Professional language analysis',
      'Actionable improvement suggestions'
    ],
    
    validationTypes: {
      structure: 'Document organization and sections',
      content: 'Language quality and clarity',
      template: 'Compliance with YAML templates',
      checklist: 'BMAD methodology requirements'
    }
  });
}