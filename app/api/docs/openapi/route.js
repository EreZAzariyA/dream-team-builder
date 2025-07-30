import { NextResponse } from 'next/server';
import OpenAPIGenerator from '../../../../lib/docs/openapi-generator.js';

export async function GET(request) {
  try {
    const generator = new OpenAPIGenerator();
    const spec = await generator.generateSpec();
    
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to generate OpenAPI specification', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { outputPath } = await request.json();
    
    const generator = new OpenAPIGenerator();
    const savedPath = await generator.generate(outputPath || 'docs/openapi.json');
    
    return NextResponse.json({ 
      success: true, 
      message: 'OpenAPI specification generated successfully',
      path: savedPath
    });
  } catch (error) {
    console.error('Error saving OpenAPI spec:', error);
    return NextResponse.json(
      { error: 'Failed to save OpenAPI specification', details: error.message },
      { status: 500 }
    );
  }
}