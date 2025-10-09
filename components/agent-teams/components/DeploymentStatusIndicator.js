'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Users,
  GitBranch,
  Play
} from 'lucide-react';

/**
 * Enhanced Deployment Status Indicator
 * Shows detailed deployment progress with recovery suggestions
 */
const DeploymentStatusIndicator = ({ 
  isDeploying, 
  deploymentStatus, 
  error = null,
  onRetry = null,
  onCancel = null 
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  // Simulate deployment progress
  useEffect(() => {
    if (!isDeploying) {
      setProgress(0);
      setCurrentStep('');
      return;
    }

    const steps = [
      'Validating team configuration...',
      'Loading agent definitions...',
      'Initializing workflow engine...',
      'Setting up real-time connections...',
      'Deploying agent team...'
    ];

    let stepIndex = 0;
    let progressValue = 0;

    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setCurrentStep(steps[stepIndex]);
        progressValue = ((stepIndex + 1) / steps.length) * 90; // Stop at 90% until complete
        setProgress(progressValue);
        stepIndex++;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isDeploying]);

  // Auto-complete progress when deployment finishes
  useEffect(() => {
    if (!isDeploying && deploymentStatus.includes('✅')) {
      setProgress(100);
      setCurrentStep('Deployment complete!');
    }
  }, [isDeploying, deploymentStatus]);

  if (!isDeploying && !deploymentStatus && !error) {
    return null;
  }

  const getStatusIcon = () => {
    if (error) return <XCircle className="w-6 h-6 text-red-500" />;
    if (deploymentStatus.includes('✅')) return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (deploymentStatus.includes('❌')) return <XCircle className="w-6 h-6 text-red-500" />;
    if (isDeploying) return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
    return <Clock className="w-6 h-6 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (error || deploymentStatus.includes('❌')) return 'border-red-200 bg-red-50';
    if (deploymentStatus.includes('✅')) return 'border-green-200 bg-green-50';
    if (isDeploying) return 'border-blue-200 bg-blue-50';
    return 'border-gray-200 bg-gray-50';
  };

  const getProgressColor = () => {
    if (error || deploymentStatus.includes('❌')) return 'bg-red-500';
    if (deploymentStatus.includes('✅')) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getErrorSuggestion = (error) => {
    if (!error) return null;

    const suggestions = {
      'timeout': {
        icon: <Clock className="w-4 h-4" />,
        message: 'Deployment timed out. This usually happens during high traffic.',
        action: 'Try deploying again in a few minutes.'
      },
      'network': {
        icon: <AlertTriangle className="w-4 h-4" />,
        message: 'Network connection issue detected.',
        action: 'Check your internet connection and try again.'
      },
      'validation': {
        icon: <XCircle className="w-4 h-4" />,
        message: 'Team configuration validation failed.',
        action: 'Review your team and workflow selection.'
      },
      'resource': {
        icon: <Users className="w-4 h-4" />,
        message: 'Insufficient resources available.',
        action: 'Try cleaning up stuck deployments or contact support.'
      },
      'default': {
        icon: <AlertTriangle className="w-4 h-4" />,
        message: 'An unexpected error occurred.',
        action: 'Please try again or contact support if the issue persists.'
      }
    };

    // Determine error type based on error message
    const errorType = 
      error.includes('timeout') ? 'timeout' :
      error.includes('network') || error.includes('connection') ? 'network' :
      error.includes('validation') || error.includes('invalid') ? 'validation' :
      error.includes('resource') || error.includes('limit') ? 'resource' :
      'default';

    return suggestions[errorType];
  };

  const errorSuggestion = getErrorSuggestion(error);

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
      <div className="flex items-center space-x-3 mb-3">
        {getStatusIcon()}
        <div className="flex-1">
          <span className="font-medium text-gray-800">
            {error ? 'Deployment Failed' : deploymentStatus}
          </span>
          {currentStep && (
            <div className="text-sm text-gray-600 mt-1">
              {currentStep}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(isDeploying || progress > 0) && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {Math.round(progress)}% complete
          </div>
        </div>
      )}

      {/* Error Details and Suggestion */}
      {error && errorSuggestion && (
        <div className="mt-3 p-3 bg-white border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2 mb-2">
            <div className="text-red-500 mt-0.5">
              {errorSuggestion.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {errorSuggestion.message}
              </p>
              <p className="text-sm text-red-600 mt-1">
                {errorSuggestion.action}
              </p>
            </div>
          </div>
          
          {/* Error Actions */}
          <div className="flex items-center gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                Try Again
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 border border-red-300 text-red-700 text-sm rounded hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success Actions */}
      {deploymentStatus.includes('✅') && (
        <div className="mt-3 p-3 bg-white border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Team deployed successfully! You can now interact with your agents.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentStatusIndicator;