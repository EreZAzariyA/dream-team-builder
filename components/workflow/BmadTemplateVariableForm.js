'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

/**
 * BMAD Template Variable Form Component
 * 
 * Dynamic form builder for BMAD template variable input
 * Supports different variable types: string, enum, boolean, array, file
 * Integrates with .bmad-core template YAML specifications
 */
export default function BmadTemplateVariableForm({ 
  template, 
  onSubmit, 
  onCancel,
  initialValues = {},
  isLoading = false
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (template?.variables) {
      // Initialize form with default values
      const defaultValues = {};
      Object.entries(template.variables).forEach(([key, variable]) => {
        if (initialValues[key] !== undefined) {
          defaultValues[key] = initialValues[key];
        } else if (variable.default !== undefined) {
          defaultValues[key] = variable.default;
        } else {
          // Set appropriate default based on type
          switch (variable.type) {
            case 'boolean':
              defaultValues[key] = false;
              break;
            case 'array':
              defaultValues[key] = [];
              break;
            case 'enum':
              defaultValues[key] = variable.options?.[0] || '';
              break;
            default:
              defaultValues[key] = '';
          }
        }
      });
      setValues(prev => ({ ...defaultValues, ...prev }));
    }
  }, [template, initialValues]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateForm(values, template?.variables || {});
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValueChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const validateForm = (formValues, templateVariables) => {
    const validationErrors = {};

    Object.entries(templateVariables).forEach(([key, variable]) => {
      const value = formValues[key];

      // Check required fields
      if (variable.required && (!value || (Array.isArray(value) && value.length === 0))) {
        validationErrors[key] = `${variable.title || key} is required`;
        return;
      }

      // Type-specific validation
      switch (variable.type) {
        case 'enum':
          if (value && variable.options && !variable.options.includes(value)) {
            validationErrors[key] = `Invalid selection. Choose from: ${variable.options.join(', ')}`;
          }
          break;
        case 'array':
          if (variable.minItems && Array.isArray(value) && value.length < variable.minItems) {
            validationErrors[key] = `At least ${variable.minItems} items required`;
          }
          if (variable.maxItems && Array.isArray(value) && value.length > variable.maxItems) {
            validationErrors[key] = `Maximum ${variable.maxItems} items allowed`;
          }
          break;
        case 'string':
          if (value && variable.minLength && value.length < variable.minLength) {
            validationErrors[key] = `Minimum ${variable.minLength} characters required`;
          }
          if (value && variable.maxLength && value.length > variable.maxLength) {
            validationErrors[key] = `Maximum ${variable.maxLength} characters allowed`;
          }
          break;
      }
    });

    return validationErrors;
  };

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading template...</span>
      </div>
    );
  }

  const templateVariables = template.variables || {};
  const hasVariables = Object.keys(templateVariables).length > 0;

  if (!hasVariables) {
    return (
      <div className="text-center p-8">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No Variables Required</h3>
        <p className="mt-2 text-gray-500">This template can be generated without additional input.</p>
        <button
          onClick={() => onSubmit({})}
          disabled={isSubmitting}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Generating...' : 'Generate Document'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-96 overflow-y-auto p-4">
      {/* Template Header */}
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
        {template.description && (
          <p className="mt-1 text-sm text-gray-500">{template.description}</p>
        )}
        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
          <span>Type: {template.type}</span>
          <span>Variables: {Object.keys(templateVariables).length}</span>
          {template.agent && <span>Agent: {template.agent}</span>}
        </div>
      </div>

      {/* Form Fields */}
      {Object.entries(templateVariables).map(([key, variable]) => (
        <FormField
          key={key}
          name={key}
          variable={variable}
          value={values[key]}
          error={errors[key]}
          onChange={(value) => handleValueChange(key, value)}
        />
      ))}

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <XMarkIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <DocumentTextIcon className="h-4 w-4" />
              <span>Generate Document</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function FormField({ name, variable, value, error, onChange }) {
  const renderField = () => {
    switch (variable.type) {
      case 'string':
        return variable.multiline ? (
          <textarea
            id={name}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={variable.placeholder}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        ) : (
          <input
            id={name}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={variable.placeholder}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        );

      case 'enum':
        return (
          <select
            id={name}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
          >
            {!variable.required && <option value="">Select an option</option>}
            {(variable.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              id={name}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={name} className="ml-2 text-sm text-gray-700">
              {variable.label || 'Enable this option'}
            </label>
          </div>
        );

      case 'array':
        return <ArrayField value={value || []} onChange={onChange} variable={variable} />;

      case 'file':
        return (
          <div>
            <input
              id={name}
              type="file"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  // For now, just store the filename
                  onChange(file.name);
                  // TODO: Handle file upload/processing
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                error ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {value && (
              <p className="mt-1 text-sm text-gray-500">Selected: {value}</p>
            )}
          </div>
        );

      default:
        return (
          <input
            id={name}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={variable.placeholder}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        );
    }
  };

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {variable.title || name}
        {variable.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {variable.description && (
        <div className="flex items-start mb-2">
          <InformationCircleIcon className="h-4 w-4 text-gray-400 mt-0.5 mr-1 flex-shrink-0" />
          <p className="text-xs text-gray-500">{variable.description}</p>
        </div>
      )}
      
      {renderField()}
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {variable.example && !error && (
        <p className="mt-1 text-xs text-gray-500">Example: {variable.example}</p>
      )}
    </div>
  );
}

function ArrayField({ value, onChange, variable }) {
  const handleAdd = () => {
    onChange([...value, '']);
  };

  const handleRemove = (index) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleItemChange = (index, itemValue) => {
    const newValue = [...value];
    newValue[index] = itemValue;
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <input
            type="text"
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            placeholder={`${variable.title || 'Item'} ${index + 1}`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="p-2 text-gray-400 hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <PlusIcon className="h-4 w-4" />
        <span>Add {variable.itemTitle || 'Item'}</span>
      </button>
    </div>
  );
}