import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * BMAD Document Export API
 * 
 * Exports BMAD documents in multiple formats (MD, PDF, DOC, HTML)
 * Handles single document and bulk export operations
 * Maintains BMAD formatting and metadata
 */

export async function POST(request) {
  try {
    const { documentId, documentIds, format, content, title, options = {} } = await request.json();

    // Validate required fields
    if (!format || (!documentId && !documentIds) || (!content && !documentId)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: format and (documentId or documentIds) and content'
      }, { status: 400 });
    }

    console.log(`📄 BMAD Document Export: ${format} format`);

    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Handle single document export
    if (documentId && content) {
      const exportResult = await exportDocument({
        documentId,
        content,
        title: title || 'BMAD Document',
        format,
        options,
        userId: session.user.id
      });

      return NextResponse.json({
        success: true,
        documentId,
        format,
        exportedAt: new Date().toISOString(),
        ...exportResult
      });
    }

    // Handle bulk export
    if (documentIds && Array.isArray(documentIds)) {
      const bulkExportResult = await exportMultipleDocuments({
        documentIds,
        format,
        options,
        userId: session.user.id
      });

      return NextResponse.json({
        success: true,
        documentIds,
        format,
        exportedAt: new Date().toISOString(),
        ...bulkExportResult
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid export request parameters'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ BMAD document export error:', error);
    return NextResponse.json({
      success: false,
      error: 'Document export failed',
      message: error.message
    }, { status: 500 });
  }
}

async function exportDocument({ documentId, content, title, format, options, userId }) {
  console.log(`📄 Exporting document ${documentId} as ${format}`);

  switch (format.toLowerCase()) {
    case 'md':
    case 'markdown':
      return exportAsMarkdown({ documentId, content, title, options });
    case 'html':
      return exportAsHTML({ documentId, content, title, options });
    case 'pdf':
      return exportAsPDF({ documentId, content, title, options });
    case 'docx':
    case 'doc':
      return exportAsWord({ documentId, content, title, options });
    case 'json':
      return exportAsJSON({ documentId, content, title, options });
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

async function exportAsMarkdown({ documentId, content, title, options }) {
  // Clean up and format markdown content
  let processedContent = content;

  // Add BMAD header if requested
  if (options.includeBmadHeader !== false) {
    const bmadHeader = `<!-- BMAD Document Export -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Document ID: ${documentId} -->
<!-- Format: Markdown -->

`;
    processedContent = bmadHeader + processedContent;
  }

  // Add table of contents if requested
  if (options.includeTableOfContents) {
    const toc = generateTableOfContents(processedContent);
    processedContent = processedContent.replace(/^#\s+.+$/m, (match) => {
      return match + '\n\n' + toc + '\n';
    });
  }

  const filename = `${sanitizeFilename(title || 'document')}.md`;
  
  return {
    format: 'markdown',
    filename,
    content: processedContent,
    size: Buffer.byteLength(processedContent, 'utf8'),
    downloadUrl: createDownloadUrl(filename, processedContent, 'text/markdown')
  };
}

async function exportAsHTML({ documentId, content, title, options }) {
  const { marked } = await import('marked');
  
  // Configure marked for better HTML output
  marked.setOptions({
    gfm: true,
    breaks: true,
    sanitize: false
  });

  const htmlBody = marked(content);
  
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title || 'BMAD Document')}</title>
    <meta name="generator" content="BMAD Document Export">
    <meta name="document-id" content="${documentId}">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2563eb;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
        h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
        code {
            background: #f3f4f6;
            padding: 0.2rem 0.4rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
        }
        pre {
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 1rem;
            margin-left: 0;
            font-style: italic;
            color: #6b7280;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        th, td {
            border: 1px solid #e5e7eb;
            padding: 0.75rem;
            text-align: left;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
        }
        .bmad-footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #e5e7eb;
            font-size: 0.875rem;
            color: #6b7280;
        }
        @media print {
            body { padding: 1rem; }
            .bmad-footer { page-break-inside: avoid; }
        }
    </style>
    ${options.customCSS ? `<style>${options.customCSS}</style>` : ''}
</head>
<body>
    ${htmlBody}
    
    ${options.includeBmadFooter !== false ? `
    <div class="bmad-footer">
        <p><strong>Generated by BMAD (Breakthrough Method for Agile AI Driven Development)</strong></p>
        <p>Document ID: ${documentId} | Exported: ${new Date().toLocaleString()} | Format: HTML</p>
    </div>
    ` : ''}
