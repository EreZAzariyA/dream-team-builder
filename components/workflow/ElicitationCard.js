'use client';

import React, { memo, useMemo } from 'react';
import { Badge } from '../common/Badge';
import { Bot, Clock, User, MessageSquare, CheckCircle } from 'lucide-react';
import MarkdownIt from 'markdown-it';

const ElicitationCard = memo(({ 
  elicitationPrompt
}) => {
  // Initialize markdown-it
  const md = useMemo(() => new MarkdownIt({
    html: false,        // Disable HTML tags for security
    xhtmlOut: false,    // Use HTML5
    breaks: true,       // Convert '\n' in paragraphs into <br>
    linkify: true,      // Auto-detect and link URLs
    typographer: true   // Enable smart quotes and other typographic replacements
  }), []);

  if (!elicitationPrompt) {
    return null;
  }

  return (
    <div className="mb-6 flex justify-center">
      <div className="w-full max-w-4xl">
        {/* Elicitation Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {elicitationPrompt?.agentId?.charAt(0).toUpperCase() + elicitationPrompt?.agentId?.slice(1) || 'Agent'} needs your input
                </h3>
                <p className="text-blue-100 text-sm">
                  {elicitationPrompt?.sectionTitle || 'Additional Information Required'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-white/30">
                <Clock className="w-3 h-3 mr-1" />
                Workflow Paused
              </Badge>
            </div>
          </div>
        </div>

        {/* Elicitation Content */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-0 p-6">
          <div className="mb-6">
            <div className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-headings:mb-3
              prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
              prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-semibold
              prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ul:mb-4
              prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-ol:mb-4  
              prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:mb-1
              prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 
              prose-blockquote:text-blue-800 dark:prose-blockquote:text-blue-200 prose-blockquote:py-3 prose-blockquote:px-4
              prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 
              prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm"
              dangerouslySetInnerHTML={{ 
                __html: md.render(elicitationPrompt?.instruction || 'Please provide additional information to continue.') 
              }}
            />
          </div>

          {elicitationPrompt?.options && elicitationPrompt.options.length > 0 && (
            <div className="mb-6">
              <h5 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Options:</h5>
              <ul className="list-none p-0 m-0">
                {elicitationPrompt.options.map(option => (
                  <li key={option.number} className="mb-1 text-gray-700 dark:text-gray-300">
                    <strong>{option.number}.</strong> {option.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Response Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Your Response
              </h4>
            </div>
            
            <div className="text-center py-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Ready for your response
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Use the chat input below to provide your detailed response to continue the workflow
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Context Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-xl p-3">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <CheckCircle className="w-3 h-3" />
            <span>Once you submit your response, the workflow will continue automatically</span>
          </div>
        </div>
      </div>
    </div>
  );
});

ElicitationCard.displayName = 'ElicitationCard';

export default ElicitationCard;