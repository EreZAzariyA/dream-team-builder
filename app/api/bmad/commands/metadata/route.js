
import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../../../lib/utils/routeAuth.js';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const BMAD_CORE_DIR = path.join(process.cwd(), '.bmad-core');
const AGENTS_DIR = path.join(BMAD_CORE_DIR, 'agents');
const TEMPLATES_DIR = path.join(BMAD_CORE_DIR, 'templates');
const TASKS_DIR = path.join(BMAD_CORE_DIR, 'tasks');
const CHECKLISTS_DIR = path.join(BMAD_CORE_DIR, 'checklists');

async function loadBmadCommands() {
  const commands = {};
  try {
    const files = await fs.readdir(AGENTS_DIR);
    const agentFiles = files.filter(file => file.endsWith('.md'));

    for (const file of agentFiles) {
      try {
        const filePath = path.join(AGENTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const yamlMatch = content.match(/```yaml\s*\n([\s\S]*?)\n```/);

        if (!yamlMatch) {
          console.warn(`No YAML block found in ${file}`);
          continue;
        }

        const yamlContent = yamlMatch[1];
        const agentData = yaml.load(yamlContent);

        if (!agentData) {
          console.warn(`Failed to parse YAML in ${file}`);
          continue;
        }

        if (agentData && agentData.agent && agentData.commands) {
          const agentId = `@${agentData.agent.id}`;
          
          // Handle commands - can be array or object
          let commandsList = [];
          if (Array.isArray(agentData.commands)) {
            commandsList = agentData.commands.map(cmd => {
              if (typeof cmd === 'string') {
                return { name: cmd, description: '' };
              } else if (typeof cmd === 'object' && cmd !== null) {
                const [name, description] = Object.entries(cmd)[0];
                return { 
                  name, 
                  description: typeof description === 'string' ? description : ''
                };
              }
              return { name: 'unknown', description: '' };
            });
          } else if (typeof agentData.commands === 'object') {
            // Commands as object (key-value pairs)
            commandsList = Object.entries(agentData.commands).map(([name, description]) => ({
              name,
              description: typeof description === 'string' ? description : ''
            }));
          }

          commands[agentId] = {
            name: agentData.agent.name,
            title: agentData.agent.title,
            icon: agentData.agent.icon,
            commands: commandsList,
            description: agentData.agent.whenToUse || agentData.persona?.identity || '',
            dependencies: agentData.dependencies || {},
            persona: {
              role: agentData.persona?.role || '',
              style: agentData.persona?.style || '',
              identity: agentData.persona?.identity || '',
              focus: agentData.persona?.focus || ''
            }
          };
          
          console.log(`Successfully loaded agent: ${agentId} (${agentData.agent.name})`);
        } else {
          console.warn(`Invalid agent structure in ${file}: missing agent/commands`);
        }
      } catch (fileError) {
        console.error(`Error processing ${file}:`, fileError.message);
      }
    }
  } catch (error) {
    console.error('Error loading BMAD commands dynamically:', error);
  }
  return commands;
}

async function loadTemplates() {
  const templates = [];
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const templateFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

    for (const file of templateFiles) {
      try {
        const filePath = path.join(TEMPLATES_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const templateData = yaml.load(content);
        
        templates.push({
          id: file.replace(/\.(yaml|yml)$/, ''),
          name: templateData?.metadata?.title || file.replace(/\.(yaml|yml)$/, '').replace(/-/g, ' '),
          description: templateData?.metadata?.description || `Template: ${file}`,
          file: file,
          path: filePath,
          type: templateData?.metadata?.type || 'document'
        });
      } catch (fileError) {
        console.error(`Error processing template ${file}:`, fileError.message);
      }
    }
  } catch (error) {
    console.error('Error loading templates:', error);
  }
  return templates;
}

async function loadAvailableFiles() {
  const files = [];
  const docsDir = path.join(process.cwd(), 'docs');
  
  try {
    // Check if docs directory exists
    await fs.access(docsDir);
    
    const docFiles = await fs.readdir(docsDir, { withFileTypes: true });
    
    for (const file of docFiles) {
      if (file.isFile() && file.name.endsWith('.md')) {
        files.push({
          name: file.name,
          path: path.join(docsDir, file.name),
          type: 'document',
          category: 'Project Documents'
        });
      } else if (file.isDirectory()) {
        // Check subdirectories like docs/prd/, docs/stories/
        const subDir = path.join(docsDir, file.name);
        try {
          const subFiles = await fs.readdir(subDir);
          for (const subFile of subFiles) {
            if (subFile.endsWith('.md')) {
              files.push({
                name: `${file.name}/${subFile}`,
                path: path.join(subDir, subFile),
                type: 'document',
                category: `${file.name} Documents`
              });
            }
          }
        } catch (subError) {
          // Directory not accessible, skip
        }
      }
    }
  } catch (error) {
    // docs directory doesn't exist or not accessible
    console.warn('Docs directory not found or not accessible');
  }
  
  return files;
}

export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'templates') {
      const templates = await loadTemplates();
      return NextResponse.json({ templates }, { status: 200 });
    }

    if (type === 'files') {
      const files = await loadAvailableFiles();
      return NextResponse.json({ files }, { status: 200 });
    }

    // Default: return commands
    const BMAD_COMMANDS = await loadBmadCommands();
    return NextResponse.json({ commands: BMAD_COMMANDS }, { status: 200 });
    
  } catch (error) {
    console.error('Failed to fetch BMAD metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch BMAD metadata' }, { status: 500 });
  }
}
