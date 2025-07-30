
'use client';

import React, { useState } from 'react';

const MessageInput = ({ onSendMessage, placeholder = "Type your message...", bmadMode = false }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  // Suggest BMAD workflow triggers
  const workflowSuggestions = [
    "Build a todo app",
    "Create a dashboard",
    "Design a landing page",
    "Develop an API",
    "Start new project"
  ];

  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSuggestionClick = (suggestion) => {
    setMessage(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      {/* Workflow Suggestions */}
      {showSuggestions && !bmadMode && (
        <div className="absolute bottom-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-lg shadow-lg p-2 space-y-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center space-x-1">
            <span>🤖</span>
            <span>Workflow Suggestions:</span>
          </div>
          {workflowSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-2">
        {/* BMAD Mode Indicator */}
        {bmadMode && (
          <div className="flex items-center space-x-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
            <span>🤖</span>
            <span>BMAD</span>
          </div>
        )}

        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            className={`w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white ${
              bmadMode ? 'border-blue-300 dark:border-blue-600' : ''
            }`}
          />
          
          {/* Suggestion Button */}
          {!bmadMode && (
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              💡
            </button>
          )}
        </div>

        <button
          type="submit"
          className={`px-6 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${
            bmadMode 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
          disabled={!message.trim()}
        >
          {bmadMode ? '🚀' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
