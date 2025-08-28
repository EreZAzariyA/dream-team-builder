import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth/config.js';
import User from '../../../../lib/database/models/User.js';
import { connectMongoose } from '../../../../lib/database/mongodb.js';

/**
 * GET /api/admin/users - Get all users (admin only)
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check authentication and admin role
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();
    
    // Fetch all users with selective fields (note: name and role are nested under profile)
    const users = await User.find({}, {
      _id: 1,
      'profile.name': 1,
      email: 1,
      'profile.role': 1,
      isActive: 1,
      lastLoginAt: 1,
      createdAt: 1,
      updatedAt: 1,
      preferences: 1
    }).sort({ createdAt: -1 }).lean();

    // Format users data
    const formattedUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.profile?.name || user.email?.split('@')[0] || 'Unknown',
      email: user.email,
      role: user.profile?.role || 'user',
      status: user.isActive !== false ? 'active' : 'inactive',
      lastLogin: user.lastLoginAt || user.createdAt,
      createdAt: user.createdAt,
      workflowCount: 0 // TODO: Calculate from actual workflow data
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
      stats: {
        total: formattedUsers.length,
        active: formattedUsers.filter(u => u.status === 'active').length,
        inactive: formattedUsers.filter(u => u.status === 'inactive').length,
        admins: formattedUsers.filter(u => u.role === 'admin').length,
        users: formattedUsers.filter(u => u.role === 'user').length
      }
    });

  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch users',
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users - Update user (admin only)
 */
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check authentication and admin role
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, updates } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await connectMongoose();
    
    // Find and update user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update allowed fields (handle nested profile fields)
    const allowedUpdates = ['name', 'role', 'isActive'];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        if (key === 'name') {
          // Name is nested under profile
          if (!user.profile) user.profile = {};
          user.profile.name = value;
        } else if (key === 'role') {
          // Role is nested under profile
          if (!user.profile) user.profile = {};
          user.profile.role = value;
        } else {
          // Other fields are direct
          user[key] = value;
        }
      }
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id.toString(),
        name: user.profile?.name || user.email?.split('@')[0] || 'Unknown',
        email: user.email,
        role: user.profile?.role || 'user',
        status: user.isActive !== false ? 'active' : 'inactive'
      }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ 
      error: 'Failed to update user',
      message: error.message 
    }, { status: 500 });
  }
}