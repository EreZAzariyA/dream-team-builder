import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * BMAD Checklist API
 * 
 * Loads and serves BMAD checklists from .bmad-core/checklists/
 * Supports checklist execution and validation
 */

export async function GET(request, { params }) {
  try {
    const checklistId = params.checklistId;

    if (!checklistId) {
      return NextResponse.json({
        success: false,
        error: 'Checklist ID is required'
      }, { status: 400 });
    }

    console.log(`📋 Loading BMAD Checklist: ${checklistId}`);

    // Load checklist from .bmad-core/checklists/
    const checklist = await loadChecklistFromBmadCore(checklistId);

    if (!checklist) {
      return NextResponse.json({
        success: false,
        error: `Checklist '${checklistId}' not found`,
        availableChecklists: await listAvailableChecklists()
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      checklistId,
      checklist,
      loadedAt: new Date().toISOString(),
      source: 'bmad-core'
    });

  } catch (error) {
    console.error('❌ BMAD checklist loading error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load checklist',
      message: error.message
    }, { status: 500 });
  }
}

async function loadChecklistFromBmadCore(checklistId) {
  try {
    // Map checklist IDs to files
    const checklistFileMap = {
      'story-draft': 'story-draft-checklist.md',
      'story-dod': 'story-dod-checklist.md',
      'pm': 'pm.md',
      'architect': 'architect.md',
      'qa': 'qa.md',
      'po-master': 'po-master-checklist.md',
      'change': 'change.md'
    };

    const filename = checklistFileMap[checklistId] || `${checklistId}.md`;
    const checklistPath = path.join(process.cwd(), '.bmad-core', 'checklists', filename);

    try {
      const content = await fs.readFile(checklistPath, 'utf8');
      return parseChecklistFile(content, checklistId);
    } catch (fileError) {
      console.warn(`Checklist file not found: ${filename}, using default`);
      return getDefaultChecklist(checklistId);
    }

  } catch (error) {
    console.error(`Failed to load checklist ${checklistId}:`, error);
    return getDefaultChecklist(checklistId);
  }
}

function parseChecklistFile(content, checklistId) {
  const lines = content.split('\n');
  const checklist = {
    id: checklistId,
    name: '',
    description: '',
    items: [],
    categories: new Set(),
    metadata: {
      source: 'bmad-core',
      parsedAt: new Date().toISOString()
    }
  };

  let currentSection = null;
  let currentCategory = 'General';
  let itemCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Extract title from first header
    if (line.startsWith('# ') && !checklist.name) {
      checklist.name = line.substring(2).trim();
      continue;
    }

    // Extract description from first paragraph after title
    if (!checklist.description && line.length > 0 && !line.startsWith('#') && !line.startsWith('-')) {
      // Look for description paragraph
      let descriptionLines = [];
      for (let j = i; j < lines.length && lines[j].trim().length > 0 && !lines[j].startsWith('#') && !lines[j].startsWith('-'); j++) {
        descriptionLines.push(lines[j].trim());
      }
      checklist.description = descriptionLines.join(' ');
      i += descriptionLines.length - 1;
      continue;
    }

    // Section headers become categories
    if (line.startsWith('## ')) {
      currentCategory = line.substring(3).trim();
      currentSection = currentCategory.toLowerCase().replace(/\s+/g, '_');
      checklist.categories.add(currentCategory);
      continue;
    }

    // Parse checklist items
    if (line.startsWith('- [ ]') || line.startsWith('- ')) {
      const itemText = line.replace(/^- \[.\]\s*/, '').replace(/^- /, '').trim();
      
      if (itemText.length > 0) {
        itemCounter++;
        const item = {
          id: `${checklistId}-${itemCounter}`,
          title: itemText,
          category: currentCategory,
          section: currentSection,
          required: line.includes('MUST') || line.includes('Required') || currentCategory === 'Requirements',
          priority: line.includes('CRITICAL') ? 'critical' : line.includes('HIGH') ? 'high' : 'normal'
        };

        // Look for description in next lines
        const nextLineIndex = i + 1;
        if (nextLineIndex < lines.length) {
          const nextLine = lines[nextLineIndex].trim();
          if (nextLine.length > 0 && !nextLine.startsWith('#') && !nextLine.startsWith('-')) {
            item.description = nextLine;
          }
        }

        checklist.items.push(item);
      }
    }
  }

  // Convert Set to Array for serialization
  checklist.categories = Array.from(checklist.categories);

  return checklist;
}

