/**
 * Universal Route Authentication Helper
 * Consistent authentication for all API routes
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/config.js';
import { validateSessionAndGetUser } from './userLookup.js';
import logger from './logger.js';

/**
 * Universal authentication check for API routes
 * @param {Request} request - The incoming request
 * @returns {Promise<{user: Object|null, session: Object|null, error: NextResponse|null}>}
 */
export async function authenticateRoute() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return {
        user: null,
        session: null,
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      };
    }

    const { user, error, status } = await validateSessionAndGetUser(session);
    
    if (error) {
      return {
        user: null,
        session: null,
        error: NextResponse.json({ error }, { status })
      };
    }

    return {
      user,
      session,
      error: null
    };

  } catch (authError) {
    logger.error('Route authentication failed:', authError);
    return {
      user: null,
      session: null,
      error: NextResponse.json(
        { error: 'Authentication system error' },
        { status: 500 }
      )
    };
  }
}

/**
 * HOF to wrap route handlers with authentication
 * @param {Function} handler - The route handler function
 * @returns {Function} - The wrapped handler
 */
export function withRouteAuth(handler) {
  return async function(request, ...args) {
    const { user, session, error } = await authenticateRoute(request);
    
    if (error) {
      return error;
    }
    
    // Attach user and session to request for handler access
    request.user = user;
    request.session = session;
    
    return handler(request, ...args);
  };
}