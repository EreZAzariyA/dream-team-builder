'use client';

import { X, Minimize2, Maximize2 } from 'lucide-react';

/**
 * Chat header component
 * Shows agent info and window controls
 */
const ChatHeader = ({
  agent,
  agentId,
  minimizable = true,
  isMinimized = false,
  onClose,
  onToggleMinimize
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{agent?.icon || '🤖'}</span>
          <div>
            <h3 className="font-semibold text-gray-900">
              {agent?.name || agentId}
            </h3>
            <p className="text-sm text-gray-500">
              {agent?.title || 'AI Agent'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {minimizable && (
          <button
            onClick={onToggleMinimize}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded text-gray-500"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;