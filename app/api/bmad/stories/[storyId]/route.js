import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * PATCH /api/bmad/stories/[storyId] - Update story status
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { storyId } = await params;
    const updateData = await request.json();

    // TODO: Update story in database
    // For now, return success response
    const updatedStory = {
      id: storyId,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      story: updatedStory,
      message: 'Story updated successfully'
    });

  } catch (error) {
    console.error('Error updating story:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update story',
      details: error.message
    }, { status: 500 });
  }
}