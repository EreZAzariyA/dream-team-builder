import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const docsDirectory = path.join(process.cwd(), 'docs');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  if (file) {
    try {
      const filePath = path.join(docsDirectory, file);
      const content = fs.readFileSync(filePath, 'utf8');
      return NextResponse.json({ content });
    } catch {
      return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
    }
  } else {
    try {
      const files = fs.readdirSync(docsDirectory).filter(f => f.endsWith('.md'));
      return NextResponse.json({ files });
    } catch {
      return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
    }
  }
}
