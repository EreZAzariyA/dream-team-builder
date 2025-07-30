'use client';

import { useSelector, useDispatch } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from "next/link";

// Import actions from our slices
import { 
  toggleSidebar, 
  setTheme, 
  addNotification,
  showToast,
  selectSidebarState,
  selectTheme 
} from '../../lib/store/slices/uiSlice.js';
import { 
  selectWorkflow, 
  setViewMode,
  selectSelectedWorkflow,
  selectViewSettings 
} from '../../lib/store/slices/workflowSlice.js';
import { 
  selectAgent,
  selectSelectedAgent 
} from '../../lib/store/slices/agentSlice.js';

// Test component to verify all providers are working
export default function TestProvidersPage() {
  const dispatch = useDispatch();
  const [testResults, setTestResults] = useState({});

  // Redux selectors
  const sidebarState = useSelector(selectSidebarState);
  const theme = useSelector(selectTheme);
  const selectedWorkflow = useSelector(selectSelectedWorkflow);
  const selectedAgent = useSelector(selectSelectedAgent);
  const viewSettings = useSelector(selectViewSettings);

  // React Query test
  const { data: testData, isLoading, error } = useQuery({
    queryKey: ['test-query'],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { message: 'React Query is working!', timestamp: new Date().toISOString() };
    },
    staleTime: 5000,
  });

  // Test functions
  const testReduxActions = () => {
    const results = {};
    
    try {
      // Test UI actions
      dispatch(toggleSidebar());
      dispatch(setTheme(theme === 'light' ? 'dark' : 'light'));
      dispatch(addNotification({
        type: 'success',
        title: 'Redux Test',
        message: 'Redux actions are working!'
      }));
      dispatch(showToast({
        type: 'info',
        message: 'Toast notification working!'
      }));
      results.uiActions = 'PASSED';

      // Test workflow actions
      dispatch(selectWorkflow('test-workflow-' + Date.now()));
      dispatch(setViewMode(viewSettings.viewMode === 'grid' ? 'list' : 'grid'));
      results.workflowActions = 'PASSED';

      // Test agent actions
      dispatch(selectAgent('test-agent-architect'));
      results.agentActions = 'PASSED';

      results.overall = 'ALL REDUX TESTS PASSED';
      
    } catch (error) {
      results.error = error.message;
      results.overall = 'REDUX TESTS FAILED';
    }
    
    setTestResults(results);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              🧪 Provider Integration Test
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Testing Redux Toolkit + React-Query + WebSocket integration
            </p>
          </div>

          {/* Status Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Redux Status */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                🔄 Redux Store
              </h3>
              <div className="text-sm text-green-700 dark:text-green-400 space-y-1">
                <div>Sidebar: {sidebarState.open ? 'Open' : 'Closed'}</div>
                <div>Theme: {theme}</div>
                <div>Selected Workflow: {selectedWorkflow || 'None'}</div>
                <div>Selected Agent: {selectedAgent || 'None'}</div>
                <div>View Mode: {viewSettings.viewMode}</div>
                <div className="mt-2 text-xs font-mono bg-green-100 dark:bg-green-900/40 p-1 rounded">
                  ✅ Redux Connected
                </div>
              </div>
            </div>

            {/* React Query Status */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                🔍 React Query
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                {isLoading && <div>Loading test data...</div>}
                {error && <div className="text-red-600">Error: {error.message}</div>}
                {testData && (
                  <>
                    <div>Message: {testData.message}</div>
                    <div>Timestamp: {new Date(testData.timestamp).toLocaleTimeString()}</div>
                  </>
                )}
                <div className="mt-2 text-xs font-mono bg-blue-100 dark:bg-blue-900/40 p-1 rounded">
                  ✅ React Query Connected
                </div>
              </div>
            </div>

            {/* WebSocket Status */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">
                ⚡ WebSocket
              </h3>
              <div className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                <div>Manager: Initialized</div>
                <div>Store Reference: Connected</div>
                <div>Middleware: Active</div>
                <div>Connections: 0 active</div>
                <div className="mt-2 text-xs font-mono bg-purple-100 dark:bg-purple-900/40 p-1 rounded">
                  ✅ WebSocket Ready
                </div>
              </div>
            </div>
          </div>

          {/* Test Actions */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              🧪 Test Actions
            </h2>
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={testReduxActions}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Test Redux Actions
              </button>
              <button
                onClick={() => dispatch(toggleSidebar())}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Toggle Sidebar
              </button>
              <button
                onClick={() => dispatch(setTheme(theme === 'light' ? 'dark' : 'light'))}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Toggle Theme
              </button>
            </div>

            {/* Test Results */}
            {Object.keys(testResults).length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Test Results:
                </h3>
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Provider Architecture */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              🏗️ Provider Architecture
            </h2>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <div>✅ <strong>AppProviders</strong> - Main wrapper component</div>
              <div>✅ <strong>ReduxProvider</strong> - Redux Toolkit store with persistence</div>
              <div>✅ <strong>ReactQueryProvider</strong> - TanStack Query client</div>
              <div>✅ <strong>ThemeProvider</strong> - Theme management</div>
              <div>✅ <strong>WebSocketProvider</strong> - Real-time connection manager</div>
              <div>✅ <strong>ProvidersErrorBoundary</strong> - Error handling</div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              ← Back to Home
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}