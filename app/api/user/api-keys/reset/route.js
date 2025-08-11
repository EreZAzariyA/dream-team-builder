/**
 * API Route: Reset corrupted API keys
 * Clears all encrypted API keys from user account
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/database/mongodb';
import { User } from '@/lib/database/models/User';
import logger from '@/lib/utils/logger';
import authOptions from '@/lib/auth/config';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectMongoose();
    
    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Clear all API keys
    user.clearApiKeys();
    await user.save();

    logger.info(`User ${session.user.id} reset their API keys`);

    return NextResponse.json({
      success: true,
      message: 'API keys have been reset successfully'
    });

  } catch (error) {
    logger.error('Reset API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}