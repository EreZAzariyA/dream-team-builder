import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

const CORE_CONFIG_PATH = path.join(process.cwd(), '.bmad-core', 'core-config.yaml');

/**
 * GET /api/bmad/core-config - Get current BMAD core configuration
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const configData = await loadCoreConfig();

    return NextResponse.json({
      success: true,
      config: configData.config,
      rawContent: configData.rawContent,
      lastModified: configData.lastModified,
      path: '.bmad-core/core-config.yaml'
    });

  } catch (error) {
    console.error('Error loading core config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load core configuration',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * PUT /api/bmad/core-config - Update BMAD core configuration
 */
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { content } = await request.json();
    
    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'Configuration content is required'
      }, { status: 400 });
    }

    // Validate YAML syntax
    try {
      yaml.load(content);
    } catch (yamlError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid YAML syntax',
        details: yamlError.message
      }, { status: 400 });
    }

    // Ensure .bmad-core directory exists
    const bmadCoreDir = path.dirname(CORE_CONFIG_PATH);
    await fs.mkdir(bmadCoreDir, { recursive: true });

    // Write the configuration
    await fs.writeFile(CORE_CONFIG_PATH, content, 'utf8');

    // Load the updated configuration
    const configData = await loadCoreConfig();

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      config: configData.config,
      lastModified: configData.lastModified
    });

  } catch (error) {
    console.error('Error updating core config:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update core configuration',
      details: error.message
    }, { status: 500 });
  }
}

async function loadCoreConfig() {
  try {
    // Check if file exists
    await fs.access(CORE_CONFIG_PATH);
    
    // Read the file
    const rawContent = await fs.readFile(CORE_CONFIG_PATH, 'utf8');
    const stats = await fs.stat(CORE_CONFIG_PATH);
    
    // Parse YAML
    const config = yaml.load(rawContent) || {};
    
    return {
      config: processConfig(config),
      rawContent,
      lastModified: stats.mtime.toISOString()
    };
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default configuration
      const defaultConfig = getDefaultCoreConfig();
      const defaultContent = yaml.dump(defaultConfig, { indent: 2 });
      
      return {
        config: defaultConfig,
        rawContent: defaultContent,
        lastModified: null
      };
    }
    throw error;
  }
}

function processConfig(rawConfig) {
  // Process and validate the configuration structure
  return {
    markdownExploder: rawConfig.markdownExploder || false,
    
    prd: {
      prdFile: rawConfig.prd?.prdFile || 'docs/prd.md',
      prdVersion: rawConfig.prd?.prdVersion || 'v1',
      prdSharded: rawConfig.prd?.prdSharded || false,
      prdShardedLocation: rawConfig.prd?.prdShardedLocation || 'docs/prd',
      epicFilePattern: rawConfig.prd?.epicFilePattern || 'epic-{n}*.md'
    },
    
    architecture: {
      architectureFile: rawConfig.architecture?.architectureFile || 'docs/architecture.md',
      architectureVersion: rawConfig.architecture?.architectureVersion || 'v1',
      architectureSharded: rawConfig.architecture?.architectureSharded || false,
      architectureShardedLocation: rawConfig.architecture?.architectureShardedLocation || 'docs/architecture'
    },
    
    customTechnicalDocuments: rawConfig.customTechnicalDocuments || null,
    
    devLoadAlwaysFiles: rawConfig.devLoadAlwaysFiles || [],
    devDebugLog: rawConfig.devDebugLog || '.ai/debug-log.md',
    devStoryLocation: rawConfig.devStoryLocation || 'docs/stories',
    
    slashPrefix: rawConfig.slashPrefix || 'BMad',
    
    // Additional settings that might be in the config
    ...Object.keys(rawConfig)
      .filter(key => ![
        'markdownExploder', 'prd', 'architecture', 'customTechnicalDocuments',
        'devLoadAlwaysFiles', 'devDebugLog', 'devStoryLocation', 'slashPrefix'
      ].includes(key))
      .reduce((obj, key) => {
        obj[key] = rawConfig[key];
        return obj;
      }, {})
  };
}

function getDefaultCoreConfig() {
  return {
    markdownExploder: true,
    
    prd: {
      prdFile: 'docs/prd.md',
      prdVersion: 'v4',
      prdSharded: true,
      prdShardedLocation: 'docs/prd',
      epicFilePattern: 'epic-{n}*.md'
    },
    
    architecture: {
      architectureFile: 'docs/architecture.md',
      architectureVersion: 'v4',
      architectureSharded: true,
      architectureShardedLocation: 'docs/architecture'
    },
    
    customTechnicalDocuments: null,
    
    devLoadAlwaysFiles: [
      'docs/architecture/coding-standards.md',
      'docs/architecture/tech-stack.md',
      'docs/architecture/source-tree.md'
    ],
    
    devDebugLog: '.ai/debug-log.md',
    devStoryLocation: 'docs/stories',
    slashPrefix: 'BMad'
  };
}