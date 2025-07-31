import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';
import { User } from '../../../../lib/database/models/index.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();
    
    // Get updated user data from database
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if we need to refresh GitHub token
    const { refreshGitHub } = await request.json().catch(() => ({}));
    
    if (refreshGitHub && user.githubId) {
      // In a real scenario, you would refresh the GitHub token here
      // For now, we'll just indicate that the user needs to reconnect
      return NextResponse.json({
        success: false,
        needsReconnect: true,
        message: 'GitHub token needs to be refreshed. Please reconnect your account.'
      });
    }

    // Return updated user data that can be used to update the client-side session
    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.profile.name,
        image: user.profile.avatar,
        role: user.profile.role,
        isEmailVerified: user.isEmailVerified,
        githubId: user.githubId,
        hasGitHubToken: !!user.githubAccessToken
      }
    });

  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    );
  }
}