function getDefaultChecklist(checklistId) {
  const defaultChecklists = {
    'story-draft': {
      id: 'story-draft',
      name: 'Story Draft Quality Checklist',
      description: 'Ensures user stories meet BMAD quality standards before development begins.',
      categories: ['Format', 'Requirements', 'Quality', 'Value'],
      items: [
        {
          id: 'story-draft-1',
          title: 'Story follows "As a [user], I want [action], So that [benefit]" format',
          category: 'Format',
          required: true,
          priority: 'critical',
          description: 'User story must clearly identify the user, desired action, and business benefit'
        },
        {
          id: 'story-draft-2', 
          title: 'Acceptance criteria are clearly defined and testable',
          category: 'Requirements',
          required: true,
          priority: 'critical',
          description: 'Clear conditions that must be met for the story to be considered complete'
        },
        {
          id: 'story-draft-3',
          title: 'Story is appropriately sized (1-8 story points)',
          category: 'Quality',
          required: true,
          priority: 'high',
          description: 'Story should be completable within one sprint iteration'
        },
        {
          id: 'story-draft-4',
          title: 'Business value and user impact are clearly articulated',
          category: 'Value',
          required: true,
          priority: 'high',
          description: 'Why this story matters to users and contributes to business goals'
        },
        {
          id: 'story-draft-5',
          title: 'Dependencies and prerequisites are identified',
          category: 'Requirements',
          required: false,
          priority: 'normal',
          description: 'Other stories, systems, or conditions this story depends on'
        },
        {
          id: 'story-draft-6',
          title: 'Story is independent and can be developed in isolation',
          category: 'Quality',
          required: false,
          priority: 'normal',
          description: 'Story should minimize dependencies on other ongoing work'
        }
      ]
    },

    'pm': {
      id: 'pm',
      name: 'Product Manager Quality Checklist',
      description: 'Comprehensive quality checklist for PRD and product management deliverables.',
      categories: ['Strategy', 'Requirements', 'User Research', 'Metrics', 'Stakeholder Management'],
      items: [
        {
          id: 'pm-1',
          title: 'Product goals and objectives are clearly defined and measurable',
          category: 'Strategy',
          required: true,
          priority: 'critical',
          description: 'Clear statement of what the product aims to achieve'
        },
        {
          id: 'pm-2',
          title: 'User personas and target audience are well-documented',
          category: 'User Research',
          required: true,
          priority: 'critical',
          description: 'Detailed understanding of who will use the product'
        },
        {
          id: 'pm-3',
          title: 'User needs, pain points, and jobs-to-be-done are identified',
          category: 'User Research',
          required: true,
          priority: 'critical',
          description: 'Clear understanding of user problems being solved'
        },
        {
          id: 'pm-4',
          title: 'Functional requirements are complete and unambiguous',
          category: 'Requirements',
          required: true,
          priority: 'critical',
          description: 'All required features and capabilities are specified'
        },
        {
          id: 'pm-5',
          title: 'Non-functional requirements (performance, security, etc.) are specified',
          category: 'Requirements',
          required: true,
          priority: 'high',
          description: 'Quality attributes and constraints are defined'
        },
        {
          id: 'pm-6',
          title: 'Success metrics and KPIs are defined with target values',
          category: 'Metrics',
          required: true,
          priority: 'high',
          description: 'How success will be measured and tracked'
        },
        {
          id: 'pm-7',
          title: 'Key stakeholders have reviewed and provided input',
          category: 'Stakeholder Management',
          required: true,
          priority: 'high',
          description: 'Relevant stakeholders are aligned on requirements'
        },
        {
          id: 'pm-8',
          title: 'Competitive analysis and market positioning are considered',
          category: 'Strategy',
          required: false,
          priority: 'normal',
          description: 'Understanding of competitive landscape and differentiation'
        }
      ]
    },

    'architect': {
      id: 'architect',
      name: 'Architecture Review Checklist',
      description: 'Technical architecture quality, completeness, and best practices checklist.',
      categories: ['Architecture', 'Components', 'Data', 'Security', 'Performance', 'Technology'],
      items: [
        {
          id: 'arch-1',
          title: 'High-level system architecture and component overview is documented',
          category: 'Architecture',
          required: true,
          priority: 'critical',
          description: 'Clear visual and textual description of system structure'
        },
        {
          id: 'arch-2',
          title: 'System components and their responsibilities are clearly defined',
          category: 'Components',
          required: true,
          priority: 'critical',
          description: 'Each component\'s purpose and boundaries are specified'
        },
        {
          id: 'arch-3',
          title: 'Data models, flow, and storage strategy are documented',
          category: 'Data',
          required: true,
          priority: 'critical',
          description: 'How data is structured, flows through, and is persisted in the system'
        },
        {
          id: 'arch-4',
          title: 'API contracts and integration points are specified',
          category: 'Components',
          required: true,
          priority: 'high',
          description: 'External and internal API specifications and dependencies'
        },
        {
          id: 'arch-5',
          title: 'Security considerations and measures are included',
          category: 'Security',
          required: true,
          priority: 'critical',
          description: 'Authentication, authorization, data protection, and security patterns'
        },
        {
          id: 'arch-6',
          title: 'Scalability and performance considerations are addressed',
          category: 'Performance',
          required: true,
          priority: 'high',
          description: 'How the system will handle growth and performance requirements'
        },
        {
          id: 'arch-7',
          title: 'Technology choices are justified and appropriate',
          category: 'Technology',
          required: true,
          priority: 'high',
          description: 'Rationale for technology stack and architectural patterns'
        },
        {
          id: 'arch-8',
          title: 'Error handling and monitoring strategies are planned',
          category: 'Architecture',
          required: false,
          priority: 'normal',
          description: 'How errors will be handled and system health monitored'
        }
      ]
    }
  };

  return defaultChecklists[checklistId] || {
    id: checklistId,
    name: 'Generic Quality Checklist',
    description: 'Basic quality assurance checklist.',
    categories: ['Quality'],
    items: [
      {
        id: `${checklistId}-1`,
        title: 'Content is complete and comprehensive',
        category: 'Quality',
        required: true,
        priority: 'high'
      },
      {
        id: `${checklistId}-2`,
        title: 'Information is accurate and up-to-date',
        category: 'Quality',
        required: true,
        priority: 'high'
      },
      {
        id: `${checklistId}-3`,
        title: 'Language is clear and professional',
        category: 'Quality',
        required: true,
        priority: 'normal'
      }
    ]
  };
}

async function listAvailableChecklists() {
  try {
    const checklistsDir = path.join(process.cwd(), '.bmad-core', 'checklists');
    const files = await fs.readdir(checklistsDir);
    
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''))
      .concat(['story-draft', 'pm', 'architect', 'qa']); // Include defaults
  } catch (error) {
    return ['story-draft', 'pm', 'architect', 'qa', 'po-master'];
  }
}

// POST endpoint for checklist execution results
export async function POST(request, { params }) {
  try {
    const checklistId = params.checklistId;
    const { completedItems, validationResults, documentId } = await request.json();

    console.log(`📋 Checklist execution result for ${checklistId}:`, {
      completedItems: completedItems?.length || 0,
      documentId,
      validationPassed: validationResults?.valid
    });

    // Here you could save checklist execution results to database
    // For now, we'll just return success

    return NextResponse.json({
      success: true,
      checklistId,
      executionResult: {
        completedItems,
        validationResults,
        documentId,
        executedAt: new Date().toISOString(),
        passed: completedItems?.length > 0 && (validationResults?.valid !== false)
      }
    });

  } catch (error) {
    console.error('❌ Checklist execution save error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to save checklist execution',
      message: error.message
    }, { status: 500 });
  }
}