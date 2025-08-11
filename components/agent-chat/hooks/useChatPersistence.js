'use client';

import { useEffect, useCallback } from 'react';

/**
 * Custom hook for managing chat message persistence
 * Handles saving and loading messages to/from localStorage
 */
export const useChatPersistence = (conversationId, messages) => {
  // Persist messages to localStorage
  const persistMessages = useCallback((chatId, messagesArray) => {
    if (chatId && messagesArray.length > 0) {
      localStorage.setItem(`chat-messages-${chatId}`, JSON.stringify(messagesArray));
    }
  }, []);

  const loadPersistedMessages = useCallback((chatId) => {
    if (!chatId) return [];
    try {
      const stored = localStorage.getItem(`chat-messages-${chatId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load persisted messages:', e);
      return [];
    }
  }, []);

  const saveSession = useCallback((agentId, sessionData) => {
    localStorage.setItem(`chat-session-${agentId}`, JSON.stringify({
      ...sessionData,
      timestamp: Date.now()
    }));
  }, []);

  const loadSession = useCallback((agentId) => {
    try {
      const stored = localStorage.getItem(`chat-session-${agentId}`);
      if (!stored) return null;

      const session = JSON.parse(stored);
      const sessionAge = Date.now() - session.timestamp;
      
      // Use saved session if less than 1 hour old
      if (sessionAge < 60 * 60 * 1000) {
        return session;
      } else {
        // Remove expired session
        localStorage.removeItem(`chat-session-${agentId}`);
        return null;
      }
    } catch (e) {
      console.warn('Failed to parse saved chat session:', e);
      localStorage.removeItem(`chat-session-${agentId}`);
      return null;
    }
  }, []);

  const clearSession = useCallback((agentId, conversationId) => {
    localStorage.removeItem(`chat-session-${agentId}`);
    if (conversationId) {
      localStorage.removeItem(`chat-messages-${conversationId}`);
    }
  }, []);

  // Auto-persist messages whenever they change
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      persistMessages(conversationId, messages);
    }
  }, [messages, conversationId, persistMessages]);

  return {
    persistMessages,
    loadPersistedMessages,
    saveSession,
    loadSession,
    clearSession
  };
};