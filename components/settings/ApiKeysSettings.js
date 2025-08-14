'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Key, 
  ExternalLink, 
  Shield,
  Zap,
  Brain,
  Plus
} from 'lucide-react';
import ApiKeyInput from './ApiKeyInput';

const ApiKeysSettings = () => {
  const queryClient = useQueryClient();
  
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    gemini: ''
  });
  
  const [existingKeys, setExistingKeys] = useState({
    openai: false,
    gemini: false
  });


  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT-4, GPT-3.5 models for advanced reasoning and text generation',
      icon: <Brain className="w-6 h-6" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900',
      borderColor: 'border-green-200 dark:border-green-800',
      placeholder: 'sk-proj-...',
      getKeyUrl: 'https://platform.openai.com/api-keys',
      docsUrl: 'https://platform.openai.com/docs/quickstart',
      features: ['GPT-4 Turbo', 'GPT-3.5', 'Code Generation', 'Text Analysis']
    },
    {
      id: 'gemini',
      name: 'Google AI',
      description: 'Gemini models for multimodal AI capabilities and fast inference',
      icon: <Zap className="w-6 h-6" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      borderColor: 'border-blue-200 dark:border-blue-800',
      placeholder: 'AIza...',
      getKeyUrl: 'https://aistudio.google.com/app/apikey',
      docsUrl: 'https://ai.google.dev/docs',
      features: ['Gemini Pro', 'Vision Analysis', 'Fast Responses', 'Multimodal']
    }
  ];

  // Individual API key save handler
  const handleSaveApiKey = async (provider, apiKey) => {
    const response = await fetch('/api/user/api-keys', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        provider, 
        apiKey,
        action: 'save'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save API key');
    }

    // Update local state
    setApiKeys(prev => ({
      ...prev,
      [provider]: apiKey
    }));
    
    setExistingKeys(prev => ({
      ...prev,
      [provider]: true
    }));

    // Invalidate AI health status
    queryClient.invalidateQueries({ queryKey: ['ai-health-status'] });
    
    return response.json();
  };

  // Individual API key clear handler
  const handleClearApiKey = async (provider) => {
    const response = await fetch('/api/user/api-keys', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        provider,
        action: 'clear'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clear API key');
    }

    // Update local state
    setApiKeys(prev => ({
      ...prev,
      [provider]: ''
    }));
    
    setExistingKeys(prev => ({
      ...prev,
      [provider]: false
    }));

    // Invalidate AI health status
    queryClient.invalidateQueries({ queryKey: ['ai-health-status'] });
    
    return response.json();
  };


  // Load API key status on component mount
  useEffect(() => {
    const loadApiKeyStatus = async () => {
      try {
        const response = await fetch('/api/user/api-keys');
        if (response.ok) {
          const result = await response.json();
          setExistingKeys({
            openai: result.apiKeys.hasOpenai,
            gemini: result.apiKeys.hasGemini
          });
          
          if (result.apiKeys.hasOpenai || result.apiKeys.hasGemini) {
            const valueResponse = await fetch('/api/user/api-keys?includeValues=true');
            if (valueResponse.ok) {
              const valueResult = await valueResponse.json();
              setApiKeys({
                openai: valueResult.apiKeys.openai || '',
                gemini: valueResult.apiKeys.gemini || ''
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading API key status:', error);
      }
    };

    loadApiKeyStatus();
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Provider API Keys
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Connect your AI providers to unlock advanced features
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Your API keys are secure
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                All keys are encrypted and stored securely in our database. We never share them with third parties.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid gap-6 mb-8">
        {providers.map((provider) => {
          const hasKey = existingKeys[provider.id];
          const currentValue = apiKeys[provider.id];
          
          return (
            <div
              key={provider.id}
              className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                hasKey 
                  ? `${provider.borderColor} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50` 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {/* Provider Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 ${provider.bgColor} rounded-xl flex items-center justify-center`}>
                    <span className={provider.color}>{provider.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {provider.name}
                      </h3>
                      {hasKey && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded-full">
                          ✓ Connected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {provider.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {provider.features.map((feature) => (
                        <span
                          key={feature}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <a
                    href={provider.getKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Get Key
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>

              {/* Individual API Key Input Component */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  API Key
                </label>
                <ApiKeyInput
                  provider={provider.id}
                  initialValue={currentValue}
                  hasExistingKey={hasKey}
                  onSave={handleSaveApiKey}
                  onClear={handleClearApiKey}
                  placeholder={provider.placeholder}
                />
              </div>
            </div>
          );
        })}
      </div>


      {/* Help Section */}
      <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Need Help?
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {providers.map((provider) => (
            <a
              key={`docs-${provider.id}`}
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className={provider.color}>{provider.icon}</span>
              <div className="ml-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  {provider.name} Documentation
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Setup guides and API reference
                </div>
              </div>
              <ExternalLink className="w-4 h-4 ml-auto text-gray-400" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApiKeysSettings;