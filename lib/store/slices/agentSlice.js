import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Agent Definitions (loaded from .bmad-core/)
  availableAgents: {
    // Will be populated with agent definitions
    // agentId: { name, title, icon, capabilities, etc. }
  },
  
  // Agent Execution States
  agentExecutions: {}, // workflowId -> { agentId -> executionState }
  
  // Current Active Agents
  activeAgents: [], // Array of { workflowId, agentId, status }
  
  // Agent Selection & Focus
  selectedAgentId: null,
  focusedWorkflowAgent: null, // { workflowId, agentId }
  
  // Agent UI States
  agentViewExpanded: {},  // agentId -> boolean
  agentPanelSizes: {},    // agentId -> size in pixels
  
  // Agent Communication
  interAgentMessages: {}, // workflowId -> array of messages
  agentChatHistory: {},   // agentId -> chat history
  
  // Agent Outputs & Artifacts
  agentOutputs: {},       // { workflowId, agentId } -> outputs
  generatedArtifacts: {}, // { workflowId, agentId } -> artifacts
  
  // Agent Performance & Analytics
  agentMetrics: {}, // agentId -> performance metrics
  executionHistory: [], // Historical agent executions
  
  // Agent Customization
  agentPreferences: {}, // agentId -> user preferences
  customAgentConfigs: {}, // User-defined agent modifications
  
  // Agent Dependencies & Resources
  loadedResources: {}, // agentId -> loaded resources (tasks, templates, etc.)
  resourceCache: {},   // Cache for frequently used resources
  
  // Agent Error States
  agentErrors: {},     // agentId -> error information
  failedExecutions: [], // Array of failed execution details
  
  // Real-time Agent Status
  agentHeartbeats: {}, // agentId -> last heartbeat timestamp
  connectionStates: {}, // agentId -> connection status
  
  // Agent Collaboration
  agentHandoffs: {},   // Track agent-to-agent handoffs
  pendingHandoffs: [], // Handoffs waiting for acceptance
  
  // Advanced Features
  agentBookmarks: [],  // Bookmarked agent configurations
  agentTemplates: [],  // Saved agent template configurations
  debugMode: false,    // Enhanced debugging for agent execution
};

const agentSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    // Agent Definitions Management
    setAvailableAgents: (state, action) => {
      state.availableAgents = action.payload;
    },
    
    addAgentDefinition: (state, action) => {
      const { agentId, definition } = action.payload;
      state.availableAgents[agentId] = definition;
    },
    
    updateAgentDefinition: (state, action) => {
      const { agentId, updates } = action.payload;
      if (state.availableAgents[agentId]) {
        state.availableAgents[agentId] = {
          ...state.availableAgents[agentId],
          ...updates
        };
      }
    },
    
    // Agent Selection
    selectAgent: (state, action) => {
      state.selectedAgentId = action.payload;
    },
    
    clearAgentSelection: (state) => {
      state.selectedAgentId = null;
    },
    
    setFocusedWorkflowAgent: (state, action) => {
      state.focusedWorkflowAgent = action.payload; // { workflowId, agentId }
    },
    
    // Agent Execution Management
    setAgentExecution: (state, action) => {
      const { workflowId, agentId, executionState } = action.payload;
      
      if (!state.agentExecutions[workflowId]) {
        state.agentExecutions[workflowId] = {};
      }
      
      state.agentExecutions[workflowId][agentId] = {
        ...state.agentExecutions[workflowId][agentId],
        ...executionState,
        lastUpdated: new Date().toISOString()
      };
    },
    
    updateAgentStatus: (state, action) => {
      const { workflowId, agentId, status } = action.payload;
      
      if (state.agentExecutions[workflowId]?.[agentId]) {
        state.agentExecutions[workflowId][agentId].status = status;
        state.agentExecutions[workflowId][agentId].lastUpdated = new Date().toISOString();
      }
      
      // Update active agents list
      const activeAgentIndex = state.activeAgents.findIndex(
        agent => agent.workflowId === workflowId && agent.agentId === agentId
      );
      
      if (status === 'active') {
        if (activeAgentIndex === -1) {
          state.activeAgents.push({ workflowId, agentId, status });
        } else {
          state.activeAgents[activeAgentIndex].status = status;
        }
      } else if (activeAgentIndex !== -1) {
        state.activeAgents.splice(activeAgentIndex, 1);
      }
    },
    
    clearAgentExecution: (state, action) => {
      const { workflowId, agentId } = action.payload;
      if (state.agentExecutions[workflowId]) {
        delete state.agentExecutions[workflowId][agentId];
      }
      
      // Remove from active agents
      state.activeAgents = state.activeAgents.filter(
        agent => !(agent.workflowId === workflowId && agent.agentId === agentId)
      );
    },
    
    // Agent UI State
    toggleAgentViewExpanded: (state, action) => {
      const agentId = action.payload;
      state.agentViewExpanded[agentId] = !state.agentViewExpanded[agentId];
    },
    
    setAgentViewExpanded: (state, action) => {
      const { agentId, expanded } = action.payload;
      state.agentViewExpanded[agentId] = expanded;
    },
    
    setAgentPanelSize: (state, action) => {
      const { agentId, size } = action.payload;
      state.agentPanelSizes[agentId] = Math.max(200, Math.min(800, size));
    },
    
    // Agent Communication
    addInterAgentMessage: (state, action) => {
      const { workflowId, message } = action.payload;
      
      if (!state.interAgentMessages[workflowId]) {
        state.interAgentMessages[workflowId] = [];
      }
      
      state.interAgentMessages[workflowId].push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...message
      });
      
      // Keep only last 100 messages per workflow
      if (state.interAgentMessages[workflowId].length > 100) {
        state.interAgentMessages[workflowId] = state.interAgentMessages[workflowId].slice(-100);
      }
    },
    
    clearInterAgentMessages: (state, action) => {
      const workflowId = action.payload;
      if (workflowId) {
        delete state.interAgentMessages[workflowId];
      } else {
        state.interAgentMessages = {};
      }
    },
    
    addAgentChatMessage: (state, action) => {
      const { agentId, message } = action.payload;
      
      if (!state.agentChatHistory[agentId]) {
        state.agentChatHistory[agentId] = [];
      }
      
      state.agentChatHistory[agentId].push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...message
      });
    },
    
    clearAgentChatHistory: (state, action) => {
      const agentId = action.payload;
      if (agentId) {
        delete state.agentChatHistory[agentId];
      } else {
        state.agentChatHistory = {};
      }
    },
    
    // Agent Outputs & Artifacts
    setAgentOutput: (state, action) => {
      const { workflowId, agentId, output } = action.payload;
      const key = `${workflowId}_${agentId}`;
      
      state.agentOutputs[key] = {
        workflowId,
        agentId,
        output,
        timestamp: new Date().toISOString()
      };
    },
    
    addGeneratedArtifact: (state, action) => {
      const { workflowId, agentId, artifact } = action.payload;
      const key = `${workflowId}_${agentId}`;
      
      if (!state.generatedArtifacts[key]) {
        state.generatedArtifacts[key] = [];
      }
      
      state.generatedArtifacts[key].push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...artifact
      });
    },
    
    clearAgentArtifacts: (state, action) => {
      const { workflowId, agentId } = action.payload;
      const key = `${workflowId}_${agentId}`;
      delete state.generatedArtifacts[key];
    },
    
    // Agent Resources
    setLoadedResources: (state, action) => {
      const { agentId, resources } = action.payload;
      state.loadedResources[agentId] = resources;
    },
    
    cacheResource: (state, action) => {
      const { resourceKey, resourceData } = action.payload;
      state.resourceCache[resourceKey] = {
        data: resourceData,
        cachedAt: new Date().toISOString()
      };
    },
    
    clearResourceCache: (state) => {
      state.resourceCache = {};
    },
    
    // Agent Errors
    setAgentError: (state, action) => {
      const { agentId, error } = action.payload;
      state.agentErrors[agentId] = {
        error,
        timestamp: new Date().toISOString()
      };
    },
    
    clearAgentError: (state, action) => {
      const agentId = action.payload;
      delete state.agentErrors[agentId];
    },
    
    addFailedExecution: (state, action) => {
      state.failedExecutions.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...action.payload
      });
      
      // Keep only last 50 failed executions
      if (state.failedExecutions.length > 50) {
        state.failedExecutions = state.failedExecutions.slice(-50);
      }
    },
    
    // Agent Handoffs
    initiateAgentHandoff: (state, action) => {
      const { fromAgent, toAgent, workflowId, data } = action.payload;
      const handoffId = `${workflowId}_${fromAgent}_${toAgent}_${Date.now()}`;
      
      state.pendingHandoffs.push({
        id: handoffId,
        fromAgent,
        toAgent,
        workflowId,
        data,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    },
    
    completeAgentHandoff: (state, action) => {
      const { handoffId } = action.payload;
      const handoffIndex = state.pendingHandoffs.findIndex(h => h.id === handoffId);
      
      if (handoffIndex !== -1) {
        const handoff = state.pendingHandoffs[handoffIndex];
        
        // Move to completed handoffs
        if (!state.agentHandoffs[handoff.workflowId]) {
          state.agentHandoffs[handoff.workflowId] = [];
        }
        
        state.agentHandoffs[handoff.workflowId].push({
          ...handoff,
          status: 'completed',
          completedAt: new Date().toISOString()
        });
        
        // Remove from pending
        state.pendingHandoffs.splice(handoffIndex, 1);
      }
    },
    
    // Agent Preferences
    setAgentPreference: (state, action) => {
      const { agentId, preference, value } = action.payload;
      if (!state.agentPreferences[agentId]) {
        state.agentPreferences[agentId] = {};
      }
      state.agentPreferences[agentId][preference] = value;
    },
    
    // Debug Mode
    toggleDebugMode: (state) => {
      state.debugMode = !state.debugMode;
    },
    
    setDebugMode: (state, action) => {
      state.debugMode = action.payload;
    },
    
    // Heartbeats & Connection
    updateAgentHeartbeat: (state, action) => {
      const { agentId } = action.payload;
      state.agentHeartbeats[agentId] = new Date().toISOString();
    },
    
    setAgentConnectionState: (state, action) => {
      const { agentId, connectionState } = action.payload;
      state.connectionStates[agentId] = connectionState;
    },
    
    // Reset & Cleanup
    resetAgentState: (state, action) => {
      const workflowId = action.payload;
      if (workflowId) {
        // Clear workflow-specific data
        delete state.agentExecutions[workflowId];
        delete state.interAgentMessages[workflowId];
        delete state.agentHandoffs[workflowId];
        
        // Remove from active agents
        state.activeAgents = state.activeAgents.filter(
          agent => agent.workflowId !== workflowId
        );
        
        // Clear focused agent if it's from this workflow
        if (state.focusedWorkflowAgent?.workflowId === workflowId) {
          state.focusedWorkflowAgent = null;
        }
        
        // Clear outputs and artifacts for this workflow
        Object.keys(state.agentOutputs).forEach(key => {
          if (key.startsWith(`${workflowId}_`)) {
            delete state.agentOutputs[key];
          }
        });
        
        Object.keys(state.generatedArtifacts).forEach(key => {
          if (key.startsWith(`${workflowId}_`)) {
            delete state.generatedArtifacts[key];
          }
        });
      }
    },
    
    resetAllAgentData: (state) => {
      Object.assign(state, initialState);
    }
  }
});

export const {
  // Agent Definitions
  setAvailableAgents,
  addAgentDefinition,
  updateAgentDefinition,
  
  // Selection
  selectAgent,
  clearAgentSelection,
  setFocusedWorkflowAgent,
  
  // Execution
  setAgentExecution,
  updateAgentStatus,
  clearAgentExecution,
  
  // UI State
  toggleAgentViewExpanded,
  setAgentViewExpanded,
  setAgentPanelSize,
  
  // Communication
  addInterAgentMessage,
  clearInterAgentMessages,
  addAgentChatMessage,
  clearAgentChatHistory,
  
  // Outputs & Artifacts
  setAgentOutput,
  addGeneratedArtifact,
  clearAgentArtifacts,
  
  // Resources
  setLoadedResources,
  cacheResource,
  clearResourceCache,
  
  // Errors
  setAgentError,
  clearAgentError,
  addFailedExecution,
  
  // Handoffs
  initiateAgentHandoff,
  completeAgentHandoff,
  
  // Preferences
  setAgentPreference,
  
  // Debug
  toggleDebugMode,
  setDebugMode,
  
  // Heartbeats
  updateAgentHeartbeat,
  setAgentConnectionState,
  
  // Reset
  resetAgentState,
  resetAllAgentData
} = agentSlice.actions;

// Selectors
export const selectAvailableAgents = (state) => state.agents.availableAgents;
export const selectSelectedAgent = (state) => state.agents.selectedAgentId;
export const selectActiveAgents = (state) => state.agents.activeAgents;
export const selectAgentExecution = (workflowId, agentId) => (state) =>
  state.agents.agentExecutions[workflowId]?.[agentId];
export const selectInterAgentMessages = (workflowId) => (state) =>
  state.agents.interAgentMessages[workflowId] || [];
export const selectAgentChatHistory = (agentId) => (state) =>
  state.agents.agentChatHistory[agentId] || [];
export const selectAgentOutputs = (workflowId, agentId) => (state) =>
  state.agents.agentOutputs[`${workflowId}_${agentId}`];
export const selectGeneratedArtifacts = (workflowId, agentId) => (state) =>
  state.agents.generatedArtifacts[`${workflowId}_${agentId}`] || [];
export const selectAgentErrors = (state) => state.agents.agentErrors;
export const selectPendingHandoffs = (state) => state.agents.pendingHandoffs;
export const selectAgentPreferences = (agentId) => (state) =>
  state.agents.agentPreferences[agentId] || {};
export const selectDebugMode = (state) => state.agents.debugMode;
export const selectFocusedWorkflowAgent = (state) => state.agents.focusedWorkflowAgent;

export default agentSlice;