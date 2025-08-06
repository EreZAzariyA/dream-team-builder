/**
 * Real-time Features Test Page
 * Demonstrates Epic 7: Real-time Collaboration features
 */

'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

import EnhancedChatWindow from '../../components/chat/EnhancedChatWindow';
import { usePusherSimple } from '../../lib/pusher/SimplePusherClient';

export default function RealtimeTestPage() {
  const { data: session, status } = useSession();
  const [testWorkflowId, setTestWorkflowId] = useState('test-workflow-123');
  const [testResults, setTestResults] = useState([]);

  // Use Pusher instead of WebSocket
  const { connected: pusherConnected, connecting: pusherConnecting } = usePusherSimple();

  // Test Pusher connection
  const testPusherConnection = () => {
    setTestResults(prev => [...prev, {
      id: Date.now(),
      type: pusherConnected ? 'success' : 'error',
      message: pusherConnected ? 'Pusher connected successfully' : 'Pusher not connected',
      timestamp: new Date()
    }]);
  };

  // Start test workflow
  const startTestWorkflow = async () => {
    try {
      const response = await fetch('/api/bmad/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: 'Test real-time workflow for Epic 7 demonstration',
          options: {
            name: 'Epic 7 Real-time Test',
            description: 'Demonstrating WebSocket communication and live visualization'
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.workflowId) {
        setTestWorkflowId(data.workflowId);
        setTestResults(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `Test workflow started: ${data.workflowId}`,
          timestamp: new Date()
        }]);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      setTestResults(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Failed to start test workflow: ${error.message}`,
        timestamp: new Date()
      }]);
    }
  };

  // Test BMAD system
  const testBmadSystem = async () => {
    try {
      const response = await fetch('/api/bmad/test');
      const data = await response.json();
      
      if (data.success) {
        setTestResults(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `BMAD system healthy: ${data.system.agentsLoaded} agents loaded`,
          timestamp: new Date()
        }]);
      } else {
        throw new Error('BMAD system not healthy');
      }
    } catch (error) {
      setTestResults(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `BMAD system test failed: ${error.message}`,
        timestamp: new Date()
      }]);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
          <p className="text-gray-600 mb-6">Please sign in to test real-time features</p>
          <a 
            href="/auth/signin"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                🚀 Epic 7: Real-time Collaboration Test
              </h1>
              <p className="text-gray-600 mt-1">
                Test Pusher real-time communication, live workflow visualization, and agent chat
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm ${
                pusherConnected 
                  ? 'bg-green-100 text-green-700' 
                  : pusherConnecting
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                Pusher: {pusherConnected ? 'Connected' : pusherConnecting ? 'Connecting...' : 'Disconnected'}
              </div>
              
              {testWorkflowId && (
                <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  Workflow: {testWorkflowId}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={testBmadSystem}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              🧪 Test BMAD System
            </button>
            
            <button
              onClick={testPusherConnection}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              🌐 Test Pusher Connection
            </button>
            
            <button
              onClick={startTestWorkflow}
              disabled={!pusherConnected}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🚀 Start Test Workflow
            </button>
            
            <button
              onClick={clearResults}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              🗑️ Clear Results
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
            </div>
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {testResults.map((result) => (
                <div
                  key={result.id}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    result.type === 'success' 
                      ? 'bg-green-50 text-green-800' 
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{result.type === 'success' ? '✅' : '❌'}</span>
                    <span>{result.message}</span>
                  </div>
                  <span className="text-xs opacity-75">
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Chat Window Demo */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">
              Enhanced Chat with Real-time Features
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              Try starting a workflow to see live visualization and agent communication
            </p>
          </div>
          <div style={{ height: '600px' }}>
            <EnhancedChatWindow className="h-full" />
          </div>
        </div>

        {/* Individual Component Tests */}
        {testWorkflowId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Workflow Visualization */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Story 7.2: Live Workflow Visualization
                </h3>
              </div>
              <div style={{ height: '400px' }} className="flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🚧</div>
                  <p>Live Workflow Visualization</p>
                  <p className="text-sm">Component removed during cleanup</p>
                </div>
              </div>
            </div>

            {/* Agent Chat Interface */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Story 7.3: Agent Chat Interface
                </h3>
              </div>
              <div style={{ height: '400px' }} className="flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🚧</div>
                  <p>Agent Chat Interface</p>
                  <p className="text-sm">Component removed during cleanup</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Epic 7 Features Summary */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Epic 7: Real-time Collaboration Features
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">🌐 Story 7.1: Pusher Real-time System</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✅ Real-time client-server communication</li>
                <li>✅ Workflow and agent subscriptions</li>
                <li>✅ Message broadcasting and routing</li>
                <li>✅ Connection management via Pusher</li>
                <li>✅ Event-driven architecture integration</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">📊 Story 7.2: Live Visualization</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✅ Real-time workflow progress display</li>
                <li>✅ Interactive timeline and network views</li>
                <li>✅ Agent status monitoring</li>
                <li>✅ Communication flow visualization</li>
                <li>✅ Auto-scrolling and live updates</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">💬 Story 7.3: Agent Chat</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✅ Real-time agent communication</li>
                <li>✅ Multi-agent chat channels</li>
                <li>✅ Message history and typing indicators</li>
                <li>✅ Agent online/offline status</li>
                <li>✅ Inter-agent message broadcasting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}