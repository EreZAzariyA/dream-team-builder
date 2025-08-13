import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route.js';
import User from '../../../../lib/database/models/User.js';
import dbConnect from '../../../../lib/database/mongodb.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await dbConnect();
    
    const user = await User.findByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      preferences: user.preferences 
    });

  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch preferences' 
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences) {
      return NextResponse.json({ error: 'Preferences are required' }, { status: 400 });
    }

    await dbConnect();
    
    const user = await User.findByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update preferences (merge with existing)
    user.preferences = {
      ...user.preferences,
      ...preferences
    };

    await user.save();

    return NextResponse.json({ 
      message: 'Preferences updated successfully',
      preferences: user.preferences 
    });

  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json({ 
      error: 'Failed to update preferences' 
    }, { status: 500 });
  }
}

// Specific theme endpoint for quick theme updates
export async function PUT(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { theme } = body;

    if (!theme || !['light', 'dark', 'system'].includes(theme)) {
      return NextResponse.json({ 
        error: 'Valid theme is required (light, dark, or system)' 
      }, { status: 400 });
    }

    await dbConnect();
    
    const user = await User.findByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update only the theme preference
    user.preferences.theme = theme;
    await user.save();

    return NextResponse.json({ 
      message: 'Theme preference updated successfully',
      theme: user.preferences.theme
    });

  } catch (error) {
    console.error('Error updating theme preference:', error);
    return NextResponse.json({ 
      error: 'Failed to update theme preference' 
    }, { status: 500 });
  }
}