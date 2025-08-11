'use client';

import { useState, useRef } from 'react';
import { Send } from 'lucide-react';

/**
 * Chat input component
 * Handles message input and sending
 */
const ChatInput = ({ 
  agent, 
  isLoading, 
  onSendMessage,
  placeholder = null 
}) => {
  const [newMessage, setNewMessage] = useState('');
  const inputRef = useRef(null);

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
  };

  const inputPlaceholder = placeholder || `Message ${agent?.name || 'Agent'}...`;

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={inputPlaceholder}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!newMessage.trim() || isLoading}
          className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;