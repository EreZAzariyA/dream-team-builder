import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';
import s3Service from '@/lib/storage/S3Service.js';

/**
 * Build a tree structure from S3 file list
 * @param {Array} files - Array of S3 file objects
 * @param {string} userId - User ID to remove from paths
 * @returns {Object} Tree structure
 */
function buildFileTree(files, userId) {
  const tree = {};
  
  files.forEach(file => {
    // Remove userId prefix from path: "userId/agents-chat/architect/file.md" -> "agents-chat/architect/file.md"
    const relativePath = file.key.replace(`${userId}/`, '');
    const parts = relativePath.split('/');
    
    let current = tree;
    
    // Build nested structure
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (i === parts.length - 1) {
        // This is a file
        if (!current.files) current.files = [];
        current.files.push({
          name: part,
          key: file.key,
          size: file.size,
          lastModified: file.lastModified,
          type: 'file'
        });
      } else {
        // This is a folder
        if (!current.folders) current.folders = {};
        if (!current.folders[part]) {
          current.folders[part] = {
            name: part,
            type: 'folder',
            path: parts.slice(0, i + 1).join('/'),
            expanded: false
          };
        }
        current = current.folders[part];
      }
    }
  });
  
  return tree;
}

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
    const file = searchParams.get('file');
    const userId = session.user.id;

    if (file) {
      // Read specific file from S3
      try {
        // Security check: ensure user can only access their own files
        if (!file.startsWith(userId + '/')) {
          return NextResponse.json({
            success: false,
            error: 'Access denied'
          }, { status: 403 });
        }

        const content = await s3Service.readFile(file);
        return NextResponse.json({ 
          success: true, 
          content 
        });
      } catch (error) {
        console.error('Failed to read S3 file:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'File not found' 
        }, { status: 404 });
      }
    } else {
      // List ALL user's S3 files (both agents-chat and agent-teams)
      try {
        const prefix = `${userId}/`;
        const s3Files = await s3Service.listFiles(prefix);
        
        // Build tree structure from S3 files
        const tree = buildFileTree(s3Files, userId);
        
        return NextResponse.json({ 
          success: true, 
          tree,
          files: s3Files.map(file => ({
            key: file.key,
            name: file.key.split('/').pop(),
            path: file.key,
            size: file.size,
            lastModified: file.lastModified,
            url: file.url,
            type: 'agent-generated'
          }))
        });
      } catch (error) {
        console.error('Failed to list S3 files:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to fetch documents' 
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Docs API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Server error'
    }, { status: 500 });
  }
}
