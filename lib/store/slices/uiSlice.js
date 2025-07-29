import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Layout & Navigation
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeTab: 'dashboard',
  
  // Theme & Appearance
  theme: 'light', // 'light' | 'dark' | 'system'
  primaryColor: 'blue',
  
  // Authentication State
  authStatus: 'idle', // 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  user: null,
  
  // Notifications & Alerts
  notifications: [],
  toast: null,
  
  // Modal & Dialog States
  modals: {
    createWorkflow: false,
    agentDetails: false,
    settings: false,
  },
  
  // Loading States
  globalLoading: false,
  loadingStates: {},
  
  // View Preferences
  workflowViewMode: 'grid', // 'grid' | 'list' | 'timeline'
  agentPanelSize: 300, // pixels
  communicationPanelExpanded: true,
  
  // Feature Flags
  features: {
    realtimeUpdates: true,
    agentChat: true,
    workflowTemplates: true,
  }
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Sidebar Management
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    
    // Tab Navigation
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    
    // Theme Management
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setPrimaryColor: (state, action) => {
      state.primaryColor = action.payload;
    },
    
    // Notification System
    addNotification: (state, action) => {
      const notification = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...action.payload
      };
      state.notifications.unshift(notification);
      
      // Keep only last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    // Toast Messages
    showToast: (state, action) => {
      state.toast = {
        id: Date.now(),
        ...action.payload
      };
    },
    hideToast: (state) => {
      state.toast = null;
    },
    
    // Modal Management
    openModal: (state, action) => {
      const { modalName, data } = action.payload;
      state.modals[modalName] = data || true;
    },
    closeModal: (state, action) => {
      state.modals[action.payload] = false;
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key] = false;
      });
    },
    
    // Loading States
    setGlobalLoading: (state, action) => {
      state.globalLoading = action.payload;
    },
    setLoadingState: (state, action) => {
      const { key, loading } = action.payload;
      if (loading) {
        state.loadingStates[key] = true;
      } else {
        delete state.loadingStates[key];
      }
    },
    clearLoadingStates: (state) => {
      state.loadingStates = {};
    },
    
    // View Preferences
    setWorkflowViewMode: (state, action) => {
      state.workflowViewMode = action.payload;
    },
    setAgentPanelSize: (state, action) => {
      state.agentPanelSize = Math.max(200, Math.min(600, action.payload));
    },
    toggleCommunicationPanel: (state) => {
      state.communicationPanelExpanded = !state.communicationPanelExpanded;
    },
    
    // Authentication
    setAuthStatus: (state, action) => {
      state.authStatus = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.authStatus = action.payload ? 'authenticated' : 'unauthenticated';
    },
    clearUser: (state) => {
      state.user = null;
      state.authStatus = 'unauthenticated';
    },
    
    // Feature Flags
    toggleFeature: (state, action) => {
      const feature = action.payload;
      state.features[feature] = !state.features[feature];
    },
    setFeature: (state, action) => {
      const { feature, enabled } = action.payload;
      state.features[feature] = enabled;
    },
    
    // Bulk Updates
    resetUI: (state) => {
      Object.assign(state, initialState);
    },
    updateUIPreferences: (state, action) => {
      Object.assign(state, action.payload);
    }
  }
});

export const {
  // Sidebar
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  
  // Navigation
  setActiveTab,
  
  // Theme
  setTheme,
  setPrimaryColor,
  
  // Authentication
  setAuthStatus,
  setUser,
  clearUser,
  
  // Notifications
  addNotification,
  removeNotification,
  clearNotifications,
  showToast,
  hideToast,
  
  // Modals
  openModal,
  closeModal,
  closeAllModals,
  
  // Loading
  setGlobalLoading,
  setLoadingState,
  clearLoadingStates,
  
  // View Preferences
  setWorkflowViewMode,
  setAgentPanelSize,
  toggleCommunicationPanel,
  
  // Features
  toggleFeature,
  setFeature,
  
  // Bulk
  resetUI,
  updateUIPreferences
} = uiSlice.actions;

// Selectors
export const selectSidebarState = (state) => ({
  open: state.ui.sidebarOpen,
  collapsed: state.ui.sidebarCollapsed
});

export const selectTheme = (state) => state.ui.theme;
export const selectAuthStatus = (state) => state.ui.authStatus;
export const selectUser = (state) => state.ui.user;
export const selectIsAuthenticated = (state) => state.ui.authStatus === 'authenticated';
export const selectNotifications = (state) => state.ui.notifications;
export const selectUnreadNotifications = (state) => 
  state.ui.notifications.filter(n => !n.read);
export const selectToast = (state) => state.ui.toast;
export const selectModals = (state) => state.ui.modals;
export const selectIsLoading = (key) => (state) => 
  state.ui.globalLoading || !!state.ui.loadingStates[key];
export const selectViewPreferences = (state) => ({
  workflowViewMode: state.ui.workflowViewMode,
  agentPanelSize: state.ui.agentPanelSize,
  communicationPanelExpanded: state.ui.communicationPanelExpanded
});
export const selectFeatures = (state) => state.ui.features;

export default uiSlice;