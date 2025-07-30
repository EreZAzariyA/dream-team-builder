
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

export default function WorkflowTemplateManager({
  onSelectTemplate = () => {},
  initialSelectedTemplateId = null,
}) {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null or template object
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    sequence: [],
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialSelectedTemplateId);

  // Fetch available agents for sequence building
  const { data: agentsData, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['bmad-agents'],
    queryFn: async () => {
      const response = await fetch('/api/bmad/agents');
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    },
  });

  // Fetch workflow templates
  const { data: templatesData, isLoading: isLoadingTemplates, error } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const response = await fetch('/api/workflow-templates');
      if (!response.ok) throw new Error('Failed to fetch workflow templates');
      return response.json();
    },
  });

  // Mutations for creating, updating, and deleting templates
  const createTemplateMutation = useMutation({
    mutationFn: async (newTemplate) => {
      const response = await fetch('/api/workflow-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-templates']);
      setIsCreating(false);
      setFormState({ name: '', description: '', sequence: [] });
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Template created successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (updatedTemplate) => {
      const response = await fetch(
        `/api/workflow-templates/${updatedTemplate._id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTemplate),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-templates']);
      setEditingTemplate(null);
      setFormState({ name: '', description: '', sequence: [] });
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Template updated successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId) => {
      const response = await fetch(`/api/workflow-templates/${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workflow-templates']);
      dispatch({
        type: 'ui/showToast',
        payload: { message: 'Template deleted successfully!', type: 'success' },
      });
    },
    onError: (err) => {
      dispatch({
        type: 'ui/showToast',
        payload: { message: err.message, type: 'error' },
      });
    },
  });

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSequenceChange = (index, field, value) => {
    const newSequence = [...formState.sequence];
    newSequence[index] = { ...newSequence[index], [field]: value };
    setFormState((prev) => ({
      ...prev,
      sequence: newSequence,
    }));
  };

  const addAgentToSequence = () => {
    setFormState((prev) => ({
      ...prev,
      sequence: [...prev.sequence, { agentId: '', role: '', description: '' }],
    }));
  };

  const removeAgentFromSequence = (index) => {
    const newSequence = formState.sequence.filter((_, i) => i !== index);
    setFormState((prev) => ({
      ...prev,
      sequence: newSequence,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplateMutation.mutate({ ...formState, _id: editingTemplate._id });
    } else {
      createTemplateMutation.mutate(formState);
    }
  };

  const startEdit = (template) => {
    setEditingTemplate(template);
    setFormState({
      name: template.name,
      description: template.description,
      sequence: template.sequence,
    });
    setIsCreating(true);
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setEditingTemplate(null);
    setFormState({ name: '', description: '', sequence: [] });
  };

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    const selectedTemplate = templatesData?.data.find(t => t._id === templateId);
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
    }
  };

  if (isLoadingTemplates || isLoadingAgents) {
    return <div className="p-4 text-center">Loading workflow templates...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error.message}</div>;
  }

  const templates = templatesData?.data || [];
  const availableAgents = agentsData?.agents || [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
        Workflow Templates
      </h2>

      {!isCreating && (
        <div className="mb-6">
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create New Template
          </button>
        </div>
      )}

      {isCreating && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Template Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formState.name}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formState.description}
                onChange={handleFormChange}
                rows="3"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
              ></textarea>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Agent Sequence</h4>
              {formState.sequence.map((agentStep, index) => (
                <div key={index} className="flex items-end space-x-2 mb-3 p-2 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex-1">
                    <label htmlFor={`agent-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Agent
                    </label>
                    <select
                      id={`agent-${index}`}
                      value={agentStep.agentId}
                      onChange={(e) => handleSequenceChange(index, 'agentId', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                      required
                    >
                      <option value="">Select Agent</option>
                      {availableAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.title})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label htmlFor={`role-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Role
                    </label>
                    <input
                      type="text"
                      id={`role-${index}`}
                      value={agentStep.role}
                      onChange={(e) => handleSequenceChange(index, 'role', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor={`desc-${index}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <input
                      type="text"
                      id={`desc-${index}`}
                      value={agentStep.description}
                      onChange={(e) => handleSequenceChange(index, 'description', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAgentFromSequence(index)}
                    className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAgentToSequence}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add Agent to Sequence
              </button>
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editingTemplate ? 'Update Template' : 'Save Template'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Existing Templates</h3>
      {templates.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No templates created yet.</p>
      ) : (
        <ul className="space-y-4">
          {templates.map((template) => (
            <li
              key={template._id}
              className={`p-4 border rounded-lg flex justify-between items-center ${selectedTemplateId === template._id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'}`}
            >
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {template.sequence.length} agents in sequence
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSelectTemplate(template._id)}
                  className={`px-3 py-1 rounded-md text-sm ${selectedTemplateId === template._id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500'}`}
                >
                  {selectedTemplateId === template._id ? 'Selected' : 'Select'}
                </button>
                <button
                  onClick={() => startEdit(template)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTemplateMutation.mutate(template._id)}
                  disabled={deleteTemplateMutation.isPending}
                  className="px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
