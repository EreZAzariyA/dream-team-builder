import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Current Workflow Selection
  selectedWorkflowId: null,
  activeWorkflows: [], // Currently running workflows
  
  // Workflow Creation
  creationMode: false,
  workflowTemplate: null,
  creationStep: 1, // Multi-step workflow creation
  
  // View & Filter Settings
  viewMode: 'grid', // 'grid' | 'list' | 'timeline'
  sortBy: 'created_at', // 'created_at' | 'updated_at' | 'status' | 'name'
  sortOrder: 'desc', // 'asc' | 'desc'
  
  filters: {
    status: 'all', // 'all' | 'running' | 'completed' | 'paused' | 'error'
    dateRange: 'all', // 'all' | 'today' | 'week' | 'month'
    agentType: 'all', // 'all' | specific agent types
    searchQuery: '',
    tags: []
  },
  
  // Workflow Templates
  availableTemplates: [
    'greenfield-fullstack',
    'brownfield-refactor',
    'bug-fix-workflow',
    'feature-enhancement',
    'documentation-generation'
  ],
  
  // Workflow Execution Context
  executionContext: {
    currentStep: null,
    totalSteps: 0,
    estimatedDuration: null,
    startTime: null,
    pausedAt: null,
    errors: []
  },
  
  // Agent Sequence Management
  agentSequence: [], // Ordered list of agents for current workflow
  currentAgentIndex: 0,
  completedAgents: [],
  
  // Workflow History & Analytics
  recentWorkflows: [],
  workflowStats: {
    totalRuns: 0,
    successRate: 0,
    averageDuration: 0,
    mostUsedTemplate: null
  },
  
  // Real-time Status
  realTimeStatus: {
    connected: false,
    reconnecting: false,
    lastHeartbeat: null,
    connectionId: null,
    liveWorkflows: [] // Workflows with active real-time connections
  },
  
  // Collaboration
  collaborators: [], // Users observing current workflow
  sharedWorkflows: [], // Workflows shared with current user
  
  // Advanced Features
  bookmarkedWorkflows: [],
  workflowNotes: {}, // workflowId -> notes
  customWorkflowTypes: []
};

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    // Workflow Selection
    selectWorkflow: (state, action) => {
      const workflowId = action.payload;
      state.selectedWorkflowId = workflowId;
      
      // Add to recent workflows
      if (workflowId && !state.recentWorkflows.includes(workflowId)) {
        state.recentWorkflows.unshift(workflowId);
        // Keep only last 10 recent workflows
        state.recentWorkflows = state.recentWorkflows.slice(0, 10);
      }
    },
    
    clearSelection: (state) => {
      state.selectedWorkflowId = null;
    },
    
    // Workflow Creation
    startWorkflowCreation: (state, action) => {
      state.creationMode = true;
      state.workflowTemplate = action.payload?.template || null;
      state.creationStep = 1;
    },
    
    setCreationStep: (state, action) => {
      state.creationStep = action.payload;
    },
    
    setWorkflowTemplate: (state, action) => {
      state.workflowTemplate = action.payload;
    },
    
    cancelWorkflowCreation: (state) => {
      state.creationMode = false;
      state.workflowTemplate = null;
      state.creationStep = 1;
    },
    
    completeWorkflowCreation: (state, action) => {
      state.creationMode = false;
      state.workflowTemplate = null;
      state.creationStep = 1;
      
      // Set the newly created workflow as selected
      if (action.payload?.workflowId) {
        state.selectedWorkflowId = action.payload.workflowId;
      }
    },
    
    // View & Filters
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    
    setSorting: (state, action) => {
      const { sortBy, sortOrder } = action.payload;
      state.sortBy = sortBy;
      state.sortOrder = sortOrder;
    },
    
    updateFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    
    setSearchQuery: (state, action) => {
      state.filters.searchQuery = action.payload;
    },
    
    addFilterTag: (state, action) => {
      const tag = action.payload;
      if (!state.filters.tags.includes(tag)) {
        state.filters.tags.push(tag);
      }
    },
    
    removeFilterTag: (state, action) => {
      state.filters.tags = state.filters.tags.filter(tag => tag !== action.payload);
    },
    
    // Workflow Execution
    setExecutionContext: (state, action) => {
      state.executionContext = { ...state.executionContext, ...action.payload };
    },
    
    updateCurrentStep: (state, action) => {
      state.executionContext.currentStep = action.payload;
    },
    
    setAgentSequence: (state, action) => {
      state.agentSequence = action.payload;
      state.currentAgentIndex = 0;
      state.completedAgents = [];
      state.executionContext.totalSteps = action.payload.length;
    },
    
    advanceToNextAgent: (state) => {
      if (state.currentAgentIndex < state.agentSequence.length - 1) {
        const currentAgent = state.agentSequence[state.currentAgentIndex];
        state.completedAgents.push(currentAgent);
        state.currentAgentIndex += 1;
      }
    },
    
    setCurrentAgentIndex: (state, action) => {
      state.currentAgentIndex = action.payload;
    },
    
    addWorkflowError: (state, action) => {
      state.executionContext.errors.push({
        timestamp: new Date().toISOString(),
        ...action.payload
      });
    },
    
    clearWorkflowErrors: (state) => {
      state.executionContext.errors = [];
    },
    
    // Active Workflows Management
    addActiveWorkflow: (state, action) => {
      const workflowId = action.payload;
      if (!state.activeWorkflows.includes(workflowId)) {
        state.activeWorkflows.push(workflowId);
      }
    },
    
    removeActiveWorkflow: (state, action) => {
      const workflowId = action.payload;
      state.activeWorkflows = state.activeWorkflows.filter(id => id !== workflowId);
    },
    
    clearActiveWorkflows: (state) => {
      state.activeWorkflows = [];
    },
    
    // Real-time Status
    setRealTimeStatus: (state, action) => {
      state.realTimeStatus = { ...state.realTimeStatus, ...action.payload };
    },
    
    addLiveWorkflow: (state, action) => {
      const workflowId = action.payload;
      if (!state.realTimeStatus.liveWorkflows.includes(workflowId)) {
        state.realTimeStatus.liveWorkflows.push(workflowId);
      }
    },
    
    removeLiveWorkflow: (state, action) => {
      const workflowId = action.payload;
      state.realTimeStatus.liveWorkflows = state.realTimeStatus.liveWorkflows.filter(
        id => id !== workflowId
      );
    },
    
    // Bookmarks & Notes
    toggleBookmark: (state, action) => {
      const workflowId = action.payload;
      if (state.bookmarkedWorkflows.includes(workflowId)) {
        state.bookmarkedWorkflows = state.bookmarkedWorkflows.filter(id => id !== workflowId);
      } else {
        state.bookmarkedWorkflows.push(workflowId);
      }
    },
    
    setWorkflowNotes: (state, action) => {
      const { workflowId, notes } = action.payload;
      state.workflowNotes[workflowId] = notes;
    },
    
    // Statistics
    updateWorkflowStats: (state, action) => {
      state.workflowStats = { ...state.workflowStats, ...action.payload };
    },
    
    // Collaboration
    setCollaborators: (state, action) => {
      state.collaborators = action.payload;
    },
    
    addCollaborator: (state, action) => {
      const collaborator = action.payload;
      if (!state.collaborators.find(c => c.id === collaborator.id)) {
        state.collaborators.push(collaborator);
      }
    },
    
    removeCollaborator: (state, action) => {
      const collaboratorId = action.payload;
      state.collaborators = state.collaborators.filter(c => c.id !== collaboratorId);
    },
    
    // Reset & Cleanup
    resetWorkflowState: (state) => {
      state.selectedWorkflowId = null;
      state.executionContext = initialState.executionContext;
      state.agentSequence = [];
      state.currentAgentIndex = 0;
      state.completedAgents = [];
    },
    
    resetAllWorkflowData: (state) => {
      Object.assign(state, initialState);
    }
  }
});

