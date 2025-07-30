
'use client';

import React from 'react';

const ChatMessage = ({ message, onAction }) => {
  const isUser = message.sender === 'User';
  const isSystem = message.sender === 'System' || message.sender === 'BMAD System';
  
  const getMessageStyle = () => {
    if (isUser) {
      return 'bg-blue-500 text-white self-end rounded-br-none';
    } else if (isSystem) {
      switch (message.type) {
        case 'workflow-suggestion':
          return 'bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-gray-800 dark:text-gray-200 self-start rounded-bl-none border border-blue-200 dark:border-blue-700';
        case 'workflow-started':
          return 'bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 text-gray-800 dark:text-gray-200 self-start rounded-bl-none border border-green-200 dark:border-green-700';
        default:
          return 'bg-yellow-100 dark:bg-yellow-900/30 text-gray-800 dark:text-gray-200 self-start rounded-bl-none border border-yellow-200 dark:border-yellow-700';
      }
    } else {
      return 'bg-gray-200 text-gray-800 self-start rounded-bl-none dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const handleActionClick = (action) => {
    if (onAction) {
      onAction(action, message);
    }
  };

  return (
    <div className={`flex flex-col max-w-xs sm:max-w-md lg:max-w-lg p-3 rounded-lg shadow-md ${getMessageStyle()}`}>
      <div className="text-sm font-semibold mb-1 flex items-center space-x-1">
        <span>{message.sender}</span>
        {message.type === 'workflow-started' && (
          <span className="text-xs bg-green-500 text-white px-1 rounded">Workflow</span>
        )}
        {message.type === 'workflow-suggestion' && (
          <span className="text-xs bg-blue-500 text-white px-1 rounded">Suggestion</span>
        )}
      </div>
      
      <div className="text-base mb-2">
        {message.content}
      </div>

      {/* Action Buttons for System Messages */}
      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {message.actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action.action)}
              className="px-3 py-1 text-xs rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Workflow ID Badge */}
      {message.workflowId && (
        <div className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded mb-2 font-mono">
          ID: {message.workflowId.split('_')[1] || message.workflowId.substring(0, 8)}
        </div>
      )}

      <div className="text-xs opacity-75 self-end">
        {message.timestamp}
      </div>
    </div>
  );
};

export default ChatMessage;
