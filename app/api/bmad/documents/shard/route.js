import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * BMAD Document Sharding API
 * 
 * Executes actual shard-doc.md task from .bmad-core/tasks/
 * Breaks down large documents (PRD, Architecture) into manageable pieces
 * Following BMAD methodology specifications
 */

export async function POST(request) {
  try {
    const { documentPath, documentName, outputDirectory } = await request.json();

    // Validate required fields
    if (!documentPath || !documentName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: documentPath, documentName'
      }, { status: 400 });
    }

    console.log(`🔀 BMAD Document Sharding: ${documentName} (${documentPath})`);

    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Read the document content
    const content = await fs.readFile(documentPath, 'utf8');
    const documentType = inferDocumentType(documentName);
    
    // Load BMAD core configuration
    const coreConfig = await loadCoreConfig();
    
    // Execute sharding
    const shardingResult = await executeDocumentSharding({
      documentPath,
      documentName,
      documentType,
      content,
      outputDirectory: outputDirectory || `docs/${documentName.replace('.md', '')}`,
      coreConfig,
      userId: session.user.id
    });

    // Write sharded files to filesystem
    await writeShardedFiles(shardingResult.shards, shardingResult.outputDirectory);

    return NextResponse.json({
      success: true,
      message: `Successfully sharded ${documentName} into ${shardingResult.shards.length} files`,
      documentPath,
      documentName,
      documentType,
      outputDirectory: shardingResult.outputDirectory,
      shardsGenerated: shardingResult.shards.length,
      shardedFiles: shardingResult.shards.map(s => s.filename),
      metadata: {
        shardedAt: new Date().toISOString(),
        totalWords: content.split(' ').length,
        averageShardSize: Math.round(
          shardingResult.shards.reduce((sum, shard) => sum + shard.content.split(' ').length, 0) / 
          shardingResult.shards.length
        )
      }
    });

  } catch (error) {
    console.error('❌ BMAD document sharding error:', error);
    return NextResponse.json({
      success: false,
      error: 'Document sharding failed',
      message: error.message
    }, { status: 500 });
  }
}

async function loadCoreConfig() {
  try {
    const configPath = path.join(process.cwd(), '.bmad-core', 'core-config.yaml');
    const configContent = await fs.readFile(configPath, 'utf8');
    return yaml.load(configContent);
  } catch (error) {
    console.warn('Could not load core config, using defaults:', error.message);
    return getDefaultCoreConfig();
  }
}

function getDefaultCoreConfig() {
  return {
    prdSharded: true,
    architectureSharded: true,
    shardingSettings: {
      maxShardSize: 2000,
      minShardSize: 500,
      preferredShardSize: 1000
    },
    outputPaths: {
      prd: 'docs/prd/',
      architecture: 'docs/architecture/',
      stories: 'docs/stories/'
    }
  };
}

function inferDocumentType(documentName) {
  const name = documentName.toLowerCase();
  if (name.includes('prd')) return 'prd';
  if (name.includes('architecture')) return 'architecture';
  if (name.includes('story') || name.includes('stories')) return 'stories';
  return 'generic';
}

async function writeShardedFiles(shards, outputDirectory) {
  // Ensure output directory exists
  await fs.mkdir(outputDirectory, { recursive: true });
  
  // Write each shard to a file
  for (const shard of shards) {
    const filePath = path.join(outputDirectory, shard.filename);
    await fs.writeFile(filePath, shard.content, 'utf8');
    console.log(`📝 Written shard: ${filePath}`);
  }
}

async function executeDocumentSharding({ documentPath, documentName, documentType, content, outputDirectory, coreConfig, userId }) {
  console.log(`🔀 Executing sharding for ${documentType}...`);

  // Load shard-doc.md task from BMAD core
  const taskInstructions = await loadShardingTask();
  
  // Parse document into logical sections
  const sections = parseDocumentSections(content, documentType);
  
  // Create shards based on BMAD methodology
  const shards = createDocumentShards(sections, documentType, coreConfig, documentName);
  
  return {
    shards,
    outputDirectory,
    taskInstructions
  };
}

