
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { documentId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'md'; // Default to markdown

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Placeholder for actual export logic
    console.log(`Exporting document ${documentId} in format: ${format}`);

    const exportedContent = `Content of ${documentId} in ${format} format.`;

    // In a real scenario, you would set appropriate headers for file download
    return new NextResponse(exportedContent, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${documentId}.${format}"`, // Suggests filename for download
        'Content-Type': 'text/plain', // Placeholder, adjust based on actual format
      },
    });
  } catch (error) {
    console.error('Error exporting document:', error);
    return NextResponse.json({ error: 'Failed to export document' }, { status: 500 });
  }
}
