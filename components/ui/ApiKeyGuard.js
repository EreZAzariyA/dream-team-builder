'use client';

import React, { useState } from 'react';
import { Key, ExternalLink, Shield, Zap, Brain, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ApiKeyGuard = ({ 
  title = "API Keys Required",
  subtitle = "Connect your AI providers to start chatting with agents",
  missingProviders = [],
  showLearnMore = true,
  className = "max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6"
}) => {
  const router = useRouter();
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const handleAddApiKeys = () => {
    router.push('/settings?tab=api-keys');
  };

  const providers = [
    {
      name: 'OpenAI',
      icon: <Brain className="w-5 h-5" />,
      description: 'GPT-4, GPT-3.5 models for advanced reasoning',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900',
      required: missingProviders.includes('openai')
    },
    {
      name: 'Google AI',
      icon: <Zap className="w-5 h-5" />,
      description: 'Gemini models for multimodal AI capabilities',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      required: missingProviders.includes('gemini')
    }
  ];

  const requiredProviders = providers.filter(p => p.required);
  const hasSpecificMissing = requiredProviders.length > 0;

  if (showSetupGuide) {
    return (
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            API Key Setup Guide
          </h3>
          <button
            onClick={() => setShowSetupGuide(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-800 dark:text-blue-200">Security First</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Your API keys are encrypted and stored securely. We never share them with third parties.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                1. Get OpenAI API Key
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Visit OpenAI Platform and create an API key for GPT models.
              </p>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Get OpenAI API Key
              </a>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                2. Get Google AI API Key
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Visit Google AI Studio and generate an API key for Gemini models.
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Get Google AI API Key
              </a>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                3. Add Keys to Dream Team
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Navigate to your settings page and securely store your API keys.
              </p>
              <button
                onClick={handleAddApiKeys}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Key className="w-4 h-4 mr-2" />
                Add API Keys Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} text-center`}>
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
        <Key className="w-8 h-8 text-white" />
      </div>

      {/* Title & Subtitle */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        {subtitle}
      </p>

      {/* Missing Providers */}
      {hasSpecificMissing && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Missing providers:
          </p>
          <div className="space-y-2">
            {requiredProviders.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className={`w-8 h-8 ${provider.bgColor} rounded-lg flex items-center justify-center`}>
                  <span className={provider.color}>{provider.icon}</span>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {provider.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {provider.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Providers */}
      {!hasSpecificMissing && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Supported AI providers:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {providers.map((provider) => (
              <div
                key={provider.name}
                className="flex flex-col items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className={`w-10 h-10 ${provider.bgColor} rounded-lg flex items-center justify-center mb-2`}>
                  <span className={provider.color}>{provider.icon}</span>
                </div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  {provider.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleAddApiKeys}
          className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Key className="w-5 h-5 mr-2" />
          Add API Keys
        </button>

        {showLearnMore && (
          <button
            onClick={() => setShowSetupGuide(true)}
            className="w-full inline-flex items-center justify-center px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Setup Guide
          </button>
        )}
      </div>

      {/* Security Note */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <Shield className="w-3 h-3" />
          <span>Your keys are encrypted and secure</span>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyGuard;