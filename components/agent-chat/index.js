// Main component exports
export { default as AgentChat } from './AgentChat';

// Sub-component exports (for advanced use cases)
export { default as ChatHeader } from './components/ChatHeader';
export { default as MessagesList } from './components/MessagesList';
export { default as ChatMessage } from './components/ChatMessage';
export { default as ChatInput } from './components/ChatInput';
export { default as TypingIndicator } from './components/TypingIndicator';
export { default as ScrollToBottomButton } from './components/ScrollToBottomButton';

// Hook exports (for custom implementations)
export { usePusherChat } from './hooks/usePusherChat';
export { useChatPersistence } from './hooks/useChatPersistence';
export { useChatAPI } from './hooks/useChatAPI';