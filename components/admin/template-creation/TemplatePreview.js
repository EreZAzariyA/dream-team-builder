'use client';

import { Badge } from '../../common/Badge';

export default function TemplatePreview({ formData, isVisible }) {
  if (!isVisible) return null;

  const getTypeColor = (type) => {
    switch (type) {
      case 'greenfield': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'brownfield': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'enhancement': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <h3 className="font-medium text-gray-900 dark:text-white mb-4">Template Preview</h3>
      <div className="space-y-4">
        {/* Basic Information */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">
            {formData.name || 'Untitled Template'}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formData.description || 'No description provided'}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge className={getTypeColor(formData.type)}>
              {formData.type}
            </Badge>
            {formData.project_types.map((type, index) => (
              <Badge key={index} className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                {type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Workflow Steps */}
        {formData.sequence.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Workflow Steps ({formData.sequence.length})
            </h4>
            <div className="space-y-2">
              {formData.sequence.map((step, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <div>
                    <span className="font-medium text-blue-600">@{step.agent}</span>
                    {step.creates && <span className="ml-1">creates {step.creates}</span>}
                    {step.action && <span className="ml-1">{step.action}</span>}
                    {step.optional && <span className="ml-1 text-yellow-600">(optional)</span>}
                    {step.condition && (
                      <div className="text-xs text-gray-500 mt-1">
                        if: {step.condition}
                      </div>
                    )}
                    {step.notes && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {step.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision Guidance */}
        {formData.decision_guidance?.when_to_use?.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">When to Use</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              {formData.decision_guidance.when_to_use.map((guidance, index) => (
                <li key={index}>{guidance}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary Stats */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Steps:</span>
              <span className="ml-2 font-medium">{formData.sequence.length}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Agents:</span>
              <span className="ml-2 font-medium">
                {new Set(formData.sequence.map(s => s.agent)).size}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Optional:</span>
              <span className="ml-2 font-medium">
                {formData.sequence.filter(s => s.optional).length}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Project Types:</span>
              <span className="ml-2 font-medium">{formData.project_types.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}