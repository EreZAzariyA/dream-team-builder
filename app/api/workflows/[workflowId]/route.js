
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET(request, { params }) {
  try {
    const { workflowId } = await params;
    const filePath = path.join(process.cwd(), '.bmad-core', 'workflows', `${workflowId}.yaml`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents);

    return NextResponse.json(data.workflow);
  } catch (error) {
    logger.error(`Error fetching workflow:`, error);
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 });
  }
}
