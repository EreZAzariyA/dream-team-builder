import { NextResponse } from 'next/server';
import { authenticateRoute } from '../../../lib/utils/routeAuth.js';
import WorkflowTemplate from '../../../lib/database/models/WorkflowTemplate.js';
import { connectMongoose } from '../../../lib/database/mongodb.js';

export async function GET(request) {
  try {
    const { user, session, error } = await authenticateRoute(request);
    if (error) return error;

    await connectMongoose();
    
    // Load workflow templates from database (agent teams are workflow templates)
    const agentTeamTemplates = await WorkflowTemplate.find({
      status: 'active',
      category: 'agent-team' // Assuming agent teams have a category
    }).lean();
    
    const agentTeams = [];

    for (const template of agentTeamTemplates) {
      try {
        const parsedData = template.config;
        
        // Add metadata from database
        const teamData = {
          id: template.templateId,
          templateId: template.templateId,
          name: template.name,
          description: template.description,
          ...parsedData,
          agents: parsedData.agents || [],
          workflows: parsedData.workflows || []
        };
        
        agentTeams.push(teamData);
      } catch (dbError) {
        console.error(`Error processing template ${template.templateId}:`, dbError);
        // Continue processing other templates even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      data: agentTeams,
      count: agentTeams.length
    });

  } catch (error) {
    console.error('Error reading agent teams from database:', error);
    return NextResponse.json(
      { error: 'Failed to read agent teams configuration from database' },
      { status: 500 }
    );
  }
}