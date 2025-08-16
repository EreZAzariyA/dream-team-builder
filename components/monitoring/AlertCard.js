'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const AlertCard = ({ alert, isResolving, onResolve }) => {
  const getAlertIcon = () => {
    if (alert.isResolved) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    switch (alert.type) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCardColor = () => {
    if (alert.isResolved) {
      return 'border-green-500 bg-green-50 dark:bg-green-900/20 opacity-75';
    }
    
    switch (alert.type) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'info':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getBadgeColor = () => {
    if (alert.isResolved) {
      return 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200';
    }
    
    switch (alert.type) {
      case 'critical':
        return 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-l-4 transition-all duration-200 ${getCardColor()} ${
        isResolving ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeColor()}`}>
              {alert.isResolved ? 'RESOLVED' : alert.type.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
              {alert.category}
            </span>
            {getAlertIcon()}
          </div>
          
          <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
            {alert.message}
          </p>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              Created: {new Date(alert.createdAt).toLocaleString()}
            </span>
            {alert.isResolved && alert.resolvedAt && (
              <span className="text-green-600 dark:text-green-400">
                Resolved: {new Date(alert.resolvedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="ml-4 flex items-center">
          {alert.isResolved ? (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Resolved</span>
            </span>
          ) : (
            <button
              onClick={() => onResolve(alert._id)}
              disabled={isResolving}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-1 ${
                isResolving
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 hover:shadow-md'
              }`}
            >
              {isResolving ? (
                <>
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Resolving...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3" />
                  <span>Resolve</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertCard;