'use client';

import React, { memo } from 'react';
import { Badge } from '../common/Badge';
import { User, MessageSquare, AlertCircle, Clock, Loader2, CheckCircle } from 'lucide-react';

const MessageBubble = memo(({ 
  message, 
  index, 
  getAgentIcon,
  formatTimestamp,
  renderStructuredContent,
  getStatusIcon 
}) => {
  const isUser = message.from === 'User' || message.from === 'user';
  const isSystem = message.from === 'System' || message.from === 'BMAD System' || message.from === 'system';
  const isElicitation = message.isElicitation || message.type === 'elicitation';
  const agentId = message.agentId || message.from?.toLowerCase().replace(/\s+/g, '-');
  const agentIcon = getAgentIcon(agentId);
  const displayName = isUser ? 'You' : isSystem ? 'System' : (message.from?.charAt(0).toUpperCase() + message.from?.slice(1) || 'Agent');

  return (
    <div
      key={message.id || index}
      className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex items-start gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Enhanced Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : isSystem 
                ? 'bg-gray-600 text-white'
                : isElicitation
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white animate-pulse'
                  : 'bg-gradient-to-br from-green-500 to-blue-600 text-white'
          }`}>
            {isUser ? (
              <User className="w-5 h-5" />
            ) : isSystem ? (
              <MessageSquare className="w-5 h-5" />
            ) : (
              <span className="text-lg">{agentIcon}</span>
            )}
          </div>
          {isElicitation && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
              <AlertCircle className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Enhanced Message Content */}
        <div
          className={`rounded-2xl p-4 transition-all duration-200 ${
            isUser 
              ? 'bg-blue-600 text-white rounded-br-md shadow-lg' 
              : isElicitation
                ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-700 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-md'
                : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm'
          }`}
        >
          {/* Enhanced Header */}
          <div className={`flex items-center gap-2 mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className="flex items-center gap-2">
              {!isUser && (
                <span className="text-lg">{agentIcon}</span>
              )}
              <span className={`text-sm font-semibold ${
                isUser 
                  ? 'text-blue-100' 
                  : isElicitation
                    ? 'text-amber-800 dark:text-amber-200'
                    : 'text-gray-700 dark:text-gray-300'
              }`}>
                {displayName}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {isElicitation && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Needs Response
                </Badge>
              )}
              {message.type && !isElicitation && (
                <Badge variant="outline" className={`text-xs ${
                  isUser 
                    ? 'border-blue-300 text-blue-100' 
                    : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400'
                }`}>
                  {message.type.replace(/-/g, ' ')}
                </Badge>
              )}
              {message.status && getStatusIcon(message.status)}
            </div>
          </div>

          {/* Content */}
          <div className="text-sm leading-relaxed">
            {renderStructuredContent(message)}
          </div>

          {/* Enhanced Timestamp */}
          <div className={`text-xs mt-3 flex items-center gap-2 ${
            isUser 
              ? 'text-blue-200 justify-end' 
              : isElicitation
                ? 'text-amber-600 dark:text-amber-400 justify-start'
                : 'text-gray-500 dark:text-gray-400 justify-start'
          }`}>
            <Clock className="w-3 h-3" />
            {formatTimestamp(message.timestamp)}
            {isElicitation && (
              <span className="ml-2 inline-flex items-center">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse mr-1"></div>
                Awaiting input
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;