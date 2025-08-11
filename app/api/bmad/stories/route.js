import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config.js';

/**
 * GET /api/bmad/stories - Get all stories
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

    // TODO: Replace with actual database query
    // For now, return sample data
    const sampleStories = [
      {
        id: 'story-1',
        title: 'User Registration with Email Validation',
        description: 'As a new user, I want to register with email validation so that I can securely access the application.',
        status: 'completed',
        epicName: 'User Authentication',
        storyPoints: 5,
        assignee: 'James (Dev)',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T15:30:00Z',
        acceptanceCriteria: [
          'User can enter email, password, and confirm password',
          'Email validation is performed client-side and server-side',
          'Confirmation email is sent to user',
          'Account is activated only after email confirmation'
        ]
      },
      {
        id: 'story-2',
        title: 'User Login with JWT Authentication',
        description: 'As a registered user, I want to login with my credentials so that I can access my personal tasks.',
        status: 'in_development',
        epicName: 'User Authentication',
        storyPoints: 3,
        assignee: 'James (Dev)',
        createdAt: '2024-01-16T09:00:00Z',
        updatedAt: '2024-01-22T11:45:00Z',
        acceptanceCriteria: [
          'User can login with email and password',
          'JWT token is generated and stored securely',
          'Invalid credentials show appropriate error message',
          'User is redirected to dashboard after successful login'
        ]
      },
      {
        id: 'story-3',
        title: 'Password Reset Functionality',
        description: 'As a user, I want to reset my password if I forget it so that I can regain access to my account.',
        status: 'ready',
        epicName: 'User Authentication',
        storyPoints: 8,
        createdAt: '2024-01-17T14:00:00Z',
        updatedAt: '2024-01-22T16:20:00Z',
        acceptanceCriteria: [
          'User can request password reset via email',
          'Reset link is sent to user email',
          'Reset link expires after 24 hours',
          'User can set new password using valid reset link'
        ]
      }
    ];

    return NextResponse.json({
      success: true,
      stories: sampleStories,
      meta: {
        total: sampleStories.length,
        statuses: sampleStories.reduce((acc, story) => {
          acc[story.status] = (acc[story.status] || 0) + 1;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error loading stories:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load stories',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/bmad/stories - Create a new story
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const storyData = await request.json();

    // TODO: Save to database
    // For now, return the created story with generated ID
    const newStory = {
      ...storyData,
      id: `story_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      story: newStory,
      message: 'Story created successfully'
    });

  } catch (error) {
    console.error('Error creating story:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create story',
      details: error.message
    }, { status: 500 });
  }
}