async function loadShardingTask() {
  try {
    const taskPath = path.join(process.cwd(), '.bmad-core', 'tasks', 'shard-doc.md');
    const taskContent = await fs.readFile(taskPath, 'utf8');
    return parseTaskInstructions(taskContent);
  } catch (error) {
    console.warn('Could not load shard-doc.md, using default logic:', error.message);
    return getDefaultShardingInstructions();
  }
}

function parseTaskInstructions(taskContent) {
  // Extract sharding logic from shard-doc.md task
  const instructions = {
    methodology: 'BMAD Document Sharding',
    steps: [],
    shardingRules: {}
  };

  // Parse markdown content for sharding instructions
  const lines = taskContent.split('\n');
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.substring(3).toLowerCase().replace(/ /g, '_');
    } else if (line.startsWith('- ') && currentSection === 'sharding_rules') {
      instructions.steps.push(line.substring(2));
    }
  }

  return instructions;
}

function getDefaultShardingInstructions() {
  return {
    methodology: 'BMAD Document Sharding - Default',
    steps: [
      'Identify logical document sections',
      'Break sections into manageable shards (500-2000 words)',
      'Maintain section coherence and context',
      'Create epic-based file structure for PRDs',
      'Generate numbered architecture sections',
      'Preserve markdown formatting and structure'
    ],
    shardingRules: {
      prd: 'Epic-based sharding (epic-1.md, epic-2.md, etc.)',
      architecture: 'Component-based sharding (01-overview.md, 02-backend.md, etc.)',
      stories: 'Individual story files ({epicNum}.{storyNum}.story.md)'
    }
  };
}

function parseDocumentSections(content, documentType) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section headers (## or #)
    if (line.match(/^#{1,3}\s+/)) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          level: currentSection.level,
          content: currentContent.join('\n').trim(),
          startLine: currentSection.startLine,
          endLine: i - 1
        });
      }

      // Start new section
      const level = (line.match(/^#+/) || [''])[0].length;
      const title = line.replace(/^#+\s+/, '');
      
      currentSection = {
        title,
        level,
        startLine: i
      };
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }

  // Add final section
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      level: currentSection.level,
      content: currentContent.join('\n').trim(),
      startLine: currentSection.startLine,
      endLine: lines.length - 1
    });
  }

  return sections;
}

function createDocumentShards(sections, documentType, coreConfig, projectName) {
  const shards = [];
  const maxShardSize = coreConfig.shardingSettings?.maxShardSize || 2000;

  switch (documentType) {
    case 'prd':
      return createPRDShards(sections, maxShardSize, projectName);
    case 'architecture':
      return createArchitectureShards(sections, maxShardSize, projectName);
    case 'stories':
      return createStoryShards(sections, maxShardSize, projectName);
    default:
      return createGenericShards(sections, maxShardSize, projectName);
  }
}

function createPRDShards(sections, maxShardSize, projectName) {
  const shards = [];
  let epicNumber = 1;
  let currentShard = null;
  let currentSize = 0;

  for (const section of sections) {
    const sectionSize = section.content.split(' ').length;

    // Start new epic if current shard is too large or if it's a major section
    if (!currentShard || currentSize + sectionSize > maxShardSize || section.level <= 2) {
      if (currentShard) {
        shards.push(currentShard);
      }

      currentShard = {
        id: `epic-${epicNumber}`,
        title: `Epic ${epicNumber}: ${section.title}`,
        filename: `epic-${epicNumber}.md`,
        content: `# Epic ${epicNumber}: ${section.title}\n\n${section.content}`,
        type: 'epic',
        epicNumber,
        metadata: {
          sections: [section.title],
          wordCount: sectionSize
        }
      };
      
      epicNumber++;
      currentSize = sectionSize;
    } else {
      // Add section to current shard
      currentShard.content += `\n\n${section.content}`;
      currentShard.metadata.sections.push(section.title);
      currentShard.metadata.wordCount += sectionSize;
      currentSize += sectionSize;
    }
  }

  // Add final shard
  if (currentShard) {
    shards.push(currentShard);
  }

  return shards;
}

