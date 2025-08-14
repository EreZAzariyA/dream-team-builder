'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useApiKeys() {
  const { data: session, status } = useSession();
  const [apiKeys, setApiKeys] = useState({
    hasOpenai: false,
    hasGemini: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchApiKeys = async () => {
      if (status === 'loading') return;
      
      if (status === 'unauthenticated' || !session?.user) {
        setApiKeys({
          hasOpenai: false,
          hasGemini: false,
          loading: false,
          error: 'Not authenticated'
        });
        return;
      }

      try {
        const response = await fetch('/api/user/api-keys');
        
        if (!response.ok) {
          throw new Error('Failed to fetch API keys');
        }

        const data = await response.json();
        
        setApiKeys({
          hasOpenai: data.apiKeys?.hasOpenai || false,
          hasGemini: data.apiKeys?.hasGemini || false,
          loading: false,
          error: null,
          updatedAt: data.apiKeys?.updatedAt
        });
      } catch (error) {
        console.error('Error fetching API keys:', error);
        setApiKeys({
          hasOpenai: false,
          hasGemini: false,
          loading: false,
          error: error.message
        });
      }
    };

    fetchApiKeys();
  }, [session, status]);

  const hasAnyKeys = apiKeys.hasOpenai || apiKeys.hasGemini;
  const missingProviders = [];
  
  if (!apiKeys.hasOpenai) missingProviders.push('openai');
  if (!apiKeys.hasGemini) missingProviders.push('gemini');

  const refetch = () => {
    setApiKeys(prev => ({ ...prev, loading: true }));
    // Trigger useEffect by creating a new session reference
    window.location.reload();
  };

  return {
    ...apiKeys,
    hasAnyKeys,
    missingProviders,
    refetch,
    isAuthenticated: status === 'authenticated'
  };
}