</body>
</html>`;

  const filename = `${sanitizeFilename(title || 'document')}.html`;
  
  return {
    format: 'html',
    filename,
    content: htmlContent,
    size: Buffer.byteLength(htmlContent, 'utf8'),
    downloadUrl: createDownloadUrl(filename, htmlContent, 'text/html')
  };
}

async function exportAsPDF({ documentId, content, title, options }) {
  // For PDF generation, we'll create a structured response that could be processed
  // by a PDF generation service or library like puppeteer/playwright
  
  const htmlExport = await exportAsHTML({ documentId, content, title, options });
  
  return {
    format: 'pdf',
    filename: `${sanitizeFilename(title || 'document')}.pdf`,
    message: 'PDF export prepared - requires PDF generation service',
    htmlContent: htmlExport.content,
    pdfOptions: {
      format: 'A4',
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size: 10px; text-align: center; width: 100%;">${escapeHtml(title || 'BMAD Document')}</div>`,
      footerTemplate: `<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
    },
    // Note: In production, this would generate actual PDF bytes
    implementationNote: 'PDF generation requires server-side PDF library like puppeteer'
  };
}

async function exportAsWord({ documentId, content, title, options }) {
  // For Word document generation, we'll create a structured response
  // This would typically use a library like docx or mammoth
  
  return {
    format: 'docx',
    filename: `${sanitizeFilename(title || 'document')}.docx`,
    message: 'Word export prepared - requires DOCX generation service',
    content: content,
    wordOptions: {
      title: title || 'BMAD Document',
      creator: 'BMAD System',
      description: `BMAD document export for ${documentId}`,
      styles: {
        heading1: { size: 28, bold: true, color: '2563eb' },
        heading2: { size: 24, bold: true, color: '2563eb' },
        normal: { size: 11, font: 'Calibri' }
      }
    },
    implementationNote: 'DOCX generation requires server-side Word library like docx'
  };
}

async function exportAsJSON({ documentId, content, title, options }) {
  const jsonData = {
    documentId,
    title: title || 'BMAD Document',
    content,
    exportedAt: new Date().toISOString(),
    format: 'json',
    metadata: {
      wordCount: content.split(/\s+/).length,
      lineCount: content.split('\n').length,
      headers: extractHeaders(content),
      bmadExport: true
    },
    ...options
  };

  const jsonContent = JSON.stringify(jsonData, null, 2);
  const filename = `${sanitizeFilename(title || 'document')}.json`;
  
  return {
    format: 'json',
    filename,
    content: jsonContent,
    size: Buffer.byteLength(jsonContent, 'utf8'),
    downloadUrl: createDownloadUrl(filename, jsonContent, 'application/json')
  };
}

async function exportMultipleDocuments({ documentIds, format, options, userId }) {
  console.log(`📄 Bulk exporting ${documentIds.length} documents as ${format}`);
  
  // For bulk export, we'll return export instructions
  // In a production system, this might zip multiple files or create a single combined document
  
  return {
    format,
    bulkExport: true,
    documentCount: documentIds.length,
    message: `Bulk export of ${documentIds.length} documents prepared`,
    exportInstructions: {
      method: 'Individual export recommended for now',
      alternativeEndpoint: '/api/bmad/documents/bulk-export',
      supportedFormats: ['zip', 'combined-pdf', 'combined-html']
    },
    implementationNote: 'Bulk export requires additional file processing and zipping capabilities'
  };
}

// Utility functions
function generateTableOfContents(content) {
  const headers = extractHeaders(content);
  let toc = '## Table of Contents\n\n';
  
  headers.forEach(header => {
    const indent = '  '.repeat(header.level - 1);
    const anchor = header.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    toc += `${indent}- [${header.title}](#${anchor})\n`;
  });
  
  return toc + '\n';
}

function extractHeaders(content) {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers = [];
  let match;
  
  while ((match = headerRegex.exec(content)) !== null) {
    headers.push({
      level: match[1].length,
      title: match[2],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return headers;
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

function escapeHtml(text) {
  const div = { innerHTML: text };
  return div.textContent || div.innerText || '';
}

function createDownloadUrl(filename, content, mimeType) {
  // In a real implementation, this would create a signed URL or file endpoint
  // For now, we'll return a data URL for immediate download
  const base64Content = Buffer.from(content, 'utf8').toString('base64');
  return `data:${mimeType};base64,${base64Content}`;
}

export async function GET() {
  return NextResponse.json({
    name: 'BMAD Document Export API',
    description: 'Export BMAD documents in multiple formats with proper formatting and metadata',
    version: '1.0.0',
    
    usage: {
      method: 'POST',
      endpoint: '/api/bmad/documents/export',
      body: {
        documentId: 'Document identifier',
        content: 'Document content in markdown',
        title: 'Document title',
        format: 'md | html | pdf | docx | json',
        options: 'Optional formatting and export options'
      }
    },
    
    supportedFormats: {
      markdown: 'Clean markdown with BMAD metadata',
      html: 'Responsive HTML with embedded CSS',
      pdf: 'Professional PDF layout (requires PDF service)',
      docx: 'Microsoft Word format (requires DOCX service)',
      json: 'Structured data export with metadata'
    },
    
    features: [
      'Multiple export formats',
      'BMAD metadata preservation',
      'Table of contents generation',
      'Custom styling options',
      'Bulk export capabilities',
      'Professional formatting'
    ],
    
    options: {
      includeBmadHeader: 'Include BMAD export metadata (default: true)',
      includeTableOfContents: 'Generate table of contents (default: false)',
      includeBmadFooter: 'Include BMAD footer in HTML (default: true)',
      customCSS: 'Custom CSS for HTML export',
      pdfOptions: 'PDF generation options',
      wordOptions: 'Word document formatting options'
    }
  });
}