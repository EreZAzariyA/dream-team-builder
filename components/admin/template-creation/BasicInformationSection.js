'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../../common/Badge';
import InfoTooltip from '../../common/InfoTooltip';

export default function BasicInformationSection({ 
  formData, 
  onFormDataChange, 
  expanded, 
  onToggleExpanded 
}) {
  const [newProjectType, setNewProjectType] = useState('');

  const handleInputChange = (field, value) => {
    onFormDataChange(field, value);
  };

  const addProjectType = () => {
    if (newProjectType.trim() && !formData.project_types.includes(newProjectType.trim())) {
      onFormDataChange('project_types', [...formData.project_types, newProjectType.trim()]);
      setNewProjectType('');
    }
  };

  const removeProjectType = (typeToRemove) => {
    onFormDataChange('project_types', formData.project_types.filter(type => type !== typeToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProjectType();
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
      >
        <h3 className="font-medium text-gray-900 dark:text-white">Basic Information</h3>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Template Name */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span>Template Name *</span>
              <InfoTooltip 
                content="Choose a descriptive name for your workflow template. This will help users identify when to use this template. Examples: 'E-commerce Development', 'API Service Creation', 'Mobile App Workflow'" 
                placement="right"
              />
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Custom E-commerce Workflow"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span>Description</span>
              <InfoTooltip 
                content="Provide a detailed description of what this workflow accomplishes, its scope, and key outcomes. This helps users understand the template's purpose and decide if it fits their needs." 
                placement="right"
              />
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Describe the purpose and scope of this workflow template..."
            />
          </div>

          {/* Workflow Type */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span>Workflow Type</span>
              <InfoTooltip 
                content={
                  <div>
                    <p className="font-semibold mb-2">Workflow Types:</p>
                    <ul className="space-y-1 text-xs">
                      <li><strong>Greenfield:</strong> New projects from scratch</li>
                      <li><strong>Brownfield:</strong> Modifying existing projects</li>
                      <li><strong>Maintenance:</strong> Bug fixes and updates</li>
                      <li><strong>Enhancement:</strong> Adding new features</li>
                    </ul>
                  </div>
                } 
                placement="right"
              />
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="greenfield">Greenfield (New Project)</option>
              <option value="brownfield">Brownfield (Existing Project)</option>
              <option value="maintenance">Maintenance</option>
              <option value="enhancement">Enhancement</option>
            </select>
          </div>

          {/* Project Types */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span>Project Types</span>
              <InfoTooltip 
                content="Specify which types of projects this workflow is suitable for. Examples: web-app, mobile-app, saas, api-service, microservice, e-commerce, enterprise-app, prototype, mvp. This helps users filter templates." 
                placement="right"
              />
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.project_types.map((type, index) => (
                <Badge key={index} className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {type}
                  <button
                    type="button"
                    onClick={() => removeProjectType(type)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="e.g., web-app, saas, mobile-app"
                onKeyPress={handleKeyPress}
              />
              <button
                type="button"
                onClick={addProjectType}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}