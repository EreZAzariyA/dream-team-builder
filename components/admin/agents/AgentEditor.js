'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle,
  FileText,
  Code
} from 'lucide-react';
import yaml from 'js-yaml';

export default function AgentEditor({ agent, isCreating, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    title: '',
    icon: '🤖',
    whenToUse: '',
    persona: {
      role: '',
      style: '',
      identity: '',
      focus: '',
      core_principles: []
    },
    commands: [],
    dependencies: {
      tasks: [],
      templates: [],
      checklists: [],
      data: []
    }
  });

  const [rawContent, setRawContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState('form'); // 'form' or 'raw'
  const [validation, setValidation] = useState({ isValid: true, errors: [] });
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when agent changes
  useEffect(() => {
    if (agent && !isCreating) {
      setFormData({
        name: agent.name || '',
        id: agent.id || '',
        title: agent.title || '',
        icon: agent.icon || '🤖',
        whenToUse: agent.description || '',
        persona: {
          role: agent.persona?.role || '',
          style: agent.persona?.style || '',
          identity: agent.persona?.identity || '',
          focus: agent.persona?.focus || '',
          core_principles: agent.persona?.core_principles || []
        },
        commands: agent.commands || [],
        dependencies: agent.dependencies || {
          tasks: [],
          templates: [],
          checklists: [],
          data: []
        }
      });
      generateRawContent();
    } else if (isCreating) {
      // Reset to defaults for new agent
      setFormData({
        name: '',
        id: '',
        title: '',
        icon: '🤖',
        whenToUse: '',
        persona: {
          role: '',
          style: '',
          identity: '',
          focus: '',
          core_principles: []
        },
        commands: ['help', 'exit'],
        dependencies: {
          tasks: [],
          templates: [],
          checklists: [],
          data: []
        }
      });
    }
  }, [agent, isCreating]);

  // Generate raw markdown content from form data
  const generateRawContent = () => {
    const agentData = {
      'activation-instructions': [
        'STEP 1: Read THIS ENTIRE FILE - it contains your complete persona definition',
        'STEP 2: Adopt the persona defined in the \'agent\' and \'persona\' sections below',
        'STEP 3: Greet user with your name/role and mention `*help` command',
        'DO NOT: Load any other agent files during activation',
        'ONLY load dependency files when user selects them for execution via command or request of a task',
        'The agent.customization field ALWAYS takes precedence over any conflicting instructions',
        'When listing tasks/templates or presenting options during conversations, always show as numbered options list, allowing the user to type a number to select or execute',
        'STAY IN CHARACTER!',
        'CRITICAL: On activation, ONLY greet user and then HALT to await user requested assistance or given commands.'
      ],
      agent: {
        name: formData.name,
        id: formData.id,
        title: formData.title,
        icon: formData.icon,
        whenToUse: formData.whenToUse
      },
      persona: formData.persona,
      commands: formData.commands,
      dependencies: formData.dependencies
    };

    const yamlContent = yaml.dump(agentData, { indent: 2 });
    const markdown = `# ${formData.id}

ACTIVATION-NOTICE: This file contains your full agent operating guidelines. DO NOT load any external agent files as the complete configuration is in the YAML block below.

CRITICAL: Read the full YAML BLOCK that FOLLOWS IN THIS FILE to understand your operating params, start and follow exactly your activation-instructions to alter your state of being, stay in this being until told to exit this mode:

## COMPLETE AGENT DEFINITION FOLLOWS - NO EXTERNAL FILES NEEDED

\`\`\`yaml
${yamlContent}
\`\`\`
`;

    setRawContent(markdown);
  };

  // Update raw content when form data changes
  useEffect(() => {
    if (editMode === 'form') {
      generateRawContent();
    }
  }, [formData, editMode]);

  // Validate agent configuration
  const validateAgent = () => {
    const errors = [];

    if (!formData.name.trim()) errors.push('Agent name is required');
    if (!formData.id.trim()) errors.push('Agent ID is required');
    if (!formData.title.trim()) errors.push('Agent title is required');
    if (!/^[a-z-]+$/.test(formData.id)) errors.push('Agent ID must be lowercase with hyphens only');
    if (formData.commands.length === 0) errors.push('At least one command is required');
    if (!formData.commands.includes('help')) errors.push('help command is required');
    if (!formData.commands.includes('exit')) errors.push('exit command is required');

    setValidation({
      isValid: errors.length === 0,
      errors
    });

    return errors.length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Handle array fields
  const handleArrayChange = (field, index, value) => {
    setFormData(prev => {
      const newArray = [...prev[field]];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayItem = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Handle save
  const handleSave = async () => {
    if (!validateAgent()) return;

    setIsSaving(true);
    try {
      const url = '/api/bmad/agents';
      const method = isCreating ? 'POST' : 'PUT';
      const payload = {
        agentData: formData,
        rawContent: editMode === 'raw' ? rawContent : null
      };

      if (!isCreating) {
        payload.agentId = agent.id;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save agent');
      }

      const result = await response.json();
      console.log('Agent saved successfully:', result);
      
      setIsSaving(false);
      onClose();
    } catch (error) {
      console.error('Failed to save agent:', error);
      alert(`Failed to save agent: ${error.message}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isCreating ? 'Create New Agent' : `Edit Agent: ${agent?.name || agent?.id}`}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure agent behavior, commands, and dependencies
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setEditMode('form')}
                className={`px-3 py-1 text-sm rounded-md flex items-center space-x-1 ${
                  editMode === 'form' 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Form</span>
              </button>
              <button
                onClick={() => setEditMode('raw')}
                className={`px-3 py-1 text-sm rounded-md flex items-center space-x-1 ${
                  editMode === 'raw' 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Code className="w-3 h-3" />
                <span>Raw</span>
              </button>
            </div>
            
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
          {/* Editor */}
          <div className={`${showPreview ? 'w-1/2' : 'w-full'} p-6 overflow-y-auto`}>
            {editMode === 'form' ? (
              <AgentForm 
                formData={formData}
                onInputChange={handleInputChange}
                onArrayChange={handleArrayChange}
                addArrayItem={addArrayItem}
                removeArrayItem={removeArrayItem}
              />
            ) : (
              <RawEditor
                content={rawContent}
                onChange={setRawContent}
              />
            )}
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              <AgentPreview formData={formData} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {validation.isValid ? (
              <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Configuration valid</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{validation.errors.length} error(s)</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!validation.isValid || isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Agent'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Form Editor Component
function AgentForm({ formData, onInputChange, onArrayChange, addArrayItem, removeArrayItem }) {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Mary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent ID *
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => onInputChange('id', e.target.value.toLowerCase().replace(/[^a-z-]/g, ''))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., analyst"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => onInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Business Analyst"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Icon
            </label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => onInputChange('icon', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="🤖"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            When to Use
          </label>
          <textarea
            value={formData.whenToUse}
            onChange={(e) => onInputChange('whenToUse', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="Describe when this agent should be used..."
          />
        </div>
      </div>

      {/* Persona */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Persona</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <input
              type="text"
              value={formData.persona.role}
              onChange={(e) => onInputChange('persona.role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Insightful Analyst & Strategic Ideation Partner"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Style
            </label>
            <input
              type="text"
              value={formData.persona.style}
              onChange={(e) => onInputChange('persona.style', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Analytical, inquisitive, creative"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Identity
            </label>
            <textarea
              value={formData.persona.identity}
              onChange={(e) => onInputChange('persona.identity', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Describe the agent's identity and specialization..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Focus
            </label>
            <textarea
              value={formData.persona.focus}
              onChange={(e) => onInputChange('persona.focus', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Describe what the agent focuses on..."
            />
          </div>
        </div>
      </div>

      {/* Commands */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Commands</h3>
        <div className="space-y-2">
          {formData.commands.map((command, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={command}
                onChange={(e) => onArrayChange('commands', index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="e.g., help"
              />
              <button
                onClick={() => removeArrayItem('commands', index)}
                className="p-2 text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => addArrayItem('commands')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            + Add Command
          </button>
        </div>
      </div>
    </div>
  );
}

// Raw Editor Component
function RawEditor({ content, onChange }) {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Raw Markdown</h3>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
        placeholder="Agent markdown content..."
      />
    </div>
  );
}

// Preview Component
function AgentPreview({ formData }) {
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preview</h3>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-2xl">{formData.icon}</div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {formData.name || 'Unnamed Agent'}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formData.title || 'No title'}
            </p>
          </div>
        </div>
        
        {formData.whenToUse && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {formData.whenToUse}
          </p>
        )}

        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">COMMANDS:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {formData.commands.map((command, index) => (
                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs">
                  *{command}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}