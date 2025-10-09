'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../lib/react-query';
import { 
  X,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import BasicInformationSection from './template-creation/BasicInformationSection';
import WorkflowSequenceSection from './template-creation/WorkflowSequenceSection';
import DecisionGuidanceSection from './template-creation/DecisionGuidanceSection';
import TemplatePreview from './template-creation/TemplatePreview';

// Template creation function
async function createTemplate(templateData) {
  return await fetchWithAuth('/api/workflows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templateData),
  });
}

export default function CreateTemplateModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'greenfield',
    project_types: [],
    sequence: [],
    decision_guidance: {
      when_to_use: []
    },
    handoff_prompts: {}
  });

  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    sequence: true,
    guidance: false
  });

  const queryClient = useQueryClient();

  const createTemplateMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries(['db-templates']);
      onClose();
      resetForm();
    },
    onError: (error) => {
      console.error('Failed to create template:', error);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'greenfield',
      project_types: [],
      sequence: [],
      decision_guidance: {
        when_to_use: []
      },
      handoff_prompts: {}
    });
    setShowPreview(false);
  };

  const handleFormDataChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      alert('Template name is required');
      return;
    }
    
    if (formData.sequence.length === 0) {
      alert('At least one workflow step is required');
      return;
    }

    createTemplateMutation.mutate(formData);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Workflow Template
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Design a custom BMAD workflow template for your organization
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md flex items-center space-x-1"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Form */}
          <div className={`${showPreview ? 'w-1/2' : 'w-full'} p-6 overflow-y-auto`}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <BasicInformationSection
                formData={formData}
                onFormDataChange={handleFormDataChange}
                expanded={expandedSections.basic}
                onToggleExpanded={() => toggleSection('basic')}
              />

              {/* Workflow Sequence Section */}
              <WorkflowSequenceSection
                formData={formData}
                onFormDataChange={handleFormDataChange}
                expanded={expandedSections.sequence}
                onToggleExpanded={() => toggleSection('sequence')}
              />

              {/* Decision Guidance Section */}
              <DecisionGuidanceSection
                formData={formData}
                onFormDataChange={handleFormDataChange}
                expanded={expandedSections.guidance}
                onToggleExpanded={() => toggleSection('guidance')}
              />

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTemplateMutation.isLoading || !formData.name.trim() || formData.sequence.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {createTemplateMutation.isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{createTemplateMutation.isLoading ? 'Creating...' : 'Create Template'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Preview */}
          <TemplatePreview
            formData={formData}
            isVisible={showPreview}
          />
        </div>
      </div>
    </div>
  );
}