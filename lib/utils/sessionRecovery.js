/**
 * Session Recovery Utilities
 * Handles session restoration and debugging for authentication issues
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/config.js';
import { findUserBySession } from './userLookup.js';
import logger from './logger.js';

/**
 * Attempt to recover a valid session from various sources
 * @param {Request} request - Next.js request object
 * @returns {Promise<{session: Object|null, recovered: boolean, method: string}>}
 */
export async function attemptSessionRecovery() {
  try {
    // Standard session retrieval
    let session = await getServerSession(authOptions);
    
    if (session && session.user) {
      // Validate that the session corresponds to a real user
      const user = await findUserBySession(session);
      if (user) {
        return {
          session,
          recovered: false,
          method: 'standard'
        };
      } else {
        logger.warn('Session exists but user not found, attempting recovery');
      }
    }

    // Recovery attempt 1: Check if session exists but user ID is wrong format
    if (session && session.user && session.user.email) {
      const user = await findUserBySession(session);
      if (user) {
        // Update session with correct user ID
        session.user.id = user._id.toString();
        logger.info('Session recovered by correcting user ID');
        return {
          session,
          recovered: true,
          method: 'id_correction'
        };
      }
    }

    // No recovery possible
    return {
      session: null,
      recovered: false,
      method: 'none'
    };

  } catch (error) {
    logger.error('Session recovery failed:', error);
    return {
      session: null,
      recovered: false,
      method: 'error'
    };
  }
}

/**
 * Debug session issues with detailed logging
 * @param {Request} request - Next.js request object
 * @param {Object} session - Session object
 */
export function debugSessionIssues(request, session) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    hasSession: !!session,
    sessionDetails: session ? {
      hasUser: !!session.user,
      userId: session.user?.id,
      userEmail: session.user?.email,
      userRole: session.user?.role
    } : null,
    cookies: {
      sessionToken: !!request.cookies.get('next-auth.session-token'),
      secureSessionToken: !!request.cookies.get('__Secure-next-auth.session-token'),
      csrfToken: !!request.cookies.get('next-auth.csrf-token')
    }
  };

  logger.info('Session debug info:', debugInfo);
  return debugInfo;
}

/**
 * Enhanced session validation with detailed error reporting
 * @param {Request} request - Next.js request object
 * @returns {Promise<{valid: boolean, session: Object|null, error: string|null}>}
 */
export async function validateSessionWithRecovery(request) {
  try {
    const { session, recovered, method } = await attemptSessionRecovery(request);
    
    if (session) {
      if (recovered) {
        logger.info(`Session recovered using method: ${method}`);
      }
      
      return {
        valid: true,
        session,
        error: null
      };
    }

    const debugInfo = debugSessionIssues(request, session);
    return {
      valid: false,
      session: null,
      error: 'No valid session found',
      debugInfo
    };

  } catch (error) {
    logger.error('Session validation with recovery failed:', error);
    return {
      valid: false,
      session: null,
      error: error.message
    };
  }
}