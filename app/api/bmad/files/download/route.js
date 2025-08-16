import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    // Get authenticated user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');
    
    if (!filePath) {
      return NextResponse.json({
        success: false,
        error: 'File path required'
      }, { status: 400 });
    }

    // Security check: ensure file is in allowed directory
    const tempDir = path.join(process.cwd(), 'temp', 'agent-files');
    const resolvedPath = path.resolve(filePath);
    const resolvedTempDir = path.resolve(tempDir);
    
    if (!resolvedPath.startsWith(resolvedTempDir)) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'File not found'
      }, { status: 404 });
    }

    // Read and return file
    const fileContent = await fs.readFile(resolvedPath, 'utf8');
    const fileName = path.basename(resolvedPath);
    
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json({
      success: false,
      error: 'Download failed',
      message: error.message
    }, { status: 500 });
  }
}