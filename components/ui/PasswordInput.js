'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * A reusable password input component with eye toggle functionality
 * Based on Ant Design's Password component patterns
 */
const PasswordInput = ({
  value = '',
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  const toggleVisibility = () => {
    if (disabled) return;
    setVisible(prev => !prev);
  };

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
          disabled ? 'bg-gray-50 dark:bg-gray-600 cursor-not-allowed' : ''
        } ${className}`}
        {...props}
      />
      
      {/* Eye toggle button */}
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={disabled}
        className={`absolute inset-y-0 right-0 pr-3 flex items-center transition-opacity ${
          disabled 
            ? 'opacity-40 cursor-not-allowed' 
            : 'hover:opacity-70 cursor-pointer'
        }`}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <EyeOff className="w-4 h-4 text-gray-400" />
        ) : (
          <Eye className="w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );
};

export default PasswordInput;