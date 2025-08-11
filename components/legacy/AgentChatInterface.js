'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { Send, Bot, User, MessageCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import { pusherClient } from '@/lib/pusher/config';

/**
 * Agent Chat Interface Component
 * 
 * Provides direct conversational interaction with BMAD agent personas
 * Features:
 * - Real-time messaging via Pusher
 * - Agent persona consistency
 * - Chat history persistence
 * - Typing indicators
 * - Message status tracking
 * - Minimizable chat window
 */

const AgentChatInterface = ({ 
  agentId, 
  onClose, 
  initialMessage = null,
  className = "",
  minimizable = true,
  existingConversationId = null 
}) => {
  const { data: session, status } = useSession();
  const user = session?.user;
  
  // Chat state
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pusherChannelRef = useRef(null);
  const initializationRef = useRef({ isInitializing: false, hasInitialized: false });
  const lastMessageSentTime = useRef(0);

  // Persist messages to localStorage
  const persistMessages = (chatId, messagesArray) => {
    if (chatId && messagesArray.length > 0) {
      localStorage.setItem(`chat-messages-${chatId}`, JSON.stringify(messagesArray));
    }
  };

  const loadPersistedMessages = (chatId) => {
    if (!chatId) return [];
    try {
      const stored = localStorage.getItem(`chat-messages-${chatId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load persisted messages:', e);
      return [];
    }
  };

  // Persist messages whenever they change
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      persistMessages(conversationId, messages);
    }
  }, [messages, conversationId]);

  // Initialize chat session only once
  useEffect(() => {
    const initRef = initializationRef.current;
    
    if (agentId && user && status === 'authenticated' && !conversationId && !isLoading && !initRef.isInitializing && !initRef.hasInitialized) {
      initRef.isInitializing = true;
      setIsInitializing(true);
      // Check for existing session in localStorage first
      const savedSession = localStorage.getItem(`chat-session-${agentId}`);
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          const sessionAge = Date.now() - session.timestamp;
          
          // Use saved session if less than 1 hour old
          if (sessionAge < 60 * 60 * 1000) {
            setConversationId(session.conversationId);
            
            // Try to restore from localStorage first - but ONLY if messages array is empty
            if (messages.length === 0) {
              const persistedMessages = loadPersistedMessages(session.conversationId);
              if (persistedMessages.length > 0) {
                setMessages(persistedMessages);
                setNewMessage('');
                setupPusherSubscription(session.conversationId);
                initRef.hasInitialized = true;
                setIsInitializing(false);
                initRef.isInitializing = false;
                return;
              }
            }
            
            // Fallback to API if no persisted messages
            loadChatHistory(session.conversationId);
            return;
          } else {
            // Remove expired session
            localStorage.removeItem(`chat-session-${agentId}`);
          }
        } catch (e) {
          console.warn('Failed to parse saved chat session:', e);
          localStorage.removeItem(`chat-session-${agentId}`);
        }
      }
      
      initializeChat();
    }
    
    return () => {
      // Only cleanup on actual unmount, not hot reload
      if (process.env.NODE_ENV === 'production') {
        if (pusherChannelRef.current && pusherClient) {
          pusherClient.unsubscribe(pusherChannelRef.current);
        }
        initRef.isInitializing = false;
        initRef.hasInitialized = false;
      }
    };
  }, [agentId, user, status]); // Removed conversationId and isLoading from deps to prevent re-runs

  // Auto scroll to bottom only if user is near bottom
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom();
      setShowScrollButton(false);
    } else {
      setShowScrollButton(true);
    }
  }, [messages]);

  // Handle scroll events to show/hide scroll button
  const handleScroll = (e) => {
    const container = e.target;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    setShowScrollButton(!isAtBottom && messages.length > 3);
  };

  const [initialMessageSent, setInitialMessageSent] = useState(false);

  // ... (the rest of the component)

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && conversationId && !initialMessageSent) {
      setTimeout(() => {
        handleSendMessage(initialMessage);
        setInitialMessageSent(true);
      }, 1000);
    }
  }, [initialMessage, conversationId]);

  const scrollToBottom = (force = false) => {
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

  const loadChatHistory = async (chatId) => {
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
        setAgent(data.agent);
        setMessages(data.messages);
        setupPusherSubscription(chatId);
      } else {
        console.warn('Failed to load chat history, starting new session');
        localStorage.removeItem(`chat-session-${agentId}`);
        setConversationId(null);
        initializeChat();
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      localStorage.removeItem(`chat-session-${agentId}`);
      setConversationId(null);
      initializeChat();
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
      initializationRef.current.isInitializing = false;
      initializationRef.current.hasInitialized = true;
    }
  };

  const initializeChat = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Start new chat session
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
        setConversationId(data.chatId);
        setAgent(data.agent);
        setMessages([data.greeting]);
        
        // Save session to localStorage
        localStorage.setItem(`chat-session-${agentId}`, JSON.stringify({
          conversationId: data.chatId,
          timestamp: Date.now(),
          agentName: data.agent?.name || agentId
        }));
        
        // Subscribe to real-time updates
        setupPusherSubscription(data.chatId);
        
        // Mark initialization as complete
        initializationRef.current.hasInitialized = true;
      } else {
        console.error('Chat API error:', data);
        setError(data.message || data.error || 'Failed to start chat');
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      setError(`Connection failed: ${error.message}`);
      initializationRef.current.isInitializing = false;
      // Don't mark as hasInitialized on error, allow retry
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  };

  const setupPusherSubscription = (chatId) => {
    if (!pusherClient) {
      console.warn('Pusher client not available! Real-time updates disabled');
      
      // Try to create a new Pusher client as fallback
      import('pusher-js').then((PusherModule) => {
        try {
          const PusherClient = PusherModule.default;
          const newClient = new PusherClient('1ea79899b6a4817ca163', {
            cluster: 'mt1',
            forceTLS: true,
            enabledTransports: ['ws', 'wss'],
          });
          setupPusherSubscriptionWithClient(newClient, chatId);
        } catch (error) {
          console.error('Failed to create fallback Pusher client:', error);
        }
      }).catch(error => {
        console.error('Failed to import pusher-js:', error);
      });
      return;
    }

    return setupPusherSubscriptionWithClient(pusherClient, chatId);
  };
  
  const setupPusherSubscriptionWithClient = (client, chatId) => {
    // Check Pusher connection state
    const connectionState = client.connection.state;
    
    if (connectionState === 'disconnected' || connectionState === 'failed') {
      try {
        client.connect();
      } catch (error) {
        console.error('Failed to reconnect Pusher:', error);
      }
    }

    const channelName = `workflow-${chatId}`;
    
    // Check if already subscribed to this channel
    if (pusherChannelRef.current === channelName) {
      return;
    }

    // Cleanup existing subscription only if it's different
    if (pusherChannelRef.current && pusherChannelRef.current !== channelName && client) {
      try {
        client.unsubscribe(pusherChannelRef.current);
      } catch (error) {
        console.error('Error unsubscribing from Pusher channel:', error);
      }
    }
    
    try {
      const channel = client.subscribe(channelName);
      pusherChannelRef.current = channelName;
      
      // Bind event handlers
      channel.bind('chat:message', (data) => {
        try {
          if (data && data.agentResponse) {
            setMessages(prev => {
              try {
                // Check if this message already exists (prevent duplicates)
                const messageExists = prev.find(m => m.id === data.agentResponse.id);
                if (messageExists) {
                  return prev;
                }
                
                return [...prev, data.agentResponse];
              } catch (error) {
                console.error('Error updating messages:', error);
                return prev;
              }
            });
            setIsTyping(false);
            setTimeout(() => scrollToBottom(), 100);
          }
        } catch (error) {
          console.error('Error in chat:message handler:', error);
        }
      });
      
      channel.bind('chat:started', (data) => {
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
          setTimeout(() => scrollToBottom(), 100);
        }
      });
      
      channel.bind('chat:ended', () => {
        setError('Chat session ended');
      });

      // Add subscription error callback
      channel.bind('pusher:subscription_error', (error) => {
        console.error('Pusher subscription error:', error);
      });

    } catch (error) {
      console.error('Error setting up Pusher subscription:', error);
    }
  };

  const handleSendMessage = async (messageText = null) => {
    const now = Date.now();
    if (now - lastMessageSentTime.current < 1000) { // 1-second debounce
        console.warn('[CHAT UI] Duplicate send prevented.');
        return;
    }
    lastMessageSentTime.current = now;

    const message = messageText || newMessage.trim();
    if (!message || isLoading || !conversationId) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      from: 'user',
      fromName: user.name || user.email?.split('@')[0] || 'You',
      to: agent?.id || agentId,
      toName: agent?.name || agentId,
      content: message,
      timestamp: new Date(),
      type: 'user_message'
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);
    setIsTyping(true);
    
    // Always scroll to bottom when sending a message
    setTimeout(() => scrollToBottom(), 100);
    
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
          action: 'send'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Agent response will come via Pusher
        // Only update the user message if it's actually still the last message (not replaced by agent response)
        if (data.userMessage) {
          setMessages(prev => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            // Only update if the last message is still the user message we sent (not an agent response)
            if (lastMessage && lastMessage.from === 'user' && lastMessage.id === userMessage.id) {
              updated[updated.length - 1] = data.userMessage;
            }
            return updated;
          });
        }
      } else {
        setError(data.error || 'Failed to send message');
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    if (conversationId) {
      // End chat session
      fetch('/api/bmad/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          conversationId,
          action: 'end'
        })
      });
      
      // Remove session and messages from localStorage
      localStorage.removeItem(`chat-session-${agentId}`);
      localStorage.removeItem(`chat-messages-${conversationId}`);
    }
    
    if (pusherChannelRef.current && pusherClient) {
      pusherClient.unsubscribe(pusherChannelRef.current);
      pusherChannelRef.current = null;
    }
    
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 ${className}`}
      style={{ 
        width: isMinimized ? '320px' : '400px', 
        height: isMinimized ? '60px' : '600px' 
      }}
    >
      {/* Header */}
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
              onClick={toggleMinimize}
              className="p-1 hover:bg-gray-200 rounded text-gray-500"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-200 rounded text-gray-500"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
            style={{ height: 'calc(100% - 80px)' }}
          >
            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth relative"
              style={{ 
                scrollBehavior: 'smooth',
                scrollPaddingBottom: '1rem',
                minHeight: '0', // Ensure proper flex shrinking
                maxHeight: '100%' // Prevent overflow
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
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-sm px-3 py-2 rounded-lg break-words ${
                      message.from === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.from !== 'user' && (
                        <span className="text-lg">{agent?.icon || '🤖'}</span>
                      )}
                      <div className="flex-1">
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.from === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 text-gray-900 px-3 py-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{agent?.icon || '🤖'}</span>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              {/* Scroll to bottom button */}
              {showScrollButton && (
                <div className="absolute bottom-6 right-6 z-10">
                  <button
                    onClick={() => {
                      scrollToBottom();
                      setShowScrollButton(false);
                    }}
                    className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
                    title="Scroll to bottom"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message ${agent?.name || agentId}...`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!newMessage.trim() || isLoading}
                  className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AgentChatInterface;