function createArchitectureShards(sections, maxShardSize, projectName) {
  const shards = [];
  let shardNumber = 1;

  for (const section of sections) {
    const sectionSize = section.content.split(' ').length;

    if (sectionSize > maxShardSize) {
      // Split large sections into multiple shards
      const subsections = splitLargeSection(section, maxShardSize);
      for (const subsection of subsections) {
        shards.push({
          id: `arch-${String(shardNumber).padStart(2, '0')}`,
          title: subsection.title,
          filename: `${String(shardNumber).padStart(2, '0')}-${slugify(subsection.title)}.md`,
          content: subsection.content,
          type: 'architecture',
          shardNumber,
          metadata: {
            wordCount: subsection.content.split(' ').length,
            parentSection: section.title
          }
        });
        shardNumber++;
      }
    } else {
      shards.push({
        id: `arch-${String(shardNumber).padStart(2, '0')}`,
        title: section.title,
        filename: `${String(shardNumber).padStart(2, '0')}-${slugify(section.title)}.md`,
        content: section.content,
        type: 'architecture',
        shardNumber,
        metadata: {
          wordCount: sectionSize
        }
      });
      shardNumber++;
    }
  }

  return shards;
}

function createStoryShards(sections, maxShardSize, projectName) {
  // Stories are typically individual files, not sharded
  return sections.map((section, index) => ({
    id: `story-${index + 1}`,
    title: section.title,
    filename: `1.${index + 1}.story.md`,
    content: section.content,
    type: 'story',
    storyNumber: index + 1,
    epicNumber: 1,
    metadata: {
      wordCount: section.content.split(' ').length
    }
  }));
}

function createGenericShards(sections, maxShardSize, projectName) {
  const shards = [];
  let shardNumber = 1;

  for (const section of sections) {
    shards.push({
      id: `section-${shardNumber}`,
      title: section.title,
      filename: `${String(shardNumber).padStart(2, '0')}-${slugify(section.title)}.md`,
      content: section.content,
      type: 'generic',
      shardNumber,
      metadata: {
        wordCount: section.content.split(' ').length
      }
    });
    shardNumber++;
  }

  return shards;
}

function splitLargeSection(section, maxSize) {
  // Split large sections into smaller parts while maintaining coherence
  const paragraphs = section.content.split('\n\n');
  const subsections = [];
  let currentSubsection = null;
  let currentSize = 0;

  for (const paragraph of paragraphs) {
    const paragraphSize = paragraph.split(' ').length;

    if (!currentSubsection || currentSize + paragraphSize > maxSize) {
      if (currentSubsection) {
        subsections.push(currentSubsection);
      }

      currentSubsection = {
        title: `${section.title} (Part ${subsections.length + 1})`,
        content: paragraph
      };
      currentSize = paragraphSize;
    } else {
      currentSubsection.content += `\n\n${paragraph}`;
      currentSize += paragraphSize;
    }
  }

  if (currentSubsection) {
    subsections.push(currentSubsection);
  }

  return subsections;
}

function generateOutputPaths(documentType, shards, coreConfig) {
  const basePath = coreConfig.outputPaths?.[documentType] || `docs/${documentType}/`;
  
  return shards.map(shard => ({
    shardId: shard.id,
    filename: shard.filename,
    fullPath: path.join(basePath, shard.filename),
    relativePath: `${basePath}${shard.filename}`
  }));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function GET() {
  return NextResponse.json({
    name: 'BMAD Document Sharding API',
    description: 'Breaks down large documents into manageable shards following BMAD methodology',
    version: '1.0.0',
    
    usage: {
      method: 'POST',
      endpoint: '/api/bmad/documents/shard',
      body: {
        documentId: 'Document identifier',
        documentType: 'prd | architecture | stories | generic',
        content: 'Full document content in markdown',
        projectName: 'Optional project name for context'
      }
    },
    
    features: [
      'Epic-based PRD sharding',
      'Component-based architecture sharding', 
      'Individual story file generation',
      'Configurable shard sizes',
      'BMAD core-config.yaml integration',
      'Maintains markdown formatting'
    ]
  });
}