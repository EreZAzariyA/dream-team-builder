'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';

import ChatHeader from './components/ChatHeader';
import MessagesList from './components/MessagesList';
import ChatInput from './components/ChatInput';
import ApiKeyGuard from '../ui/ApiKeyGuard';
import { usePusherChat } from './hooks/usePusherChat';
import { useChatPersistence } from './hooks/useChatPersistence';
import { useChatAPI } from './hooks/useChatAPI';
import { useApiKeys } from '../../lib/hooks/useApiKeys';

/**
 * Main Agent Chat Interface Component
 * 
 * Provides direct conversational interaction with BMAD agent personas
 * Features:
 * - Real-time messaging via Pusher
 * - Agent persona consistency
 * - Chat history persistence
 * - Minimizable chat window
 */
const AgentChat = ({ 
  agentId, 
  onClose, 
  initialMessage = null,
  className = "",
  minimizable = true
}) => {
  const { data: session, status } = useSession();
  const user = session?.user;
  const { hasAnyKeys, missingProviders, loading: apiKeysLoading } = useApiKeys();
  
  // UI State
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [agent, setAgent] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Refs for initialization control
  const initializationRef = useRef({ isInitializing: false, hasInitialized: false });

  // Custom hooks
  const { setupPusherSubscription, cleanup: cleanupPusher } = usePusherChat();
  const { saveSession, loadSession, clearSession, loadPersistedMessages } = useChatPersistence(conversationId, messages);
  const { isLoading, error, initializeChat, loadChatHistory, sendMessage, endChat, setError } = useChatAPI(agentId);

  // Define handleSendMessage early so it can be used in useEffect
  const handleSendMessage = useCallback(async (messageText) => {
    const message = messageText.trim();
    if (!message || !conversationId) return;

    try {
      setIsTyping(true);
      
      // Create and add user message to state IMMEDIATELY, before API call
      const userMessage = {
        id: `msg_${Date.now()}`,
        from: 'user',
        fromName: user.name || user.email?.split('@')[0] || 'You',
        to: 'agent',
        content: message,
        timestamp: new Date(),
        type: 'user_message'
      };

      setMessages(prev => [...prev, userMessage]);
      
      // Now make the API call
      const result = await sendMessage(messageText, conversationId, user);
      
      // Update with server version if provided
      if (result && result.serverUserMessage) {
        setMessages(prev => {
          const updated = [...prev];
          const messageIndex = updated.findIndex(m => m.id === userMessage.id);
          if (messageIndex !== -1) {
            updated[messageIndex] = result.serverUserMessage;
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err.message);
      setIsTyping(false);
    }
  }, [sendMessage, conversationId, user]);

  // Initialize chat session only once
  useEffect(() => {
    const initRef = initializationRef.current;
    
    const initializeSession = async () => {
      if (agentId && user && status === 'authenticated' && !conversationId && !isLoading && !initRef.isInitializing && !initRef.hasInitialized) {
        initRef.isInitializing = true;
        
        // Check for existing session in localStorage first
        const savedSession = loadSession(agentId);
        if (savedSession) {
          setConversationId(savedSession.conversationId);
          
          // Try to restore from localStorage first - but ONLY if messages array is empty
          if (messages.length === 0) {
            const persistedMessages = loadPersistedMessages(savedSession.conversationId);
            if (persistedMessages.length > 0) {
              // Restore persisted messages
              setMessages(persistedMessages);
              setupPusherForChat(savedSession.conversationId);
              
              initRef.hasInitialized = true;
              initRef.isInitializing = false;
              return;
            }
          }
          
          // Fallback to API if no persisted messages
          await handleLoadChatHistory(savedSession.conversationId);
          return;
        }
        
        // Initialize new chat session
        await handleInitializeChat();
      }
    };

    initializeSession();
    
    return () => {
      // Only cleanup on actual unmount, not hot reload
      if (process.env.NODE_ENV === 'production') {
        cleanupPusher();
        initRef.isInitializing = false;
        initRef.hasInitialized = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, user, status]); // Dependencies intentionally limited to prevent infinite loops

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && conversationId && !initialMessageSent) {
      setTimeout(() => {
        handleSendMessage(initialMessage);
        setInitialMessageSent(true);
      }, 1000);
    }
  }, [initialMessage, conversationId, initialMessageSent, handleSendMessage]);

  const setupPusherForChat = useCallback((chatId) => {
    setupPusherSubscription(
      chatId,
      // onMessage
      (agentResponse) => {
        setMessages(prev => {
          // Check if this message already exists (prevent duplicates)
          const messageAlreadyExists = prev.find(m => m.id === agentResponse.id);
          if (messageAlreadyExists) {
            return prev;
          }
          
          // Add the agent response after user message
          return [...prev, agentResponse];
        });
        setIsTyping(false);
      },
      // onChatStarted
      (message) => {
        setMessages(prev => [...prev, message]);
      },
      // onChatEnded
      () => {
        setError('Chat session ended');
      }
    );
  }, [setupPusherSubscription, setError]);

  const handleInitializeChat = async () => {
    try {
      // Always initialize with regular chat first
      const result = await initializeChat();
      
      setConversationId(result.chatId);
      setAgent(result.agent);
      setMessages([result.greeting]);
      
      // Save session to localStorage
      saveSession(agentId, {
        conversationId: result.chatId,
        agentName: result.agent?.name || agentId
      });
      
      // Subscribe to real-time updates
      setupPusherForChat(result.chatId);
      
      // Mark initialization as complete
      initializationRef.current.hasInitialized = true;
    } catch (error) {
      console.error('Error initializing chat:', error);
      initializationRef.current.isInitializing = false;
    }
  };

  const handleLoadChatHistory = async (chatId) => {
    try {
      const result = await loadChatHistory(chatId);
      setAgent(result.agent);
      // Set messages from chat history
      setMessages(result.messages);
      setupPusherForChat(chatId);
    } catch (err) {
      console.warn('Failed to load chat history, starting new session:', err.message);
      clearSession(agentId);
      setConversationId(null);
      handleInitializeChat();
    } finally {
      initializationRef.current.isInitializing = false;
      initializationRef.current.hasInitialized = true;
    }
  };

  const handleClose = async () => {
    if (conversationId) {
      await endChat(conversationId);
      clearSession(agentId, conversationId);
    }
    
    cleanupPusher();
    setIsOpen(false);
    onClose?.();
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isOpen) return null;
  
  // Show loading while session is being determined
  if (status === 'loading') {
    return (
      <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm text-gray-600">Initializing chat...</span>
        </div>
      </div>
    );
  }
  
  // Show error if not authenticated
  if (status === 'unauthenticated' || !user) {
    return (
      <div className="fixed bottom-4 right-4 bg-white border border-red-200 rounded-lg shadow-xl z-50 p-4">
        <div className="text-center">
          <h3 className="font-semibold text-red-800 mb-2">Authentication Required</h3>
          <p className="text-sm text-red-600">Please log in to chat with agents.</p>
        </div>
      </div>
    );
  }


  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`fixed bottom-4 right-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden ${className}`}
      style={{ 
        width: isMinimized ? '300px' : '450px', 
        height: isMinimized ? '50px' : '580px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
    >
      <ChatHeader
        agent={agent}
        agentId={agentId}
        minimizable={minimizable}
        isMinimized={isMinimized}
        onClose={handleClose}
        onToggleMinimize={toggleMinimize}
      />

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
            style={{ height: 'calc(100% - 80px)' }}
          >
            <MessagesList
              messages={messages}
              agent={agent}
              isLoading={isLoading && messages.length === 0}
              isTyping={isTyping}
              error={error}
            />

            <ChatInput
              agent={agent}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AgentChat;