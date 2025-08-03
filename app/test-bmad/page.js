/**
 * BMAD Integration Test Page
 * Comprehensive testing interface for BMAD chat integration
 */

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ChatWindow from '../../components/chat/ChatWindow';

const TestBmadPage = () => {
  const [testMode, setTestMode] = useState('basic');
  const [testResults, setTestResults] = useState([]);

  // Test BMAD system availability
  const { data: systemHealth, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['bmad-system-health'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/bmad/agents');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    retry: 1
  });

  const addTestResult = (test, result, details = '') => {
    setTestResults(prev => [...prev, {
      test,
      result,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const runAutomatedTests = async () => {
    setTestResults([]);
    
    // Test 1: System Health
    addTestResult('System Health Check', systemHealth?.success ? 'PASS' : 'FAIL', 
      systemHealth?.success ? `${systemHealth.data?.agents?.length || 0} agents loaded` : systemHealth?.error);

    // Test 2: API Endpoints
    try {
      const agentsResponse = await fetch('/api/bmad/agents');
      addTestResult('API Agents Endpoint', agentsResponse.ok ? 'PASS' : 'FAIL', 
        `Status: ${agentsResponse.status}`);
    } catch (error) {
      addTestResult('API Agents Endpoint', 'FAIL', error.message);
    }

    // Test 3: Workflow Creation (Mock)
    try {
      const workflowResponse = await fetch('/api/bmad/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: 'Test workflow creation for BMAD system validation',
          name: 'Test Workflow',
          sequence: 'FULL_STACK'
        })
      });
      addTestResult('Workflow Creation', workflowResponse.ok ? 'PASS' : 'FAIL', 
        `Status: ${workflowResponse.status}`);
    } catch (error) {
      addTestResult('Workflow Creation', 'FAIL', error.message);
    }
  };

  const testScenarios = [
    {
      id: 'trigger1',
      message: 'I want to build a todo application',
      expected: 'Should trigger workflow suggestion'
    },
    {
      id: 'trigger2', 
      message: 'Help me create a dashboard',
      expected: 'Should trigger workflow suggestion'
    },
    {
      id: 'trigger3',
      message: 'Start new project',
      expected: 'Should trigger workflow suggestion'  
    },
    {
      id: 'normal',
      message: 'Hello, how are you?',
      expected: 'Should NOT trigger workflow suggestion'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🧪 BMAD Integration Test Suite
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive testing interface for BMAD chat system integration
          </p>
        </div>

        {/* Test Mode Selector */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'basic', label: '🎯 Basic Test', desc: 'Simple chat with BMAD features' },
              { id: 'demo', label: '🎮 Interactive Demo', desc: 'Full demo experience' },
              { id: 'automated', label: '🤖 Automated Tests', desc: 'Run system validation tests' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setTestMode(mode.id)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  testMode === mode.id
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="text-sm font-medium">{mode.label}</div>
                <div className="text-xs opacity-75">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            📊 System Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                healthLoading ? 'bg-yellow-500 animate-pulse' : 
                systemHealth?.success ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                BMAD System: {healthLoading ? 'Checking...' : systemHealth?.success ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Agents: {systemHealth?.data?.agents?.length || 0} loaded
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Sequences: {systemHealth?.data?.sequences?.length || 0} available
            </div>
          </div>
          {healthError && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              Error: {healthError.message}
            </div>
          )}
        </div>

        {/* Test Content */}
        {testMode === 'basic' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Chat Interface */}
            <div className="lg:col-span-3">
              <div className="h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <ChatWindow 
                  workflowId="test-workflow"
                  agentId="test-agent"
                />
              </div>
            </div>

            {/* Test Instructions */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  🎯 Test Steps
                </h3>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start space-x-2">
                    <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-0.5">1</span>
                    <span>Click the 🚀 Start BMAD button</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-0.5">2</span>
                    <span>Try the workflow initiator form</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-0.5">3</span>
                    <span>Type trigger messages below</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-0.5">4</span>
                    <span>Watch for system suggestions</span>
                  </li>
                </ol>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  💬 Test Messages
                </h3>
                <div className="space-y-2">
                  {testScenarios.map(scenario => (
                    <div key={scenario.id} className="border border-gray-200 dark:border-gray-600 rounded p-2">
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        &quot;{scenario.message}&quot;
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {scenario.expected}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {testMode === 'demo' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Demo Component Removed</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                The BmadChatDemo component has been removed as part of cleanup. Use the basic test mode instead.
              </p>
              <button
                onClick={() => setTestMode('basic')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Switch to Basic Test
              </button>
            </div>
          </div>
        )}

        {testMode === 'automated' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  🤖 Automated Test Results
                </h3>
                <button
                  onClick={runAutomatedTests}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Run Tests
                </button>
              </div>

              {testResults.length > 0 && (
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {result.test}
                        </div>
                        {result.details && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {result.details}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {result.timestamp}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          result.result === 'PASS' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {result.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <h4 className="text-blue-900 dark:text-blue-300 font-medium mb-2">
            🔍 What to Look For
          </h4>
          <ul className="text-blue-800 dark:text-blue-300 text-sm space-y-1">
            <li>• Automatic workflow suggestions when typing project-related messages</li>
            <li>• 🚀 Start BMAD button in chat header</li>
            <li>• Workflow initiator panel when button is clicked</li>
            <li>• Real-time status panel when workflows are started</li>
            <li>• System messages with action buttons</li>
            <li>• BMAD mode styling changes (blue gradient buttons, indicators)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestBmadPage;