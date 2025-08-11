'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  PencilIcon, 
  EyeIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';

/**
 * BMAD Document Viewer Component
 * 
 * Displays generated BMAD documents inline with editing capabilities
 * Supports markdown rendering, validation feedback, and export options
 */
export default function BmadDocumentViewer({ 
  document, 
  onClose, 
  onSave, 
  onValidate,
  onExport,
  isOpen = false,
  mode = 'view' // 'view' | 'edit'
}) {
  const [viewMode, setViewMode] = useState(mode);
  const [content, setContent] = useState(document?.content || '');
  const [validationResults, setValidationResults] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (document?.content) {
      setContent(document.content);
      setHasUnsavedChanges(false);
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const handleContentChange = (newContent) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== document.content);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave?.(document.id, content);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const results = await onValidate?.(document.id, content);
      setValidationResults(results);
    } catch (error) {
      console.error('Failed to validate document:', error);
      setValidationResults({
        valid: false,
        errors: ['Validation failed: ' + error.message]
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleExport = async (format) => {
    try {
      await onExport?.(document.id, format);
    } catch (error) {
      console.error('Failed to export document:', error);
    }
  };

  const getDocumentTypeIcon = (type) => {
    switch (type) {
      case 'prd': return '📋';
      case 'architecture': return '🏗️';
      case 'story': return '📖';
      case 'analysis': return '📊';
      default: return '📄';
    }
  };

  const getDocumentTypeName = (type) => {
    switch (type) {
      case 'prd': return 'Product Requirements Document';
      case 'architecture': return 'System Architecture';
      case 'story': return 'User Story';
      case 'analysis': return 'Analysis Report';
      default: return 'Document';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="relative flex h-full">
        {/* Document Viewer Panel */}
        <div className="flex-1 flex flex-col bg-white shadow-xl">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">
                {getDocumentTypeIcon(document.type)}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {document.title}
                </h2>
                <p className="text-sm text-gray-500">
                  {getDocumentTypeName(document.type)} • {document.agent}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* View/Edit Toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('view')}
                  className={`px-3 py-1.5 text-sm font-medium flex items-center space-x-1 ${
                    viewMode === 'view'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <EyeIcon className="w-4 h-4" />
                  <span>View</span>
                </button>
                <button
                  onClick={() => setViewMode('edit')}
                  className={`px-3 py-1.5 text-sm font-medium flex items-center space-x-1 border-l ${
                    viewMode === 'edit'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleValidate}
                disabled={isValidating}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {isValidating ? 'Validating...' : 'Validate'}
              </button>
              
              {/* Export Dropdown */}
              <div className="relative">
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center space-x-1">
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>

              {hasUnsavedChanges && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Validation Results */}
          {validationResults && (
            <div className={`px-6 py-3 border-b ${
              validationResults.valid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {validationResults.valid ? (
                  <CheckIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  validationResults.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {validationResults.valid 
                    ? 'Document validation passed' 
                    : 'Document validation failed'
                  }
                </span>
              </div>
              {validationResults.errors && validationResults.errors.length > 0 && (
                <div className="mt-2">
                  {validationResults.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      • {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'view' ? (
              <div className="h-full overflow-y-auto p-6">
                <div className="prose prose-blue max-w-none">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="h-full flex">
                <div className="flex-1 p-4">
                  <textarea
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="w-full h-full resize-none border-none outline-none font-mono text-sm"
                    placeholder="Document content..."
                  />
                </div>
                <div className="w-1/2 border-l border-gray-200 p-4 overflow-y-auto">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Preview</h3>
                  <div className="prose prose-sm prose-blue max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                Generated by {document.agent} • 
                {document.metadata?.wordCount && (
                  <span className="ml-2">{document.metadata.wordCount} words</span>
                )}
              </div>
              <div>
                {document.metadata?.createdAt && (
                  <span>Created {new Date(document.metadata.createdAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}