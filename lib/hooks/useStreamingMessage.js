'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Hook for handling streaming messages from agents
 * This provides the foundation for future streaming implementation
 */
export const useStreamingMessage = () => {
  const [streamingMessages, setStreamingMessages] = useState(new Map());
  const streamingTimeouts = useRef(new Map());

  const startStreamingMessage = useCallback((messageId, agentId, initialContent = '') => {
    setStreamingMessages(prev => new Map(prev).set(messageId, {
      id: messageId,
      agentId,
      content: initialContent,
      isStreaming: true,
      timestamp: new Date().toISOString(),
      chunks: []
    }));
  }, []);

  const updateStreamingMessage = useCallback((messageId, newChunk) => {
    setStreamingMessages(prev => {
      const updated = new Map(prev);
      const existing = updated.get(messageId);
      if (existing) {
        const updatedMessage = {
          ...existing,
          content: existing.content + newChunk,
          chunks: [...existing.chunks, newChunk]
        };
        updated.set(messageId, updatedMessage);
      }
      return updated;
    });
  }, []);

  const completeStreamingMessage = useCallback((messageId) => {
    setStreamingMessages(prev => {
      const updated = new Map(prev);
      const existing = updated.get(messageId);
      if (existing) {
        updated.set(messageId, {
          ...existing,
          isStreaming: false,
          completedAt: new Date().toISOString()
        });
      }
      return updated;
    });

    // Clear the message from streaming state after a delay for smooth UX
    const timeoutId = setTimeout(() => {
      setStreamingMessages(prev => {
        const updated = new Map(prev);
        updated.delete(messageId);
        return updated;
      });
      streamingTimeouts.current.delete(messageId);
    }, 1000);

    streamingTimeouts.current.set(messageId, timeoutId);
  }, []);

  const cancelStreamingMessage = useCallback((messageId) => {
    setStreamingMessages(prev => {
      const updated = new Map(prev);
      updated.delete(messageId);
      return updated;
    });

    const timeoutId = streamingTimeouts.current.get(messageId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      streamingTimeouts.current.delete(messageId);
    }
  }, []);

  const getStreamingMessage = useCallback((messageId) => {
    return streamingMessages.get(messageId);
  }, [streamingMessages]);

  const isMessageStreaming = useCallback((messageId) => {
    const message = streamingMessages.get(messageId);
    return message?.isStreaming === true;
  }, [streamingMessages]);

  return {
    streamingMessages,
    startStreamingMessage,
    updateStreamingMessage,
    completeStreamingMessage,
    cancelStreamingMessage,
    getStreamingMessage,
    isMessageStreaming
  };
};

export default useStreamingMessage;