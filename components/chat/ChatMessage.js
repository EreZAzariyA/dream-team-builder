
'use client';

import React from 'react';

const ChatMessage = ({ message, onAction }) => {
  const isUser = message.sender === 'User';
  const isSystem = message.sender === 'System' || message.sender === 'BMAD System';
  const isAgent = message.structured && message.structured.agentId;
  
  const getMessageStyle = () => {
    if (isUser) {
      return 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg border border-blue-500/20';
    } else if (isAgent) {
      return 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-md border border-gray-200 dark:border-gray-600';
    } else if (isSystem) {
      switch (message.type) {
        case 'workflow-suggestion':
          return 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-gray-800 dark:text-gray-200 shadow-sm border border-indigo-200 dark:border-indigo-700';
        case 'workflow-started':
          return 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-gray-800 dark:text-gray-200 shadow-sm border border-emerald-200 dark:border-emerald-700';
        default:
          return 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 shadow-sm border border-amber-200 dark:border-amber-700';
      }
    } else {
      return 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-600';
    }
  };

  const handleActionClick = (action) => {
    if (onAction) {
      onAction(action, message);
    }
  };

  // Render structured agent response
  const renderStructuredResponse = (structured) => {
    const { response, metadata } = structured;
    
    return (
      <div className="space-y-3">
        {/* Agent summary */}
        {response.summary && (
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 pl-4 py-2 rounded-r-lg mb-4">
            💡 {response.summary}
          </div>
        )}
        
        {/* Main content */}
        {response.content.main && (
          <div className="text-base">
            {response.content.main}
          </div>
        )}
        
        {/* Structured sections */}
        {response.content.sections && response.content.sections.map((section, index) => (
          <div key={index} className="mt-6">
            <h4 className="font-semibold text-lg text-purple-700 dark:text-purple-400 mb-3 flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              {section.title}
            </h4>
            
            {section.type === 'list' && (
              <ul className="space-y-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                {section.content.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start space-x-3">
                    <span className="text-emerald-500 mt-1 text-sm">▸</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            )}
            
            {section.type === 'action_items' && (
              <div className="space-y-3">
                {section.content.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-start space-x-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border-l-4 border-amber-400 shadow-sm">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                      <span className="text-sm">
                        {item.priority === 'high' ? '🔥' : item.priority === 'medium' ? '⚡' : '📝'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                        {typeof item === 'string' ? item : item.task}
                      </div>
                      {typeof item === 'object' && item.assignee && (
                        <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          👤 {item.assignee}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {section.type === 'text' && (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {Array.isArray(section.content) ? section.content.join(' ') : section.content}
              </div>
            )}
            
            {section.type === 'code' && (
              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                <code>{Array.isArray(section.content) ? section.content.join('\n') : section.content}</code>
              </pre>
            )}
          </div>
        ))}
        
        {/* Suggested followups */}
        {metadata.suggestedFollowups && metadata.suggestedFollowups.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">💭 Suggested next steps</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {metadata.suggestedFollowups.map((followup, index) => (
                <button
                  key={index}
                  onClick={() => handleActionClick(`command:${followup}`)}
                  className="inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <span className="mr-1">⚡</span>
                  {followup}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col max-w-md sm:max-w-lg lg:max-w-3xl p-4 rounded-xl mb-4 ${getMessageStyle()}`}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {isAgent ? (
            <>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm shadow-md">
                {message.structured.agentIcon}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{message.structured.agentName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{message.structured.agentTitle}</span>
              </div>
            </>
          ) : isUser ? (
            <>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm shadow-md">
                👤
              </div>
              <span className="font-semibold text-white">You</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-sm shadow-md">
                🔧
              </div>
              <span className="font-semibold">{message.sender}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {message.type === 'workflow-started' && (
            <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded-full font-medium shadow-sm">Workflow</span>
          )}
          {message.type === 'workflow-suggestion' && (
            <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded-full font-medium shadow-sm">Suggestion</span>
          )}
          {isAgent && (
            <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full font-medium shadow-sm">AI Agent</span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {message.timestamp}
          </span>
        </div>
      </div>
      
      <div className="text-base mb-2">
        {isAgent && message.structured ? (
          renderStructuredResponse(message.structured)
        ) : message.content && message.content.includes('=== BMad Orchestrator Commands ===') ? (
          <div className="font-mono text-sm space-y-2">
            {message.content.split('\n').map((line, index) => {
              // Format headers with === decoration
              if (line.includes('===') && (line.includes('Commands') || line.includes('Agents') || line.includes('Workflows'))) {
                return (
                  <div key={index} className="text-lg font-bold text-blue-600 dark:text-blue-400 border-b border-blue-200 dark:border-blue-700 pb-1 mb-2">
                    {line.replace(/=/g, '').trim()}
                  </div>
                );
              }
              // Format command lines with *command pattern
              if (line.trim().startsWith('*')) {
                const [command, ...description] = line.split('.');
                return (
                  <div key={index} className="flex items-start space-x-2 py-1">
                    <span className="text-green-600 dark:text-green-400 font-bold min-w-0 flex-shrink-0">
                      {command.trim()}
                    </span>
                    <span className="text-gray-600 dark:text-gray-300 text-sm">
                      {description.join('.').replace(/\./g, '').trim()}
                    </span>
                  </div>
                );
              }
              // Format category headers
              if (line.trim() && !line.startsWith(' ') && line.includes(':') && !line.startsWith('*')) {
                return (
                  <div key={index} className="font-semibold text-purple-600 dark:text-purple-400 mt-3 mb-1">
                    {line.trim()}
                  </div>
                );
              }
              // Format tips and notes
              if (line.trim().startsWith('💡') || line.trim().startsWith('Tip:')) {
                return (
                  <div key={index} className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border-l-4 border-yellow-400 text-sm">
                    {line.trim()}
                  </div>
                );
              }
              // Regular text lines
              if (line.trim()) {
                return (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    {line.trim()}
                  </div>
                );
              }
              // Empty lines for spacing
              return <div key={index} className="h-1"></div>;
            })}
          </div>
        ) : (
          message.content
        )}
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
