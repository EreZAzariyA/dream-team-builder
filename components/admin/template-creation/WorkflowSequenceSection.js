'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '../../common/Badge';
import InfoTooltip from '../../common/InfoTooltip';
import { fetchWithAuth } from '../../../lib/react-query';

export default function WorkflowSequenceSection({ 
  formData, 
  onFormDataChange, 
  expanded, 
  onToggleExpanded 
}) {
  const [currentStep, setCurrentStep] = useState({
    agent: '',
    action: '',
    creates: '',
    requires: [],
    notes: '',
    optional: false,
    condition: ''
  });
  
  const [availableAgents, setAvailableAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Load agents from database API
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoadingAgents(true);
        // Fetch only active agents for user-facing interfaces
        const response = await fetchWithAuth('/api/bmad/agents?onlyActive=true');
        if (response.success && response.agents) {
          // Extract agent IDs for the dropdown, sorted by category and name
          const agentIds = response.agents
            .filter(agent => agent.isActive) // Extra safety check
            .sort((a, b) => {
              // Sort by category first (core agents first), then by name
              if (a.isSystemAgent && !b.isSystemAgent) return -1;
              if (!a.isSystemAgent && b.isSystemAgent) return 1;
              return a.name.localeCompare(b.name);
            })
            .map(agent => agent.id);
          
          setAvailableAgents(agentIds);
        } else {
          // Fallback to default agents if API fails
          console.warn('Failed to load agents from database, using fallback');
          setAvailableAgents(['analyst', 'pm', 'architect', 'ux-expert', 'dev', 'qa', 'sm', 'po']);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
        // Fallback to default agents
        setAvailableAgents(['analyst', 'pm', 'architect', 'ux-expert', 'dev', 'qa', 'sm', 'po']);
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, []);

  const handleStepChange = (field, value) => {
    setCurrentStep(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addStep = () => {
    if (currentStep.agent && (currentStep.action || currentStep.creates)) {
      const newStep = { ...currentStep };
      
      // Clean up empty fields
      if (!newStep.creates) delete newStep.creates;
      if (!newStep.action) delete newStep.action;
      if (newStep.requires.length === 0) delete newStep.requires;
      if (!newStep.notes) delete newStep.notes;
      if (!newStep.condition) delete newStep.condition;
      if (!newStep.optional) delete newStep.optional;

      onFormDataChange('sequence', [...formData.sequence, newStep]);

      // Reset current step
      setCurrentStep({
        agent: '',
        action: '',
        creates: '',
        requires: [],
        notes: '',
        optional: false,
        condition: ''
      });
    }
  };

  const removeStep = (index) => {
    onFormDataChange('sequence', formData.sequence.filter((_, i) => i !== index));
  };

  const moveStep = (index, direction) => {
    const newSequence = [...formData.sequence];
    if (direction === 'up' && index > 0) {
      [newSequence[index], newSequence[index - 1]] = [newSequence[index - 1], newSequence[index]];
    } else if (direction === 'down' && index < newSequence.length - 1) {
      [newSequence[index], newSequence[index + 1]] = [newSequence[index + 1], newSequence[index]];
    }
    onFormDataChange('sequence', newSequence);
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
      >
        <h3 className="font-medium text-gray-900 dark:text-white">
          Workflow Sequence ({formData.sequence.length} steps)
        </h3>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Add Step Form */}
          <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Add Workflow Step</h4>
              <InfoTooltip 
                content="Define the sequence of agent interactions in your workflow. Each step should specify which agent performs the action and what they create or accomplish." 
                placement="right"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agent Selection */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span>Agent *</span>
                  <InfoTooltip 
                    content={
                      <div>
                        <p className="font-semibold mb-2">BMAD Agents:</p>
                        {availableAgents.length > 0 ? (
                          <ul className="space-y-1 text-xs">
                            {availableAgents.map(agent => (
                              <li key={agent}><strong>{agent}:</strong> BMAD agent for {agent} tasks</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs">Loading available agents...</p>
                        )}
                      </div>
                    } 
                    placement="right"
                  />
                </label>
                <select
                  value={currentStep.agent}
                  onChange={(e) => handleStepChange('agent', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  disabled={loadingAgents}
                >
                  <option value="">{loadingAgents ? 'Loading agents...' : 'Select agent...'}</option>
                  {availableAgents.map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </div>

              {/* Action/Creates */}
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span>Action/Creates</span>
                  <InfoTooltip 
                    content="Specify what the agent does (action) or what they create (creates). Actions: validate_artifacts, review_code, create_story. Creates: prd.md, architecture.md, story.md, front-end-spec.md" 
                    placement="right"
                  />
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentStep.action}
                    onChange={(e) => handleStepChange('action', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Action (e.g., validate_artifacts)"
                  />
                  <input
                    type="text"
                    value={currentStep.creates}
                    onChange={(e) => handleStepChange('creates', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Creates (e.g., prd.md)"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span>Notes</span>
                  <InfoTooltip 
                    content="Provide detailed instructions for this step. Include any specific requirements, dependencies, or important context the agent needs to know." 
                    placement="right"
                  />
                </label>
                <textarea
                  value={currentStep.notes}
                  onChange={(e) => handleStepChange('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Step instructions or notes..."
                />
              </div>

              {/* Optional and Condition */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={currentStep.optional}
                    onChange={(e) => handleStepChange('optional', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Optional step</span>
                  <InfoTooltip 
                    content="Mark this step as optional if it can be skipped based on user preference or project requirements. Optional steps are often used for additional reviews or enhancements." 
                    placement="right"
                  />
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span>Condition</span>
                  <InfoTooltip 
                    content="Specify when this step should be executed. Examples: user_wants_review, complex_project, has_ui_requirements. Leave empty if step should always execute." 
                    placement="right"
                  />
                </label>
                <input
                  type="text"
                  value={currentStep.condition}
                  onChange={(e) => handleStepChange('condition', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Condition (e.g., user_wants_review)"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addStep}
              disabled={!currentStep.agent || (!currentStep.action && !currentStep.creates)}
              className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Step</span>
            </button>
          </div>

          {/* Existing Steps */}
          {formData.sequence.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white">Workflow Steps</h4>
              {formData.sequence.map((step, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      <span className="text-blue-600">@{step.agent}</span>
                      {step.creates && <span className="ml-2">creates: {step.creates}</span>}
                      {step.action && <span className="ml-2">action: {step.action}</span>}
                      {step.optional && <Badge className="ml-2 bg-yellow-100 text-yellow-800 text-xs">optional</Badge>}
                    </div>
                    {step.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {step.notes}
                      </p>
                    )}
                    {step.condition && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Condition: {step.condition}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === formData.sequence.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}