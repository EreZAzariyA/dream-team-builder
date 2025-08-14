'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import ScrollToBottomButton from './ScrollToBottomButton';

/**
 * Modern messages list with LinkedIn-style grouping and enhanced UX
 * Features message grouping, date separators, and smooth scrolling
 */
const MessagesList = ({ 
  messages, 
  agent, 
  isLoading, 
  isTyping, 
  error 
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto scroll to bottom only if user is near bottom
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom();
      setShowScrollButton(false);
    } else {
      setShowScrollButton(true);
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  };

  // Check if user is near bottom of chat
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < 100; // Within 100px of bottom
  };

  // Handle scroll events to show/hide scroll button
  const handleScroll = (e) => {
    const container = e.target;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    setShowScrollButton(!isAtBottom && messages.length > 3);
  };

  // Simple date separator function for individual messages
  const addDateSeparators = (messages) => {
    const result = [];
    let lastDate = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp);
      const dateString = messageDate.toDateString();

      if (dateString !== lastDate) {
        result.push({
          type: 'date-separator',
          date: formatDateSeparator(messageDate),
          id: `date-${dateString}`
        });
        lastDate = dateString;
      }

      result.push(message);
    });

    return result;
  };

  // Format date separator like LinkedIn
  const formatDateSeparator = (date) => {
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'TODAY';
    } else if (diffInDays === 1) {
      return 'YESTERDAY';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
      }).toUpperCase();
    }
  };

  const messagesWithSeparators = addDateSeparators(messages);

  return (
    <div 
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto scroll-smooth relative bg-gray-50 dark:bg-gray-900"
      style={{ 
        scrollBehavior: 'smooth',
        scrollPaddingBottom: '1rem',
        minHeight: '0',
        maxHeight: '100%'
      }}
      onScroll={handleScroll}
    >
      {/* Loading State */}
      {isLoading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Starting conversation with {agent?.name || 'Agent'}...</p>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-4"
        >
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Connection Error
                </h3>
                <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Messages */}
      <div className="px-3 py-3">
        {messagesWithSeparators.map((item, index) => {
          // Date separator
          if (item.type === 'date-separator') {
            return (
              <div key={item.id} className="flex justify-center my-4">
                <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {item.date}
                  </span>
                </div>
              </div>
            );
          }

          // Individual message
          return (
            <ChatMessage
              key={item.id}
              message={item}
              agent={agent}
              showAvatar={true}
              isGrouped={false}
            />
          );
        })}
        
        {/* Typing Indicator */}
        <TypingIndicator 
          agent={agent}
          isVisible={isTyping}
        />
      </div>
      
      {/* Scroll to Bottom Button */}
      <ScrollToBottomButton
        isVisible={showScrollButton}
        onClick={() => {
          scrollToBottom();
          setShowScrollButton(false);
        }}
      />
      
      {/* Empty space for auto-scroll */}
      <div ref={messagesEndRef} style={{ height: '1px' }} />
    </div>
  );
};

export default MessagesList;