export const {
  // Selection
  selectWorkflow,
  clearSelection,
  
  // Creation
  startWorkflowCreation,
  setCreationStep,
  setWorkflowTemplate,
  cancelWorkflowCreation,
  completeWorkflowCreation,
  
  // View & Filters
  setViewMode,
  setSorting,
  updateFilters,
  clearFilters,
  setSearchQuery,
  addFilterTag,
  removeFilterTag,
  
  // Execution
  setExecutionContext,
  updateCurrentStep,
  setAgentSequence,
  advanceToNextAgent,
  setCurrentAgentIndex,
  addWorkflowError,
  clearWorkflowErrors,
  
  // Active Workflows
  addActiveWorkflow,
  removeActiveWorkflow,
  clearActiveWorkflows,
  
  // Real-time
  setRealTimeStatus,
  addLiveWorkflow,
  removeLiveWorkflow,
  
  // Bookmarks & Notes
  toggleBookmark,
  setWorkflowNotes,
  
  // Statistics
  updateWorkflowStats,
  
  // Collaboration
  setCollaborators,
  addCollaborator,
  removeCollaborator,
  
  // Reset
  resetWorkflowState,
  resetAllWorkflowData
} = workflowSlice.actions;

// Selectors
export const selectSelectedWorkflow = (state) => state.workflow.selectedWorkflowId;
export const selectWorkflowCreation = (state) => ({
  active: state.workflow.creationMode,
  template: state.workflow.workflowTemplate,
  step: state.workflow.creationStep
});
export const selectViewSettings = (state) => ({
  viewMode: state.workflow.viewMode,
  sortBy: state.workflow.sortBy,
  sortOrder: state.workflow.sortOrder
});
export const selectFilters = (state) => state.workflow.filters;
export const selectExecutionContext = (state) => state.workflow.executionContext;
export const selectAgentSequence = (state) => ({
  sequence: state.workflow.agentSequence,
  currentIndex: state.workflow.currentAgentIndex,
  completed: state.workflow.completedAgents,
  currentAgent: state.workflow.agentSequence[state.workflow.currentAgentIndex]
});
export const selectActiveWorkflows = (state) => state.workflow.activeWorkflows;
export const selectRealTimeStatus = (state) => state.workflow.realTimeStatus;
export const selectBookmarkedWorkflows = (state) => state.workflow.bookmarkedWorkflows;
export const selectWorkflowNotes = (workflowId) => (state) => 
  state.workflow.workflowNotes[workflowId] || '';
export const selectCollaborators = (state) => state.workflow.collaborators;
export const selectWorkflowStats = (state) => state.workflow.workflowStats;

export default workflowSlice;