/**
 * Simple Pusher Client - Direct Implementation
 * Fixed version that should work immediately
 */

'use client';

import { useEffect, useState } from 'react';
import PusherJS from 'pusher-js';

// Create a single Pusher instance
let pusherInstance = null;

function getPusherInstance() {
  if (!pusherInstance && typeof window !== 'undefined') {
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
      console.warn('NEXT_PUBLIC_PUSHER_KEY not configured. Pusher connection will fail.');
      return null;
    }
    
    pusherInstance = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
      forceTLS: true,
    });
  }
  
  return pusherInstance;
}

export function usePusherSimple() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const pusher = getPusherInstance();
    if (!pusher) return;

    setConnecting(true);

    const handleConnected = () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
    };

    const handleDisconnected = () => {
      setConnected(false);
      setConnecting(false);
    };

    const handleError = (err) => {
      setError(err);
      setConnecting(false);
    };

    const handleStateChange = (states) => {
      if (states.current === 'connecting') {
        setConnecting(true);
      }
    };

    // Bind events
    pusher.connection.bind('connected', handleConnected);
    pusher.connection.bind('disconnected', handleDisconnected);
    pusher.connection.bind('error', handleError);
    pusher.connection.bind('state_change', handleStateChange);

    // Check current state
    if (pusher.connection.state === 'connected') {
      handleConnected();
    }

    return () => {
      pusher.connection.unbind('connected', handleConnected);
      pusher.connection.unbind('disconnected', handleDisconnected);
      pusher.connection.unbind('error', handleError);
      pusher.connection.unbind('state_change', handleStateChange);
    };
  }, []);

  const subscribeToWorkflow = (workflowId) => {
    const pusher = getPusherInstance();
    if (pusher && connected) {
      const channelName = `workflow-${workflowId}`;
      const channel = pusher.subscribe(channelName);
      return channel;
    }
    return null;
  };

  const sendMessage = async (content, target) => {
    try {
      const response = await fetch('/api/pusher/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, target, userId: 'user-1' }),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  return {
    connected,
    connecting,
    error,
    subscribeToWorkflow,
    sendMessage,
    pusher: getPusherInstance()
  };
}

export default usePusherSimple;