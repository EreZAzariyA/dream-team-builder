'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

export default function InfoTooltip({ content, placement = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs";
    
    switch (placement) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const baseArrowClasses = "absolute w-2 h-2 bg-gray-900 transform rotate-45";
    
    switch (placement) {
      case 'top':
        return `${baseArrowClasses} top-full left-1/2 -translate-x-1/2 -mt-1`;
      case 'bottom':
        return `${baseArrowClasses} bottom-full left-1/2 -translate-x-1/2 -mb-1`;
      case 'left':
        return `${baseArrowClasses} left-full top-1/2 -translate-y-1/2 -ml-1`;
      case 'right':
        return `${baseArrowClasses} right-full top-1/2 -translate-y-1/2 -mr-1`;
      default:
        return `${baseArrowClasses} top-full left-1/2 -translate-x-1/2 -mt-1`;
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <Info 
        className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help transition-colors" 
      />
      
      {isVisible && (
        <div className={getTooltipClasses()}>
          <div className={getArrowClasses()}></div>
          <div className="relative z-10">
            {typeof content === 'string' ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              content
            )}
          </div>
        </div>
      )}
    </div>
  );
}