'use client';

import React, { useState, useEffect } from 'react';
import { 
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertTriangle,
  Trash2,
  RefreshCw
} from 'lucide-react';

const ApiKeyInput = ({ 
  provider,
  initialValue = '',
  hasExistingKey = false,
  onSave,
  onClear,
  placeholder = '',
  className = ''
}) => {
  const [value, setValue] = useState(initialValue);
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'saved', 'error', 'cleared'

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = async () => {
    if (!value.trim()) {
      setStatus('error');
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      await onSave(provider, value.trim());
      setStatus('saved');
    } catch (error) {
      console.error(`Error saving ${provider} API key:`, error);
      setStatus('error');
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleClear = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      await onClear(provider);
      setValue('');
      setStatus('cleared');
    } catch (error) {
      console.error(`Error clearing ${provider} API key:`, error);
      setStatus('error');
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleInputChange = (e) => {
    setValue(e.target.value);
    if (status) setStatus(null);
  };

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  const hasChanges = value !== initialValue;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Input with integrated controls */}
      <div className="flex gap-2">
        {/* Input Field */}
        <div className="flex-1 relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-12"
          />
          
          {/* Show/Hide Toggle */}
          <button
            type="button"
            onClick={toggleShowKey}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showKey ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || !value.trim() || isLoading}
          className="inline-flex items-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[100px] justify-center"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </button>

        {/* Clear Button (only show if has existing key) */}
        {hasExistingKey && (
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Clear API key"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status Message */}
      {status && (
        <div className={`flex items-center space-x-2 text-sm ${
          status === 'saved' || status === 'cleared'
            ? 'text-green-700 dark:text-green-300' 
            : 'text-red-700 dark:text-red-300'
        }`}>
          {status === 'error' ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span>
            {status === 'saved' && `${provider} API key saved successfully!`}
            {status === 'cleared' && `${provider} API key cleared successfully!`}
            {status === 'error' && `Failed to update ${provider} API key. Please try again.`}
          </span>
        </div>
      )}
    </div>
  );
};

export default ApiKeyInput;