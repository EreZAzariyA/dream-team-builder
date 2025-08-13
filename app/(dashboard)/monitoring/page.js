'use client';

import React from 'react';
import SystemHealthDashboard from '../../../components/monitoring/SystemHealthDashboard.js';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h1 className="text-h1 mb-4">System Monitoring</h1>
          <p className="text-body text-gray-600 dark:text-gray-400 mb-6">
            Monitor system health, performance metrics, API response times, and alerts in real-time.
          </p>
            
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">🏥</span>
                <h3 className="text-h4 text-green-900 dark:text-green-100">Health Monitoring</h3>
              </div>
              <p className="text-body-small text-green-800 dark:text-green-200">
                Real-time system health tracking with automatic alerts and status indicators.
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">📊</span>
                <h3 className="text-h4 text-blue-900 dark:text-blue-100">Performance Metrics</h3>
              </div>
              <p className="text-body-small text-blue-800 dark:text-blue-200">
                API response times, database performance, and system resource usage tracking.
              </p>
            </div>
            
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">🚨</span>
                <h3 className="text-h4 text-red-900 dark:text-red-100">Alert Management</h3>
              </div>
              <p className="text-body-small text-red-800 dark:text-red-200">
                Automated alerting for critical issues with escalation and notification systems.
              </p>
            </div>
          </div>
        </div>

        <SystemHealthDashboard />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-h3 text-gray-900 dark:text-white mb-4">
            📈 Monitoring Features
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-h4 text-gray-900 dark:text-white mb-2">Automated Monitoring</h4>
              <ul className="text-body-small text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Real-time system health checks</li>
                <li>• Database connection monitoring</li>
                <li>• API response time tracking</li>
                <li>• Memory and CPU usage monitoring</li>
                <li>• Error rate detection and alerts</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-h4 text-gray-900 dark:text-white mb-2">Alert Management</h4>
              <ul className="text-body-small text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Configurable alert thresholds</li>
                <li>• Multi-level severity (info, warning, critical)</li>
                <li>• Alert categorization and filtering</li>
                <li>• Resolution tracking and acknowledgment</li>
                <li>• Historical alert analysis</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="text-h4 text-yellow-900 dark:text-yellow-100 mb-2">
              ⚡ Performance Optimization
            </h4>
            <p className="text-body-small text-yellow-800 dark:text-yellow-200">
              The monitoring system automatically tracks performance metrics and can trigger optimizations 
              like garbage collection for memory management. All monitoring data is retained for 24 hours 
              and cleaned up automatically to maintain optimal performance.
            </p>
          </div>
        </div>
    </div>
  );
}