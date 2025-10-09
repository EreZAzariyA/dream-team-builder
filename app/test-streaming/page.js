'use client';

import { useState } from 'react';
import AgentChat from '@/components/agent-chat/AgentChat';

export default function TestStreamingPage() {
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Agent Chat Streaming Test
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Test Instructions
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Click the button below to open the agent chat</li>
            <li>Send a message to any agent (e.g., "pm" for Product Manager)</li>
            <li>Watch the response stream in real-time</li>
            <li>Verify that you see the streaming indicator and content appears gradually</li>
          </ol>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setShowChat(!showChat)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showChat ? 'Hide Chat' : 'Show Agent Chat'}
          </button>
        </div>

        {showChat && (
          <div className="relative">
            <AgentChat 
              agentId="pm" 
              onClose={() => setShowChat(false)}
              initialMessage="Hello! Can you help me with product management?"
            />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Expected Behavior
          </h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>✅ Chat window opens with agent greeting</li>
            <li>✅ User message appears immediately</li>
            <li>✅ Agent response starts streaming with typing indicator</li>
            <li>✅ Content appears word by word in real-time</li>
            <li>✅ Streaming indicator disappears when complete</li>
            <li>✅ No waiting for complete response</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
