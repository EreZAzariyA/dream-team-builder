
import { NextResponse } from 'next/server';
import { withRouteAuth } from '../../../lib/utils/routeAuth.js';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import logger from '@/lib/utils/logger.js';
import { compose, withMethods, withDatabase, withErrorHandling, withLogging } from '../../../lib/api/middleware.js';

const handler = async (req) => {
  // Authentication is handled by withRouteAuth wrapper
  const workflowsDir = path.join(process.cwd(), '.bmad-core', 'workflows');
  
  // Check if directory exists
  if (!fs.existsSync(workflowsDir)) {
    logger.warn('Workflows directory not found:', workflowsDir);
    return NextResponse.json([]);
  }
  
  const files = fs.readdirSync(workflowsDir).filter(file => file.endsWith('.yaml'));
  logger.info(`Found ${files.length} workflow files:`, files);

  const workflows = files.map((file, index) => {
    try {
      const filePath = path.join(workflowsDir, file);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const data = yaml.load(fileContents);
      
      // Extract workflow data and add necessary fields
      const workflow = data.workflow;
      return {
        ...workflow,
        id: workflow.id || file.replace('.yaml', ''), // Use filename as fallback ID
        filename: file,
        sequence: workflow.sequence || []
      };
    } catch (fileError) {
      logger.error(`Error processing workflow file ${file}:`, fileError);
      return null;
    }
  }).filter(Boolean); // Remove null entries

  logger.info(`Successfully loaded ${workflows.length} workflows`);
  return NextResponse.json(workflows);
};

export const GET = compose(
  withMethods(['GET']),
  withDatabase,
  withLogging,
  withErrorHandling
)(withRouteAuth(handler));

