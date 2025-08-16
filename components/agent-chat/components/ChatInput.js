'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Mic } from 'lucide-react';
import AgentCommands from './AgentCommands';

/**
 * Modern chat input component inspired by LinkedIn's design
 * Features enhanced styling, multiple action buttons, and better UX
 */
const ChatInput = ({ 
  agent, 
  isLoading, 
  onSendMessage,
  placeholder = null 
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [rows, setRows] = useState(1);
  const inputRef = useRef(null);
  const maxRows = 4;

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const message = newMessage.trim();
    if (!message || isLoading) return;
    
    onSendMessage(message);
    setNewMessage('');
    setRows(1);
    inputRef.current?.focus();
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollHeight = inputRef.current.scrollHeight;
      const lineHeight = 18; // Compact line height
      const newRows = Math.min(Math.ceil(scrollHeight / lineHeight), maxRows);
      setRows(newRows);
      inputRef.current.style.height = `${Math.min(scrollHeight, maxRows * lineHeight)}px`;
    }
  }, [newMessage]);

  const inputPlaceholder = placeholder || `Write a message to ${agent?.name || 'Agent'}...`;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      {/* Main Input Area */}
      <div className="p-3">
        <div 
          className={`flex items-end bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-200 ${
            isFocused 
              ? 'border-blue-500 shadow-sm ring-1 ring-blue-500' 
              : 'border-gray-300 dark:border-gray-600 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          {/* Emoji/Attachment Actions - Left Side */}
          <div className="flex items-center pl-3 pb-2.5 pt-2.5 space-x-1.5">
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
              title="Add emoji"
            >
              <Smile size={16} />
            </button>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 min-w-0 py-2.5">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={inputPlaceholder}
              className="w-full resize-none border-0 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-0 text-sm leading-tight"
              style={{ 
                minHeight: '18px',
                maxHeight: `${maxRows * 18}px`
              }}
              rows={rows}
              disabled={isLoading}
            />
          </div>

          {/* Send Button - Right Side */}
          <div className="flex items-center pr-3 pb-2.5 pt-2.5">
            {/* Voice Message Button (when no text) */}
            {!newMessage.trim() && !isLoading && (
              <button
                type="button"
                className="p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                title="Send voice message"
              >
                <Mic size={16} />
              </button>
            )}

            {/* Send Button (when has text) */}
            {(newMessage.trim() || isLoading) && (
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || isLoading}
                className={`p-1.5 rounded-full transition-all duration-200 ${
                  newMessage.trim() && !isLoading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transform hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title="Send message"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Helper Text */}
        {isFocused && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>Press Enter to send, Shift + Enter for new line</span>
            {newMessage.length > 0 && (
              <span className={`${newMessage.length > 1000 ? 'text-amber-500' : ''}`}>
                {newMessage.length}/1000
              </span>
            )}
          </div>
        )}
      </div>

      {/* Agent Commands Bar */}
      <AgentCommands 
        agent={agent} 
        isLoading={isLoading} 
        newMessage={newMessage}
        onCommandSelect={setNewMessage}
      />
    </div>
  );
};

export default ChatInput;