
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET(request, { params }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workflowId } = await params;
    const filePath = path.join(process.cwd(), '.bmad-core', 'workflows', `${workflowId}.yaml`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents);

    return NextResponse.json(data.workflow);
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
