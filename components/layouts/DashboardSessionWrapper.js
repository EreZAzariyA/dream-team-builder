'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser, setAuthStatus } from '../../lib/store/slices/uiSlice.js';

/**
 * Dashboard Session Wrapper
 * 
 * This component receives server-side session data and immediately synchronizes
 * it with the Redux store to prevent authentication race conditions.
 * 
 * CRITICAL: This must run before any components that depend on authentication state.
 */
const DashboardSessionWrapper = ({ children, session }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Immediately sync server session with Redux store
    if (session?.user) {
      dispatch(setUser(session.user));
      dispatch(setAuthStatus('authenticated'));
    } else {
      dispatch(setAuthStatus('unauthenticated'));
    }
  }, [session, dispatch]);

  return children;
};

export default DashboardSessionWrapper;