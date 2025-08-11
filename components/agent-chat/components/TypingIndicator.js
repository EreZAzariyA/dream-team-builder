'use client';

import { motion } from 'framer-motion';

/**
 * Typing indicator component
 * Shows animated dots when agent is typing
 */
const TypingIndicator = ({ agent, isVisible }) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-start"
    >
      <div className="bg-gray-100 text-gray-900 px-3 py-2 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{agent?.icon || '🤖'}</span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;