'use client';

import { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import ScrollToBottomButton from './ScrollToBottomButton';

/**
 * Messages list container component
 * Manages message rendering, scrolling, and scroll-to-bottom functionality
 */
const MessagesList = ({ 
  messages, 
  agent, 
  isLoading, 
  isTyping, 
  error 
}) => {
  const messagesEndRef = useRef(null);
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
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (!messagesContainer) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    return scrollHeight - scrollTop - clientHeight < 100; // Within 100px of bottom
  };

  // Handle scroll events to show/hide scroll button
  const handleScroll = (e) => {
    const container = e.target;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    setShowScrollButton(!isAtBottom && messages.length > 3);
  };

  return (
    <div 
      className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth relative"
      style={{ 
        scrollBehavior: 'smooth',
        scrollPaddingBottom: '1rem',
        minHeight: '0',
        maxHeight: '100%'
      }}
      onScroll={handleScroll}
    >
      {isLoading && messages.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessage 
          key={message.id}
          message={message}
          agent={agent}
        />
      ))}
      
      <TypingIndicator 
        agent={agent}
        isVisible={isTyping}
      />
      
      <ScrollToBottomButton
        isVisible={showScrollButton}
        onClick={() => {
          scrollToBottom();
          setShowScrollButton(false);
        }}
      />
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessagesList;