/**
 * Error Boundary for Workflow Components
 * Provides graceful error handling and recovery for workflow-related components
 */

'use client';

import React from 'react';

class WorkflowErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `workflow-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    const errorDetails = {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown'
    };

    console.error('Workflow Error Boundary caught an error:', errorDetails);

    // Update state with error info
    this.setState({
      errorInfo,
      error
    });

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorDetails);
    }

    // Send to monitoring service if available
    if (typeof window !== 'undefined' && window.reportError) {
      window.reportError(error);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1
      });
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0
    });
    
    // Call reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI from props
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry, this.handleReset);
      }

      // Default fallback UI
      return (
        <div className="workflow-error-boundary">
          <div className="min-h-64 flex items-center justify-center bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-center max-w-md mx-auto p-6">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <div className="text-2xl text-red-600 dark:text-red-400">⚠️</div>
                </div>
                <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
                  Workflow Error
                </h2>
                <p className="text-red-600 dark:text-red-300 text-sm mb-4">
                  {this.props.title || 'Something went wrong with the workflow component.'}
                </p>
              </div>

              {/* Error details (only in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-md text-left">
                  <details className="text-xs text-red-700 dark:text-red-300">
                    <summary className="cursor-pointer font-medium mb-2">
                      Error Details (Development)
                    </summary>
                    <div className="space-y-2">
                      <div>
                        <strong>Error:</strong> {this.state.error.message}
                      </div>
                      <div>
                        <strong>Error ID:</strong> {this.state.errorId}
                      </div>
                      {this.state.error.stack && (
                        <div>
                          <strong>Stack:</strong>
                          <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {this.state.retryCount < 3 && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Try Again ({3 - this.state.retryCount} attempts left)
                  </button>
                )}
                
                <button
                  onClick={this.handleReset}
                  className="w-full px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium"
                >
                  Reset Component
                </button>

                {this.props.showReloadOption !== false && (
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-4 py-2 text-red-600 dark:text-red-400 text-sm hover:text-red-800 dark:hover:text-red-200 transition-colors"
                  >
                    Reload Page
                  </button>
                )}
              </div>

              {/* Help text */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-2">
                  <div className="text-blue-500 mt-0.5 text-sm">💡</div>
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Need help?</p>
                    <p>
                      If this error persists, try refreshing the page or check your internet connection. 
                      The error ID above can help with troubleshooting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional component wrapper for easier usage
 */
export function WorkflowErrorWrapper({ 
  children, 
  title, 
  onError, 
  onReset, 
  fallback, 
  showReloadOption = true 
}) {
  return (
    <WorkflowErrorBoundary
      title={title}
      onError={onError}
      onReset={onReset}
      fallback={fallback}
      showReloadOption={showReloadOption}
    >
      {children}
    </WorkflowErrorBoundary>
  );
}

/**
 * Hook for throwing errors that will be caught by error boundaries
 */
export function useErrorHandler() {
  return React.useCallback((error, errorInfo = {}) => {
    // Log the error
    console.error('Manual error thrown:', { error, errorInfo });
    
    // Throw the error to be caught by error boundary
    throw new Error(error);
  }, []);
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withWorkflowErrorBoundary(Component, options = {}) {
  const WrappedComponent = React.forwardRef((props, ref) => (
    <WorkflowErrorBoundary {...options}>
      <Component {...props} ref={ref} />
    </WorkflowErrorBoundary>
  ));
  
  WrappedComponent.displayName = `WithWorkflowErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default WorkflowErrorBoundary;