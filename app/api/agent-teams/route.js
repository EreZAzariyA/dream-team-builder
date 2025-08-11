import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET() {
  try {
    const agentTeamsPath = path.join(process.cwd(), '.bmad-core', 'agent-teams');
    
    // Check if directory exists
    if (!fs.existsSync(agentTeamsPath)) {
      return NextResponse.json({ error: 'Agent teams directory not found' }, { status: 404 });
    }

    // Read all YAML files in the agent-teams directory
    const files = fs.readdirSync(agentTeamsPath).filter(file => file.endsWith('.yaml'));
    
    const agentTeams = [];

    for (const file of files) {
      const filePath = path.join(agentTeamsPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      try {
        const parsedData = yaml.load(fileContent);
        
        // Add metadata about the file
        const teamData = {
          id: file.replace('.yaml', ''),
          fileName: file,
          ...parsedData.bundle,
          agents: parsedData.agents || [],
          workflows: parsedData.workflows || []
        };
        
        agentTeams.push(teamData);
      } catch (yamlError) {
        console.error(`Error parsing YAML file ${file}:`, yamlError);
        // Continue processing other files even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      data: agentTeams,
      count: agentTeams.length
    });

  } catch (error) {
    console.error('Error reading agent teams:', error);
    return NextResponse.json(
      { error: 'Failed to read agent teams configuration' },
      { status: 500 }
    );
  }
}