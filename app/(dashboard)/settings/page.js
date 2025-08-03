'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { Key, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import PasswordInput from '../../../components/ui/PasswordInput';

const SettingsPage = () => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const userRole = session?.user?.role || 'user';
  
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    gemini: ''
  });
  const [existingKeys, setExistingKeys] = useState({
    openai: false,
    gemini: false
  });
  const [existingKeyValues, setExistingKeyValues] = useState({
    openai: '',
    gemini: ''
  });
  const [saveStatus, setSaveStatus] = useState(null);

  const handleApiKeyChange = (provider, value) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value
    }));
  };

  const handleSaveApiKeys = async () => {
    try {
      // Only send keys that have actual values (user has entered something)
      const keysToSave = {};
      
      if (apiKeys.openai && apiKeys.openai.trim()) {
        keysToSave.openai = apiKeys.openai.trim();
      }
      
      if (apiKeys.gemini && apiKeys.gemini.trim()) {
        keysToSave.gemini = apiKeys.gemini.trim();
      }
      
      // Don't save if no keys provided
      if (!keysToSave.openai && !keysToSave.gemini) {
        setSaveStatus('error');
        console.error('Please enter at least one API key');
        return;
      }
      
      console.log('🔑 Saving keys:', { hasOpenai: !!keysToSave.openai, hasGemini: !!keysToSave.gemini });
      
      // Save to database
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKeys: keysToSave }),
      });

      if (response.ok) {
        const result = await response.json();
        setSaveStatus('saved');
        console.log('✅ API keys saved to database:', result.apiKeys);
        
        // Remove from localStorage - we only store in database now
        localStorage.removeItem('userApiKeys');
        
        // Reinitialize AI service with new keys
        const reinitResponse = await fetch('/api/ai/reinitialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKeys: keysToSave }),
        });

        if (reinitResponse.ok) {
          console.log('✅ AI service reinitialized with user API keys');
          
          // Invalidate AI health status cache to force refresh
          queryClient.invalidateQueries({ queryKey: ['ai-health-status'] });
        } else {
          console.error('Failed to reinitialize AI service');
        }
      } else {
        const error = await response.json();
        console.error('Failed to save API keys:', error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving API keys:', error);
      setSaveStatus('error');
    }
    
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const clearApiKeys = async () => {
    try {
      // Clear from database
      const response = await fetch('/api/user/api-keys', {
        method: 'DELETE',
      });

      if (response.ok) {
        setApiKeys({ openai: '', gemini: '' });
        localStorage.removeItem('userApiKeys');
        
        // Reinitialize AI service without user keys (fall back to environment keys)
        const reinitResponse = await fetch('/api/ai/reinitialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKeys: {} }),
        });

        setSaveStatus('cleared');
        console.log('✅ API keys cleared from database');
        
        if (reinitResponse.ok) {
          console.log('✅ AI service reset to environment keys');
          
          // Invalidate AI health status cache to force refresh
          queryClient.invalidateQueries({ queryKey: ['ai-health-status'] });
          
          // No need to trigger health check - will be done on-demand when AI is used
        } else {
          console.error('Failed to reset AI service to environment keys');
        }
      } else {
        const error = await response.json();
        console.error('Failed to clear API keys:', error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error clearing API keys:', error);
      setSaveStatus('error');
    }
    
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Load API key status on component mount
  useEffect(() => {
    const loadApiKeyStatus = async () => {
      try {
        const response = await fetch('/api/user/api-keys');
        if (response.ok) {
          const result = await response.json();
          // Track which keys exist
          setExistingKeys({
            openai: result.apiKeys.hasOpenai,
            gemini: result.apiKeys.hasGemini
          });
          
          // If keys exist, we need to load the actual values for display
          if (result.apiKeys.hasOpenai || result.apiKeys.hasGemini) {
            loadActualKeyValues();
          }
        }
      } catch (error) {
        console.error('Error loading API key status:', error);
      }
    };
    
    const loadActualKeyValues = async () => {
      try {
        const response = await fetch('/api/user/api-keys?includeValues=true');
        if (response.ok) {
          const result = await response.json();
          // Set the actual key values for display
          setExistingKeyValues({
            openai: result.apiKeys.openai || '',
            gemini: result.apiKeys.gemini || ''
          });
          
          // Also set them as the current apiKeys so they show in the inputs
          setApiKeys({
            openai: result.apiKeys.openai || '',
            gemini: result.apiKeys.gemini || ''
          });
        }
      } catch (error) {
        console.error('Error loading actual key values:', error);
      }
    };

    loadApiKeyStatus();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Manage your account and AI provider settings</p>

      {/* API Keys Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Key className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Provider API Keys</h2>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Why do I need to provide API keys?
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                The shared AI quotas have been exceeded. To continue using AI features, please provide your own API keys.
              </p>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">
                • Your keys are stored locally in your browser only
                • Each key gives you your own quota limits
                • Free tiers available for both providers
              </div>
            </div>
          </div>
        </div>

        {/* OpenAI API Key */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  OpenAI API Key
                </label>
                {existingKeys.openai && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    ✓ Configured
                  </span>
                )}
              </div>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <PasswordInput
              value={apiKeys.openai}
              onChange={(e) => handleApiKeyChange('openai', e.target.value)}
              placeholder="sk-proj-..."
            />
          </div>

          {/* Gemini API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Google Gemini API Key
                </label>
                {existingKeys.gemini && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    ✓ Configured
                  </span>
                )}
              </div>
              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <PasswordInput
              value={apiKeys.gemini}
              onChange={(e) => handleApiKeyChange('gemini', e.target.value)}
              placeholder="AIza..."
            />
          </div>
        </div>

        {/* Save Status */}
        {saveStatus && (
          <div className={`mt-4 p-3 rounded-lg flex items-center space-x-2 ${
            saveStatus === 'saved' ? 'bg-green-50 text-green-700' : 
            saveStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {saveStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span className="text-sm">
              {saveStatus === 'saved' ? 'API keys saved successfully!' : 
               saveStatus === 'error' ? 'Failed to save API keys. Please try again.' :
               'API keys cleared!'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={handleSaveApiKeys}
            disabled={!apiKeys.openai && !apiKeys.gemini}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save API Keys
          </button>
          <button
            onClick={clearApiKeys}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* User Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Account Information</h2>
        {userRole === 'admin' ? (
          <p className="text-blue-600 dark:text-blue-400">You are an Admin with additional privileges.</p>
        ) : (
          <p className="text-green-600 dark:text-green-400">You are a regular user.</p>
        )}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>Email: {session?.user?.email}</p>
          <p>Name: {session?.user?.name}</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;