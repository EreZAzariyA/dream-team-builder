'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing chat API interactions
 * Handles initialization, sending messages, and loading history
 * Now includes streaming support
 */
export const useChatAPI = (agentId) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastMessageSentTime = useRef(0);

  const initializeChat = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bmad/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          action: 'start'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return {
          chatId: data.chatId,
          agent: data.agent,
          greeting: data.greeting,
          mockMode: data.mockMode
        };
      } else {
        const errorMsg = data.message || data.error || 'Failed to start chat';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Connection failed: ${error.message}`;
      setError(errorMsg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const loadChatHistory = useCallback(async (chatId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bmad/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          conversationId: chatId,
          action: 'history'
        })
      });

      const data = await response.json();
      
      if (data.success && data.messages?.length > 0) {
        return {
          agent: data.agent,
          messages: data.messages
        };
      } else {
        throw new Error('Failed to load chat history');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const sendMessage = useCallback(async (message, conversationId, user, streaming = false) => {
    const now = Date.now();
    if (now - lastMessageSentTime.current < 1000) {
      console.warn('Duplicate send prevented.');
      return null;
    }
    lastMessageSentTime.current = now;

    if (!message || isLoading || !conversationId) return null;
    
    setIsLoading(true);
    setError(null);
    
    const userMessage = {
      id: `msg_${Date.now()}`,
      from: 'user',
      fromName: user.name || user.email?.split('@')[0] || 'You',
      to: agentId,
      content: message,
      timestamp: new Date(),
      type: 'user_message'
    };

    try {
      const response = await fetch('/api/bmad/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          message,
          conversationId,
          action: 'send',
          streaming
        })
      });

      if (streaming) {
        // Handle streaming response
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log('Streaming data:', data);
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError);
              }
            }
          }
        }

        return { userMessage };
      } else {
        // Handle regular response
        const data = await response.json();
        
        if (data.success) {
          return {
            userMessage,
            serverUserMessage: data.userMessage
          };
        } else {
          const errorMsg = data.error || 'Failed to send message';
          setError(errorMsg);
          throw new Error(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = 'Failed to send message';
      setError(errorMsg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, isLoading]);

  /**
   * Send message with streaming response
   */
  const sendMessageStreaming = useCallback(async (message, conversationId, user, onChunk, onComplete, onError) => {
    const now = Date.now();
    if (now - lastMessageSentTime.current < 1000) {
      console.warn('Duplicate send prevented.');
      return null;
    }
    lastMessageSentTime.current = now;

    if (!message || isLoading || !conversationId) return null;
    
    // No loading state for streaming - real-time feedback is provided via streaming
    setError(null);
    
    const userMessage = {
      id: `msg_${Date.now()}`,
      from: 'user',
      fromName: user.name || user.email?.split('@')[0] || 'You',
      to: agentId,
      content: message,
      timestamp: new Date(),
      type: 'user_message'
    };

    try {
      const response = await fetch('/api/bmad/agents/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          message,
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'user_message':
                  // User message confirmed
                  break;
                  
                case 'content_chunk':
                  if (data.chunk && !data.isComplete) {
                    onChunk?.(data.chunk);
                  } else if (data.isComplete) {
                    onComplete?.();
                  }
                  break;
                  
                case 'stream_complete':
                  onComplete?.();
                  break;
                  
                case 'error':
                  onError?.(data.error);
                  break;
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

      return { userMessage };

    } catch (error) {
      const errorMsg = 'Failed to send message';
      setError(errorMsg);
      onError?.(errorMsg);
      throw error;
    } finally {
      // No loading state management needed for streaming
    }
  }, [agentId, isLoading]);

  const endChat = useCallback(async (conversationId) => {
    if (!conversationId) return;

    try {
      await fetch('/api/bmad/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          conversationId,
          action: 'end'
        })
      });
    } catch (error) {
      console.error('Error ending chat:', error);
    }
  }, [agentId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setErrorMessage = useCallback((message) => {
    setError(message);
  }, []);

  return {
    isLoading,
    error,
    initializeChat,
    loadChatHistory,
    sendMessage,
    sendMessageStreaming,
    endChat,
    clearError,
    setError: setErrorMessage
  };
};