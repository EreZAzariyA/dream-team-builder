'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

/**
 * Modern chat message component inspired by LinkedIn's design
 * Features enhanced styling, proper avatars, and improved typography
 */
const ChatMessage = ({ message, agent, showAvatar = true, isGrouped = false }) => {
  const isUser = message.from === 'user';
  const [isHovered, setIsHovered] = useState(false);
  
  // Format timestamp like LinkedIn
  const formatTime = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours = Math.abs(now - messageTime) / 36e5;
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return minutes < 1 ? 'now' : `${minutes}m`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      return messageTime.toLocaleDateString();
    }
  };

  // Get initials for avatar fallback
  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '';
  };

  const userName = message.fromName || 'User';
  const agentName = agent?.name || 'Agent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`group flex ${isUser ? 'justify-end' : 'justify-start'} ${
        isGrouped ? 'mt-0.5' : 'mt-2'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Agent Avatar - Left side */}
      {!isUser && showAvatar && (
        <div className="flex-shrink-0 mr-2">
          {agent?.icon ? (
            <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shadow-sm">
              <span className="text-sm">{agent.icon}</span>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium shadow-sm">
              {getInitials(agentName)}
            </div>
          )}
        </div>
      )}

      {/* Message Content Container */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Sender name and timestamp - only for new message groups */}
        {!isGrouped && (
          <div className={`flex items-center mb-0.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {isUser ? userName : agentName}
            </span>
            <span className={`text-xs text-gray-500 dark:text-gray-400 ${
              isUser ? 'mr-1.5' : 'ml-1.5'
            }`}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`relative px-3 py-2 rounded-xl shadow-sm transition-all duration-200 ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md'
          } ${isHovered ? 'shadow-md' : ''}`}
        >
          {/* Message Content */}
          <div className="text-sm leading-snug whitespace-pre-wrap break-words">
            {message.metadata?.contentType === 'markdown' ? (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: message.content
                    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mb-2 mt-0">$1</h1>')
                    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mb-1 mt-2">$1</h2>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
                    .replace(/\n/g, '<br>')
                }}
              />
            ) : (
              <>
                {message.content}
                {/* Streaming indicator */}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse rounded-sm"></span>
                )}
              </>
            )}
          </div>

          {/* Typing indicator or status */}
          {message.type === 'typing' && (
            <div className="flex items-center mt-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}

          {/* No streaming indicator needed - text streams naturally */}

          {/* Error indicator for failed messages */}
          {message.hasError && (
            <div className="flex items-center mt-2">
              <span className="text-xs text-red-500 dark:text-red-400">⚠️ Message failed to send</span>
            </div>
          )}

          {/* Message status for user messages */}
          {isUser && message.status && (
            <div className="absolute -bottom-1 -right-1">
              <div className={`w-3 h-3 rounded-full border-2 border-white ${
                message.status === 'sent' ? 'bg-gray-400' :
                message.status === 'delivered' ? 'bg-blue-500' :
                message.status === 'read' ? 'bg-green-500' :
                'bg-gray-300'
              }`} />
            </div>
          )}
        </div>

        {/* Timestamp on hover for grouped messages */}
        {isGrouped && isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mt-1 text-xs text-gray-400 ${isUser ? 'text-right' : 'text-left'}`}
          >
            {formatTime(message.timestamp)}
          </motion.div>
        )}
      </div>

      {/* User Avatar - Right side */}
      {isUser && showAvatar && (
        <div className="flex-shrink-0 ml-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white text-xs font-medium shadow-sm">
            {getInitials(userName)}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ChatMessage;