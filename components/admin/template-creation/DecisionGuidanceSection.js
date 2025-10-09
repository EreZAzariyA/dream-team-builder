'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import InfoTooltip from '../../common/InfoTooltip';

export default function DecisionGuidanceSection({ 
  formData, 
  onFormDataChange, 
  expanded, 
  onToggleExpanded 
}) {
  const [newGuidance, setNewGuidance] = useState('');

  const addGuidance = () => {
    if (newGuidance.trim()) {
      const currentGuidance = formData.decision_guidance?.when_to_use || [];
      onFormDataChange('decision_guidance', {
        ...formData.decision_guidance,
        when_to_use: [...currentGuidance, newGuidance.trim()]
      });
      setNewGuidance('');
    }
  };

  const removeGuidance = (index) => {
    const currentGuidance = formData.decision_guidance?.when_to_use || [];
    onFormDataChange('decision_guidance', {
      ...formData.decision_guidance,
      when_to_use: currentGuidance.filter((_, i) => i !== index)
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGuidance();
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
      >
        <h3 className="font-medium text-gray-900 dark:text-white">Decision Guidance</h3>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <span>When to Use This Template</span>
              <InfoTooltip 
                content="Define specific scenarios where this template should be used. This helps users choose the right template for their project. Examples: 'Building production-ready applications', 'Need comprehensive documentation', 'Multiple team members involved'" 
                placement="right"
              />
            </label>
            <div className="space-y-2 mb-2">
              {formData.decision_guidance?.when_to_use?.map((guidance, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{guidance}</span>
                  <button
                    type="button"
                    onClick={() => removeGuidance(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newGuidance}
                onChange={(e) => setNewGuidance(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Building production-ready applications"
                onKeyPress={handleKeyPress}
              />
              <button
                type="button"
                onClick={addGuidance}
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