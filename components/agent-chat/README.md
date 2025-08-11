# Agent Chat Component System

This folder contains a refactored, modular agent chat system that replaces the monolithic `AgentChatInterface.js` component.

## Architecture Overview

The system is organized into focused, reusable components and custom hooks:

```
agent-chat/
├── AgentChat.js              # Main container component
├── components/               # UI Components
│   ├── ChatHeader.js        # Header with agent info and controls
│   ├── MessagesList.js      # Messages container with scrolling
│   ├── ChatMessage.js       # Individual message component
│   ├── ChatInput.js         # Message input with send button
│   ├── TypingIndicator.js   # Animated typing dots
│   └── ScrollToBottomButton.js # Scroll to bottom button
├── hooks/                   # Custom hooks for business logic
│   ├── usePusherChat.js     # Real-time messaging via Pusher
│   ├── useChatPersistence.js # Local storage persistence
│   └── useChatAPI.js        # API communication
├── utils/                   # Utility functions (future)
├── index.js                 # Clean exports
└── README.md               # This file
```

## Components

### AgentChat (Main Container)
The primary component that orchestrates the entire chat experience.

**Props:**
- `agentId`: String - ID of the agent to chat with
- `onClose`: Function - Callback when chat is closed
- `initialMessage`: String (optional) - Message to send on startup
- `className`: String (optional) - Additional CSS classes
- `minimizable`: Boolean (default: true) - Whether chat can be minimized
- `existingConversationId`: String (optional) - Resume existing conversation

**Usage:**
```jsx
import { AgentChat } from '@/components/agent-chat';

<AgentChat 
  agentId="pm" 
  onClose={() => setShowChat(false)}
  initialMessage="Help me create a PRD"
/>
```

### Sub-Components

All sub-components are designed to work independently and can be used in custom implementations:

- **ChatHeader**: Agent information and window controls
- **MessagesList**: Scrollable messages container with auto-scroll
- **ChatMessage**: Individual message bubble with timestamp
- **ChatInput**: Input field with send button and keyboard shortcuts
- **TypingIndicator**: Animated dots when agent is responding
- **ScrollToBottomButton**: Appears when user scrolls up

## Custom Hooks

### usePusherChat
Manages real-time messaging through Pusher WebSocket connections.

**Features:**
- Automatic connection management
- Event handling for chat messages
- Fallback client creation
- Proper cleanup

### useChatPersistence  
Handles message persistence and session management.

**Features:**
- Auto-save messages to localStorage
- Session restoration on page reload
- Expired session cleanup
- Cross-tab persistence

### useChatAPI
Manages all API interactions with the chat backend.

**Features:**
- Chat initialization
- Message sending with debouncing
- Chat history loading
- Error handling and retries

## Key Improvements

1. **Modularity**: Each component has a single responsibility
2. **Reusability**: Components can be used independently
3. **Maintainability**: Easier to test, debug, and extend
4. **Performance**: Better code splitting and optimization
5. **Type Safety**: Clear prop interfaces and data flow
6. **Testing**: Smaller, focused units are easier to test

## Migration from Legacy

The old `AgentChatInterface.js` has been moved to `components/legacy/` and should not be used in new code. 

**Before:**
```jsx
import AgentChatInterface from '@/components/workflow/AgentChatInterface';
```

**After:**
```jsx
import { AgentChat } from '@/components/agent-chat';
```

The API is mostly compatible, but some internal implementation details have changed.

## Development Guidelines

1. **Keep components focused**: Each component should do one thing well
2. **Use custom hooks**: Extract complex logic into reusable hooks  
3. **Handle errors gracefully**: All components should handle loading/error states
4. **Document props**: Use JSDoc comments for all component props
5. **Write tests**: Each component/hook should have corresponding tests

## Future Enhancements

- [ ] Add TypeScript interfaces
- [ ] Create comprehensive test suite
- [ ] Add Storybook stories
- [ ] Implement message reactions
- [ ] Add file upload capability
- [ ] Support message editing/deletion
- [ ] Add chat themes/customization