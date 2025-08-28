'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

const FormattedAnalysisSummary = ({ summary, className = '', useMarkdown = true }) => {
  const { formattedSummary, hasStructure } = useMemo(() => {
    if (!summary) return { formattedSummary: '', hasStructure: false };
    
    // Check if the summary has structured content (numbered sections)
    const hasNumberedSections = /\d+\.\s*[^:]+:/.test(summary);
    
    if (useMarkdown) {
      // Convert the AI summary to better markdown format
      let markdown = summary;
      
      // Convert numbered sections to proper markdown headers
      markdown = markdown.replace(/(\d+)\.\s*([^:]+):/g, '\n## $1. $2\n\n');
      
      // Convert **text** to proper markdown bold
      markdown = markdown.replace(/\*\*([^*]+)\*\*/g, '**$1**');
      
      // Add line breaks for better paragraph separation
      markdown = markdown.replace(/\.\s+([A-Z])/g, '.\n\n$1');
      
      // Handle specific patterns from AI analysis
      markdown = markdown.replace(/(Brief Description|Key Technologies|Project Structure|Code Quality|Notable Patterns):/g, '\n### $1\n\n');
      
      // Clean up extra whitespace
      markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
      
      return { formattedSummary: markdown, hasStructure: hasNumberedSections };
    }
    
    return { formattedSummary: summary, hasStructure: hasNumberedSections };
  }, [summary, useMarkdown]);

  const customComponents = {
    h2: ({ children }) => (
      <div className="flex items-center space-x-3 mb-3 mt-6">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {children?.toString().match(/^\d+/)?.[0] || '#'}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {children?.toString().replace(/^\d+\.\s*/, '')}
        </h2>
      </div>
    ),
    
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-2 flex items-center">
        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
        {children}
      </h3>
    ),
    
    p: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
        {children}
      </p>
    ),
    
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900 dark:text-white">
        {children}
      </strong>
    ),
    
    ul: ({ children }) => (
      <ul className="list-disc list-inside space-y-1 mb-3 text-gray-700 dark:text-gray-300">
        {children}
      </ul>
    ),
    
    li: ({ children }) => (
      <li className="text-gray-700 dark:text-gray-300">
        {children}
      </li>
    ),
  };

  // Simple fallback renderer for structured text
  const renderSimpleFormat = (text) => {
    const sections = text.split(/(\d+\.\s*[^:]+:)/);
    let currentSection = null;
    
    return (
      <div className="space-y-4">
        {sections.map((part, index) => {
          const sectionMatch = part.match(/^(\d+)\.\s*([^:]+):/);
          
          if (sectionMatch) {
            const [, number, title] = sectionMatch;
            currentSection = { number, title };
            return (
              <div key={index} className="flex items-center space-x-3 mb-2 mt-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {number}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
              </div>
            );
          } else if (part.trim()) {
            return (
              <div key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed ml-11">
                {part.split(/(\*\*[^*]+\*\*)/).map((chunk, i) => 
                  chunk.startsWith('**') && chunk.endsWith('**') ? (
                    <strong key={i} className="font-semibold text-gray-900 dark:text-white">
                      {chunk.slice(2, -2)}
                    </strong>
                  ) : (
                    chunk
                  )
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  if (!summary) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No analysis summary available</p>
      </div>
    );
  }

  // Use markdown if enabled and structure is detected, otherwise use simple format
  if (useMarkdown && hasStructure) {
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        <ReactMarkdown components={customComponents}>
          {formattedSummary}
        </ReactMarkdown>
      </div>
    );
  } else if (hasStructure) {
    return (
      <div className={className}>
        {renderSimpleFormat(summary)}
      </div>
    );
  } else {
    // For unstructured text, just render with basic formatting
    return (
      <div className={`text-gray-700 dark:text-gray-300 leading-relaxed ${className}`}>
        {summary.split(/(\*\*[^*]+\*\*)/).map((part, i) => 
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={i} className="font-semibold text-gray-900 dark:text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          )
        )}
      </div>
    );
  }
};

export default FormattedAnalysisSummary;