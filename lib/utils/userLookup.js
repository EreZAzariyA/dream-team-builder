/**
 * Utility for consistent user lookup across API routes
 * Handles ObjectId validation and session recovery
 */

import { connectMongoose } from '../database/mongodb.js';
import { User } from '../database/models/index.js';
import logger from './logger.js';

/**
 * Safely find user by session with fallback strategies
 * @param {Object} session - NextAuth session object
 * @returns {Promise<Object|null>} User object or null
 */
export async function findUserBySession(session) {
  if (!session?.user?.id) {
    logger.warn('No session or user ID provided');
    return null;
  }

  await connectMongoose();

  let user = null;
  const mongoose = require('mongoose');

  try {
    // Strategy 1: Try direct ObjectId lookup
    if (mongoose.Types.ObjectId.isValid(session.user.id)) {
      user = await User.findById(session.user.id);
      if (user) {
        logger.debug('User found by ObjectId:', session.user.id);
        return user;
      }
    }

    // Strategy 2: Fallback to email lookup
    if (session.user.email) {
      user = await User.findByEmail(session.user.email);
      if (user) {
        logger.info('User found by email fallback:', session.user.email);
        return user;
      }
    }

    // Strategy 3: Try provider-specific lookup
    if (session.user.githubId) {
      user = await User.findOne({ githubId: session.user.githubId });
      if (user) {
        logger.info('User found by GitHub ID:', session.user.githubId);
        return user;
      }
    }

    if (session.user.googleId) {
      user = await User.findOne({ googleId: session.user.googleId });
      if (user) {
        logger.info('User found by Google ID:', session.user.googleId);
        return user;
      }
    }

    logger.warn('User not found with any strategy:', {
      sessionUserId: session.user.id,
      email: session.user.email,
      githubId: session.user.githubId,
      googleId: session.user.googleId
    });

    return null;

  } catch (error) {
    logger.error('Error in findUserBySession:', {
      error: error.message,
      sessionUserId: session.user.id,
      email: session.user.email
    });
    return null;
  }
}

/**
 * Validate session and return user with detailed error info
 * @param {Object} session - NextAuth session object
 * @returns {Promise<{user: Object|null, error: string|null, status: number}>}
 */
export async function validateSessionAndGetUser(session) {
  if (!session?.user?.id) {
    return {
      user: null,
      error: 'Authentication required',
      status: 401
    };
  }

  const user = await findUserBySession(session);
  
  if (!user) {
    return {
      user: null,
      error: 'User not found',
      status: 404
    };
  }

  if (!user.isActive) {
    return {
      user: null,
      error: 'Account is deactivated',
      status: 403
    };
  }

  return {
    user,
    error: null,
    status: 200
  };
}