'use client';

import { useState } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useDispatch } from 'react-redux';

export function useGitHubIntegration() {
  const { data: session, update: updateSession } = useSession();
  const dispatch = useDispatch();

  const [showGitHubTokenForm, setShowGitHubTokenForm] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [isLinkingGitHub, setIsLinkingGitHub] = useState(false);

  const linkGitHubAccount = async (accessToken, onSuccess) => {
    if (!session?.user?.id) {
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Please sign in first to link your GitHub account', type: 'error' },
      });
      return false;
    }

    if (!accessToken?.trim()) {
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Please enter a GitHub access token', type: 'error' },
      });
      return false;
    }

    setIsLinkingGitHub(true);

    try {
      const response = await fetch('/api/integrations/github/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accessToken: accessToken.trim() })
      });

      const result = await response.json();

      if (result.success) {
        // Execute success callback if provided
        if (onSuccess) {
          await onSuccess(result);
        }

        dispatch({
          type: 'ui/showToast',
          payload: { 
            message: `🎉 GitHub integration linked successfully! (${result.user.githubLogin})`, 
            type: 'success' 
          },
        });

        // Update session
        if (updateSession) {
          await updateSession({
            githubId: result.user.githubId,
            githubAccessToken: true
          });
        } else {
          await getSession();
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }

        // Reset form state
        setShowGitHubTokenForm(false);
        setGithubToken('');
        
        return true;
      } else {
        dispatch({
          type: 'ui/showToast',
          payload: { message: result.error || 'Failed to link GitHub integration', type: 'error' },
        });
        return false;
      }
    } catch (error) {
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Failed to connect GitHub integration', type: 'error' },
      });
      return false;
    } finally {
      setIsLinkingGitHub(false);
    }
  };

  const handleConnectGitHub = () => {
    if (!session?.user?.id) {
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Please sign in first to link your GitHub account', type: 'error' },
      });
      return;
    }
    
    setShowGitHubTokenForm(true);
  };

  const handleLinkGitHub = async (onSuccess) => {
    return await linkGitHubAccount(githubToken, onSuccess);
  };

  const handleCancelGitHubLink = () => {
    setShowGitHubTokenForm(false);
    setGithubToken('');
  };

  const unlinkGitHubAccount = async () => {
    try {
      const response = await fetch('/api/integrations/github/link', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        dispatch({
          type: 'ui/showToast',
          payload: { message: 'GitHub integration unlinked successfully!', type: 'success' },
        });

        // Update session
        if (updateSession) {
          await updateSession({
            githubId: null,
            githubAccessToken: null
          });
        } else {
          await getSession();
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }

        return true;
      } else {
        dispatch({
          type: 'ui/showToast',
          payload: { message: result.error || 'Failed to unlink GitHub integration', type: 'error' },
        });
        return false;
      }
    } catch (error) {
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Failed to unlink GitHub integration', type: 'error' },
      });
      return false;
    }
  };

  // Computed states
  const hasGitHubAccount = session?.user?.githubAccessToken && session?.user?.githubId;

  return {
    // State
    showGitHubTokenForm,
    githubToken,
    isLinkingGitHub,
    hasGitHubAccount,
    session,

    // Actions
    handleConnectGitHub,
    handleLinkGitHub,
    handleCancelGitHubLink,
    unlinkGitHubAccount,
    linkGitHubAccount,

    // Form helpers
    setGithubToken,
    setShowGitHubTokenForm,
  };
}