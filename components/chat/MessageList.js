
'use client';

import React from 'react';
import ChatMessage from './ChatMessage';

const MessageList = ({ messages, onMessageAction }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => (
        <ChatMessage 
          key={message.id || index} 
          message={message} 
          onAction={onMessageAction}
        />
      ))}
    </div>
  );
};

export default MessageList;
