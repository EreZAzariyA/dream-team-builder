'use client';

import { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  PlusIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  LockClosedIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const TEMPLATE_OPTIONS = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Empty repository with README',
    icon: CodeBracketIcon
  },
  {
    id: 'fullstack',
    name: 'Full-Stack',
    description: 'Next.js with API routes and database setup',
    icon: CodeBracketIcon
  },
  {
    id: 'api',
    name: 'API Only',
    description: 'Node.js/Express API with database models',
    icon: CodeBracketIcon
  },
  {
    id: 'frontend',
    name: 'Frontend',
    description: 'React/Next.js frontend application',
    icon: CodeBracketIcon
  }
];

// Helper function to generate alternative repository names
function generateNameSuggestions(baseName) {
  const currentYear = new Date().getFullYear();
  const suggestions = [
    `${baseName}-v2`,
    `${baseName}-${currentYear}`,
    `${baseName}-project`,
    `my-${baseName}`
  ];
  
  return suggestions.slice(0, 3); // Return top 3 suggestions
}

export default function CreateRepositoryModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    private: false,
    template: 'basic',
    initialize_with_bmad: true
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  // Validate repository name
  const validateRepositoryName = (name) => {
    if (!name) return null;
    
    // GitHub repository name rules
    if (name.length > 100) return 'Repository name must be 100 characters or less';
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) return 'Repository name can only contain letters, numbers, periods, hyphens, and underscores';
    if (name.startsWith('.') || name.startsWith('-')) return 'Repository name cannot start with a period or hyphen';
    if (name.endsWith('.') || name.endsWith('-')) return 'Repository name cannot end with a period or hyphen';
    
    return null;
  };

  const nameValidationError = validateRepositoryName(formData.name);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/github/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific GitHub API errors with user-friendly messages
        let errorMessage = result.error || 'Failed to create repository';
        
        if (result.message && result.message.includes('name already exists')) {
          const suggestions = generateNameSuggestions(formData.name);
          errorMessage = `Repository name "${formData.name}" already exists on your GitHub account. Try: ${suggestions.join(', ')}`;
        } else if (result.message && result.message.includes('rate limit')) {
          errorMessage = 'GitHub API rate limit exceeded. Please try again in a few minutes.';
        } else if (result.message && result.message.includes('authentication')) {
          errorMessage = 'GitHub authentication failed. Please sign in again.';
        }
        
        throw new Error(errorMessage);
      }
      
      // Call success callback with the new repository data
      onSuccess && onSuccess(result.repository);
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        private: false,
        template: 'basic',
        initialize_with_bmad: true
      });
      onClose();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setError(null);
      onClose();
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isCreating) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isCreating]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-auto transform transition-all p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <PlusIcon className="h-6 w-6 text-green-600" />
                    <h2 className="text-lg font-medium text-gray-900">
                      Create New Repository
                    </h2>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isCreating}
                    className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Repository Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Repository Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:border-transparent ${
                        nameValidationError 
                          ? 'border-red-300 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="my-awesome-project"
                      required
                      disabled={isCreating}
                    />
                    {nameValidationError ? (
                      <p className="mt-1 text-xs text-red-600">
                        {nameValidationError}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">
                        Use letters, numbers, periods, hyphens, and underscores
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="A brief description of your project..."
                      disabled={isCreating}
                    />
                  </div>

                  {/* Template Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Template
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TEMPLATE_OPTIONS.map((template) => (
                        <label
                          key={template.id}
                          className={`relative flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                            formData.template === template.id
                              ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50'
                              : 'border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="template"
                            value={template.id}
                            checked={formData.template === template.id}
                            onChange={handleInputChange}
                            className="sr-only"
                            disabled={isCreating}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <template.icon className="h-4 w-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {template.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {template.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Privacy Setting */}
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="private"
                        checked={formData.private}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={isCreating}
                      />
                      <div className="flex items-center space-x-1">
                        <LockClosedIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Make repository private</span>
                      </div>
                    </label>
                    <p className="ml-6 text-xs text-gray-500">
                      Private repositories are only visible to you and collaborators
                    </p>
                  </div>

                  {/* BMAD Integration */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <label className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        name="initialize_with_bmad"
                        checked={formData.initialize_with_bmad}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                        disabled={isCreating}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-1">
                          <InformationCircleIcon className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-900">
                            Initialize with BMAD workflows
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 mt-1">
                          Add BMAD configuration files for AI-powered development workflows
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isCreating}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating || !formData.name.trim() || nameValidationError}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isCreating ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-4 w-4" />
                          <span>Create Repository</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
        </div>
      </div>
    </div>
  );
}