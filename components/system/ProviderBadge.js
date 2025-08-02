/**
 * Provider Badge Component
 * Small badge to show which AI provider generated a response
 */

'use client';

import React from 'react';
import { Brain, Zap, Shield } from 'lucide-react';

const ProviderBadge = ({ provider, usage, size = 'small', showUsage = false, className = '' }) => {
  const providerConfig = {
    gemini: {
      name: 'Gemini',
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    openai: {
      name: 'OpenAI',
      icon: Brain,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    anthropic: {
      name: 'Claude',
      icon: Shield,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    fallback: {
      name: 'Fallback',
      icon: Shield,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    }
  };

  const config = providerConfig[provider] || providerConfig.fallback;
  const Icon = config.icon;

  const sizeClasses = {
    small: 'text-xs px-2 py-0.5',
    medium: 'text-sm px-2 py-1',
    large: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5'
  };

  return (
    <div className={`
      inline-flex items-center space-x-1 rounded-full border
      ${config.bgColor} ${config.borderColor} ${config.color}
      ${sizeClasses[size]} ${className}
    `}>
      <Icon className={iconSizes[size]} />
      <span className="font-medium">{config.name}</span>
      
      {showUsage && usage && (
        <span className="text-xs opacity-75">
          ({usage.tokens}t, ${usage.cost?.toFixed(3) || '0.000'})
        </span>
      )}
    </div>
  );
};

export default ProviderBadge;