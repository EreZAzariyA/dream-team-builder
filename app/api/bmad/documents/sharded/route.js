import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * Get all sharded documents from the project
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const shardedDocuments = await loadShardedDocuments();

    return NextResponse.json({
      success: true,
      shardedDocuments,
      meta: {
        totalGroups: shardedDocuments.length,
        totalShards: shardedDocuments.reduce((sum, group) => sum + (group.shards?.length || 0), 0)
      }
    });

  } catch (error) {
    console.error('Error loading sharded documents:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load sharded documents',
      details: error.message
    }, { status: 500 });
  }
}

async function loadShardedDocuments() {
  const shardedDocuments = [];
  const docsDir = path.join(process.cwd(), 'docs');

  try {
    // Check if docs directory exists
    await fs.access(docsDir);
    
    const docFiles = await fs.readdir(docsDir, { withFileTypes: true });
    
    for (const file of docFiles) {
      if (file.isDirectory()) {
        const dirPath = path.join(docsDir, file.name);
        const shardGroup = await loadShardGroup(file.name, dirPath);
        
        if (shardGroup && shardGroup.shards.length > 0) {
          shardedDocuments.push(shardGroup);
        }
      }
    }
  } catch (error) {
    console.warn('Docs directory not found or not accessible:', error.message);
  }

  return shardedDocuments;
}

async function loadShardGroup(groupName, dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    if (markdownFiles.length === 0) {
      return null;
    }

    const shards = [];
    
    for (const file of markdownFiles) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      
      // Read first few lines to get title
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const titleLine = lines.find(line => line.startsWith('#'));
      const title = titleLine ? titleLine.replace(/^#+\s*/, '') : file.replace('.md', '');
      
      shards.push({
        name: file,
        title: title,
        path: filePath,
        relativePath: `docs/${groupName}/${file}`,
        size: formatFileSize(stats.size),
        type: inferShardType(file, content),
        wordCount: content.split(/\s+/).length,
        lastModified: stats.mtime.toISOString()
      });
    }

    // Sort shards by filename (which should maintain order for epic-1, epic-2, etc.)
    shards.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return {
      name: groupName,
      displayName: formatGroupName(groupName),
      path: dirPath,
      shards: shards,
      type: inferGroupType(groupName),
      totalShards: shards.length,
      totalWords: shards.reduce((sum, shard) => sum + shard.wordCount, 0),
      lastModified: Math.max(...shards.map(s => new Date(s.lastModified).getTime()))
    };

  } catch (error) {
    console.error(`Error loading shard group ${groupName}:`, error);
    return null;
  }
}

function formatGroupName(groupName) {
  return groupName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function inferGroupType(groupName) {
  const name = groupName.toLowerCase();
  if (name.includes('prd')) return 'prd';
  if (name.includes('architecture') || name.includes('arch')) return 'architecture';
  if (name.includes('story') || name.includes('stories')) return 'stories';
  if (name.includes('epic')) return 'epics';
  return 'document';
}

function inferShardType(filename, content) {
  const name = filename.toLowerCase();
  
  if (name.startsWith('epic-')) return 'epic';
  if (name.match(/^\d+-/)) return 'section';
  if (name.includes('story')) return 'story';
  if (name.includes('overview')) return 'overview';
  
  // Analyze content for more hints
  if (content.includes('## User Stories') || content.includes('As a user')) return 'epic';
  if (content.includes('## Technical Specifications') || content.includes('### API')) return 'technical';
  if (content.includes('## Architecture') || content.includes('### Components')) return 'architecture';
  
  return 'section';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
}