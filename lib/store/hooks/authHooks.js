import { useSession } from 'next-auth/react';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { 
  setUser, 
  clearUser, 
  setAuthStatus,
  selectUser, 
  selectAuthStatus, 
  selectIsAuthenticated 
} from '../slices/uiSlice.js';

// Single authentication hook - the source of truth
export const useAuth = () => {
  const { data: session, status } = useSession();
  const dispatch = useDispatch();
  const reduxUser = useSelector(selectUser);
  const reduxAuthStatus = useSelector(selectAuthStatus);

  useEffect(() => {
    // Sync NextAuth session with Redux store
    // CRITICAL: Don't override server-side authenticated state with NextAuth unauthenticated status
    if (status === 'loading') {
      dispatch(setAuthStatus('loading'));
    } else if (status === 'authenticated' && session?.user) {
      dispatch(setUser(session.user));
      dispatch(setAuthStatus('authenticated'));
    } else if (status === 'unauthenticated' && reduxAuthStatus !== 'authenticated') {
      // Only clear user if Redux doesn't already have authenticated state from server hydration
      dispatch(clearUser());
      dispatch(setAuthStatus('unauthenticated'));
    }
  }, [session, status, dispatch, reduxAuthStatus]);

  // Priority-based authentication state logic
  // 1. If Redux has authenticated state (from server hydration), use it immediately
  // 2. Otherwise, fall back to NextAuth session status
  const hasReduxAuth = reduxAuthStatus === 'authenticated' && !!reduxUser;
  const hasNextAuthSession = status === 'authenticated' && !!session?.user;
  
  const isAuthenticated = hasReduxAuth || hasNextAuthSession || (!!session?.user && status !== 'unauthenticated');
  const user = session?.user || reduxUser;
  const authStatus = hasReduxAuth ? reduxAuthStatus : status;


  return {
    session,
    status: authStatus,
    user,
    isAuthenticated,
    isLoading: status === 'loading' && !hasReduxAuth,
    isUnauthenticated: status === 'unauthenticated' && !hasReduxAuth,
    authStatus,
  };
};

// Legacy alias for backward compatibility (will be removed)
export const useAuthSync = useAuth;

// Hook for user permissions
export const usePermissions = () => {
  const user = useSelector(selectUser);
  
  const hasRole = (role) => {
    return user?.role === role;
  };
  
  const hasAnyRole = (roles) => {
    return roles.includes(user?.role);
  };
  
  const isAdmin = () => hasRole('admin');
  const isUser = () => hasRole('user');
  const isModerator = () => hasRole('moderator');
  
  return {
    user,
    hasRole,
    hasAnyRole,
    isAdmin,
    isUser,
    isModerator,
  };
};

// Hook for authentication actions
export const useAuthActions = () => {
  const dispatch = useDispatch();
  
  const updateUser = (userData) => {
    dispatch(setUser(userData));
  };
  
  const logout = () => {
    dispatch(clearUser());
  };
  
  const setStatus = (status) => {
    dispatch(setAuthStatus(status));
  };
  
  return {
    updateUser,
    logout,
    setStatus,
  };
};