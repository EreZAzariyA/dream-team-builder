/**
 * BMAD Chat Integration Demo
 * Shows how to use the enhanced ChatWindow with BMAD orchestrator
 */

'use client';

import React from 'react';
import ChatWindow from '../chat/ChatWindow';

const BmadChatDemo = () => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🤖 BMAD-Enhanced Chat System
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your chat system now includes BMAD (Business Methodology for Autonomous Development) workflow orchestration.
          Try typing messages like &quot;build a todo app&quot; or click the &quot;Start BMAD&quot; button to initiate AI agent workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Window */}
        <div className="lg:col-span-2">
          <div className="h-[600px]">
            <ChatWindow 
              workflowId="demo-workflow"
              agentId="demo-agent"
            />
          </div>
        </div>

        {/* Information Panel */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              🚀 BMAD Features
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Smart workflow detection from natural language</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Real-time workflow progress tracking</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>10 specialized AI agents coordination</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Interactive workflow suggestions</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Agent communication visualization</span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              🤖 Available Agents
            </h3>
            <div className="space-y-2">
              {[
                { id: 'pm', name: 'Product Manager', icon: '📋', role: 'Requirements & Planning' },
                { id: 'architect', name: 'System Architect', icon: '🏗️', role: 'Technical Design' },
                { id: 'dev', name: 'Developer', icon: '💻', role: 'Implementation' },
                { id: 'qa', name: 'Quality Assurance', icon: '🧪', role: 'Testing & Validation' },
                { id: 'ux-expert', name: 'UX Expert', icon: '🎨', role: 'User Experience' }
              ].map(agent => (
                <div key={agent.id} className="flex items-center space-x-2 text-sm">
                  <span className="text-lg">{agent.icon}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{agent.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{agent.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              💡 Try These Prompts
            </h3>
            <div className="space-y-2">
              {[
                "Build a todo application",
                "Create a dashboard with charts",
                "Design a landing page",
                "Develop a REST API",
                "Start a new project"
              ].map((prompt, index) => (
                <div key={index} className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                  &quot;{prompt}&quot;
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
        <div className="flex items-start space-x-2">
          <span className="text-blue-500 text-lg">ℹ️</span>
          <div>
            <h4 className="text-blue-900 dark:text-blue-300 font-medium mb-1">
              How BMAD Integration Works
            </h4>
            <p className="text-blue-800 dark:text-blue-300 text-sm">
              When you type messages that suggest starting a project or building something, the system will automatically 
              detect this and offer to start a BMAD workflow. You can also manually click the &quot;Start BMAD&quot; button to 
              initiate workflows at any time. Once started, you&apos;ll see real-time progress as AI agents coordinate to 
              help you build your project step by step.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BmadChatDemo;