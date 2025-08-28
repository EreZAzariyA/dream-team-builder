'use client';

import { useState } from 'react';
import HeroSection from '../../../components/dashboard/HeroSection';
import ActiveProjectsEnhanced from '../../../components/dashboard/ActiveProjectsEnhanced';
import SystemMetrics from '../../../components/dashboard/SystemMetrics';
import AgentStatusGrid from '../../../components/dashboard/AgentStatusGrid';
import RealTimeActivityFeed from '../../../components/dashboard/RealTimeActivityFeed';
import SmartInsights from '../../../components/dashboard/SmartInsights';
import GitHubWorkflowLauncher from '../../../components/workflows/GitHubWorkflowLauncher';

const DashboardPage = () => {
  const [showGitHubLauncher, setShowGitHubLauncher] = useState(false);
  
  const handleStartNewProject = () => {
    setShowGitHubLauncher(true);
  };

  const handleWorkflowStarted = (result) => {
    setShowGitHubLauncher(false);
    // Workflow started successfully, GitHubWorkflowLauncher will navigate automatically
  };

  if (showGitHubLauncher) {
    return (
      <div className="space-y-6">
        {/* GitHub Workflow Launcher */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">GitHub-Integrated Workflow</h2>
            <button
              onClick={() => setShowGitHubLauncher(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Back to Dashboard
            </button>
          </div>
          <GitHubWorkflowLauncher 
            onWorkflowStarted={handleWorkflowStarted}
            className="p-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BMAD Command Center Hero */}
      <HeroSection onStartNewProject={handleStartNewProject} />

      {/* GitHub Integration Quick Start */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-lg">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold">GitHub-Integrated Workflows</h3>
              <p className="text-blue-100">Connect your repositories and let AI agents enhance your codebase</p>
            </div>
          </div>
          <button
            onClick={handleStartNewProject}
            className="px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Launch Workflow
          </button>
        </div>
      </div>

      {/* Active Projects Enhanced */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Projects</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Real-time monitoring</span>
        </div>
        <ActiveProjectsEnhanced />
      </div>

      {/* Agent Teams Collaboration */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agent Teams</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">AI coordination</span>
        </div>
        <AgentStatusGrid />
      </div>

      {/* System Overview & Smart Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Performance</h3>
          </div>
          <SystemMetrics />
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Activity</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <RealTimeActivityFeed />
          </div>
        </div>
      </div>

      {/* Smart Insights */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Smart Insights</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">AI recommendations</span>
        </div>
        <SmartInsights />
      </div>
    </div>
  );
};

export default DashboardPage;
