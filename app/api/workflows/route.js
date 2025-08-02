
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET() {
  try {
    const workflowsDir = path.join(process.cwd(), '.bmad-core', 'workflows');
    const files = fs.readdirSync(workflowsDir).filter(file => file.endsWith('.yaml'));

    const workflows = files.map(file => {
      const filePath = path.join(workflowsDir, file);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const data = yaml.load(fileContents);
      return data.workflow;
    });

    return NextResponse.json(workflows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
  }
}
