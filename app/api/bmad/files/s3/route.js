import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import s3Service from '@/lib/storage/S3Service.js';

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
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({
        success: false,
        error: 'S3 key required'
      }, { status: 400 });
    }

    // Security check: ensure the user can only access their own files
    const userId = session.user.id;
    if (!key.startsWith(userId + '/')) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Get file from S3
    try {
      const fileContent = await s3Service.readFile(key);
      const filename = key.split('/').pop();
      
      return new NextResponse(fileContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'private, max-age=3600'
        },
      });

    } catch (s3Error) {
      console.error('S3 read error:', s3Error);
      return NextResponse.json({
        success: false,
        error: 'File not found'
      }, { status: 404 });
    }

  } catch (error) {
    console.error('File proxy error:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error',
      message: error.message
    }, { status: 500 });
  }
}