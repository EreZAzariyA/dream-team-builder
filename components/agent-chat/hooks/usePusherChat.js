'use client';

import { useRef, useCallback } from 'react';
import { pusherClient } from '@/lib/pusher/config';

/**
 * Custom hook for managing Pusher chat subscriptions
 * Handles real-time message delivery and connection management
 */
export const usePusherChat = () => {
  const pusherChannelRef = useRef(null);

  const setupPusherSubscriptionWithClient = useCallback((client, chatId, onMessage, onChatStarted, onChatEnded) => {
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
            onMessage(data.agentResponse);
          }
        } catch (error) {
          console.error('Error in chat:message handler:', error);
        }
      });
      
      channel.bind('chat:started', (data) => {
        if (data.message) {
          onChatStarted(data.message);
        }
      });
      
      channel.bind('chat:ended', () => {
        onChatEnded();
      });

      // Add subscription error callback
      channel.bind('pusher:subscription_error', (error) => {
        console.error('Pusher subscription error:', error);
      });

    } catch (error) {
      console.error('Error setting up Pusher subscription:', error);
    }
  }, []);

  const setupPusherSubscription = useCallback((chatId, onMessage, onChatStarted, onChatEnded) => {
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
          setupPusherSubscriptionWithClient(newClient, chatId, onMessage, onChatStarted, onChatEnded);
        } catch (error) {
          console.error('Failed to create fallback Pusher client:', error);
        }
      }).catch(error => {
        console.error('Failed to import pusher-js:', error);
      });
      return;
    }

    return setupPusherSubscriptionWithClient(pusherClient, chatId, onMessage, onChatStarted, onChatEnded);
  }, [setupPusherSubscriptionWithClient]);

  const cleanup = useCallback(() => {
    if (pusherChannelRef.current && pusherClient) {
      try {
        pusherClient.unsubscribe(pusherChannelRef.current);
        pusherChannelRef.current = null;
      } catch (error) {
        console.error('Error cleaning up Pusher subscription:', error);
      }
    }
  }, []);

  return {
    setupPusherSubscription,
    cleanup,
    currentChannel: pusherChannelRef.current
  };
};