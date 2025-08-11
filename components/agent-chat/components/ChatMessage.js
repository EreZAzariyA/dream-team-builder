'use client';

import { motion } from 'framer-motion';

/**
 * Individual chat message component
 * Renders a single message with appropriate styling for user vs agent
 */
const ChatMessage = ({ message, agent }) => {
  const isUser = message.from === 'user';
  
  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-sm px-3 py-2 rounded-lg break-words ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="flex items-start space-x-2">
          {!isUser && (
            <span className="text-lg">{agent?.icon || '🤖'}</span>
          )}
          <div className="flex-1">
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            <p className={`text-xs mt-1 ${
              isUser ? 'text-blue-100' : 'text-gray-500'
            }`}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;