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

// Custom hook to sync NextAuth session with Redux store
export const useAuthSync = () => {
  const { data: session, status } = useSession();
  const dispatch = useDispatch();
  const reduxUser = useSelector(selectUser);
  const reduxAuthStatus = useSelector(selectAuthStatus);

  useEffect(() => {
    // Update Redux store when NextAuth session changes
    if (status === 'loading') {
      dispatch(setAuthStatus('loading'));
    } else if (status === 'authenticated' && session?.user) {
      dispatch(setUser(session.user));
      dispatch(setAuthStatus('authenticated'));
    } else if (status === 'unauthenticated') {
      dispatch(clearUser());
      dispatch(setAuthStatus('unauthenticated'));
    }
  }, [session, status, dispatch]);

  return {
    session,
    status,
    user: reduxUser || session?.user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
};

// Hook for authentication state from Redux
export const useAuth = () => {
  const user = useSelector(selectUser);
  const authStatus = useSelector(selectAuthStatus);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  return {
    user,
    authStatus,
    isAuthenticated,
    isLoading: authStatus === 'loading',
    isUnauthenticated: authStatus === 'unauthenticated',
  };
};

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