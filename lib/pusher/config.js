/**
 * Pusher Configuration
 * Real-time communication setup for production deployment
 */

import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
let pusherServer = null;
try {
  if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER || 'mt1',
      useTLS: true,
    });
  } else {
    console.warn('Pusher server environment variables not configured. Real-time features will be disabled.');
  }
} catch (error) {
  console.warn('Failed to initialize Pusher server:', error.message);
}

export { pusherServer };


// Client-side Pusher configuration
let pusherClient = null;
if (typeof window !== 'undefined') {
  try {
    if (process.env.NEXT_PUBLIC_PUSHER_KEY) {
      pusherClient = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY,
        {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
          forceTLS: true,
          enabledTransports: ['ws', 'wss'],
        }
      );
    } else {
      console.warn('Pusher client environment variables not configured. Real-time features will be disabled.');
    }
  } catch (error) {
    console.warn('Failed to initialize Pusher client:', error.message);
  }
}

export { pusherClient };


// Channel names
export const CHANNELS = {
  WORKFLOW: (workflowId) => `workflow-${workflowId}`,
  AGENT: (agentId) => `agent-${agentId}`,
  USER: (userId) => `user-${userId}`,
  GLOBAL: 'global-chat',
};

// Event names
export const EVENTS = {
  WORKFLOW_UPDATE: 'workflow-update',
  AGENT_MESSAGE: 'agent-message',
  USER_MESSAGE: 'user-message',
  AGENT_ACTIVATED: 'agent-activated',
  AGENT_COMPLETED: 'agent-completed',
  AGENT_COMMUNICATION: 'agent-communication',
  WORKFLOW_MESSAGE: 'workflow-message',
  TYPING_START: 'typing-start',
  TYPING_STOP: 'typing-stop',
};

export default { pusherServer, pusherClient, CHANNELS, EVENTS };