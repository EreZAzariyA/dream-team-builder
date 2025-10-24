'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { usePusherChat } from '../../agent-chat/hooks/usePusherChat';
import {
  Cog6ToothIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  DocumentTextIcon,
  UserIcon,
  ClockIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

/**
 * Interactive Message Component
 * Renders different types of agent messages with user interaction capabilities
 */
const InteractiveMessage = ({ message, onResponse }) => {
  const [userInput, setUserInput] = useState('');
  const [responded, setResponded] = useState(false);

  const isUser = message.from === 'user';
  const isSystem = message.type === 'status' || message.from === 'system';
  const isInteractive = message.requiresResponse && !responded;
  
  // Color schemes based on message type
  const getMessageColors = () => {
    if (isUser) return {
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      iconBg: 'bg-blue-600'
    };
    if (isSystem) return {
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      iconBg: 'bg-gray-600'
    };
    if (message.type === 'agent-intro') return {
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      iconBg: 'bg-purple-600'
    };
    if (message.type === 'agent-question') return {
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      iconBg: 'bg-orange-600'
    };
    if (message.type === 'agent-work-complete') return {
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconBg: 'bg-green-600'
    };
    if (message.type === 'agent-error') return {
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      iconBg: 'bg-red-600'
    };
    return {
      bgColor: 'bg-white dark:bg-gray-800',
      iconBg: 'bg-green-600'
    };
  };

  const { bgColor, iconBg } = getMessageColors();

  const handleResponse = (response, action = null) => {
    setResponded(true);
    onResponse(message.messageId, response, action);
  };

  const renderInteractiveElements = () => {
    if (!isInteractive) return null;

    // Multiple choice questions
    if (message.responseType === 'choice' && message.choices) {
      return (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Please choose:</p>
          <div className="grid gap-2">
            {message.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleResponse(choice)}
                className="text-left px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
              >
                ╭─────────╮<br />
                │  &gt; {choice}  │<br />
                ╰─────────╯
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Work approval (yes/no/modify)
    if (message.responseType === 'approval') {
      return (
        <div className="mt-4 space-y-3">
          {message.workContent && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Generated Work:</p>
              <div className="text-sm text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto">
                <pre className="whitespace-pre-wrap font-mono text-xs">{message.workContent.substring(0, 500)}{message.workContent.length > 500 ? '...' : ''}</pre>
              </div>
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              onClick={() => handleResponse('yes', 'yes')}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              ✅ Approve
            </button>
            <button
              onClick={() => handleResponse('modify', 'modify')}
              className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors"
            >
              🔄 Modify
            </button>
            <button
              onClick={() => handleResponse('no', 'no')}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              ❌ Reject
            </button>
          </div>
        </div>
      );
    }

    // Confirmation questions
    if (message.responseType === 'confirmation') {
      return (
        <div className="mt-3 flex space-x-2">
          <button
            onClick={() => handleResponse('yes')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => handleResponse('no')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            No
          </button>
        </div>
      );
    }

    // Text input for open-ended responses
    return (
      <div className="mt-3">
        <div className="flex space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your response..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && userInput.trim()) {
                handleResponse(userInput.trim());
                setUserInput('');
              }
            }}
          />
          <button
            onClick={() => {
              if (userInput.trim()) {
                handleResponse(userInput.trim());
                setUserInput('');
              }
            }}
            disabled={!userInput.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`w-8 h-8 ${iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
        <span className="text-white text-sm font-medium">
          {message.from?.[0]?.toUpperCase() || 'A'}
        </span>
      </div>
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`${bgColor} rounded-lg p-3 shadow-sm ${isInteractive ? 'border-2 border-dashed border-blue-400' : ''} ${isUser ? 'ml-auto max-w-[80%]' : 'max-w-[90%]'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <span className="font-medium text-gray-900 dark:text-white text-sm">
              {message.from || 'Agent'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            {message.type && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                message.type === 'agent-question' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
                message.type === 'agent-work-complete' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                message.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
              }`}>
                {message.type.replace('agent-', '')}
              </span>
            )}
            {isInteractive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                awaiting response
              </span>
            )}
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
            {message.content}
          </p>
          {renderInteractiveElements()}
        </div>
      </div>
    </div>
  );
};

/**
 * Workflow Selector Component
 * Displays available workflows from database for repository selection
 */
const WorkflowSelector = ({ repository, analysisData }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [viewMode, setViewMode] = useState('templates'); // 'templates', 'user-workflows'
  const [executingWorkflow, setExecutingWorkflow] = useState(null); // Track executing workflow
  const [workflowInstanceId, setWorkflowInstanceId] = useState(null); // Track workflow instance
  const [searchQuery, setSearchQuery] = useState('');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (repository) {
      loadWorkflows();
    }
  }, [repository, viewMode]);

  const loadWorkflows = async () => {
    if (!repository) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workflows/templates');

      if (!response.ok) {
        // Provide specific error messages based on status code
        let errorMessage = 'Failed to fetch workflows';
        let errorType = 'server';

        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication required. Please sign in again.';
          errorType = 'auth';
        } else if (response.status === 404) {
          errorMessage = 'Workflow service not found. Please contact support.';
          errorType = 'not_found';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Our team has been notified.';
          errorType = 'server';
        } else if (!navigator.onLine) {
          errorMessage = 'No internet connection. Please check your network.';
          errorType = 'network';
        }

        throw new Error(JSON.stringify({ message: errorMessage, type: errorType, status: response.status }));
      }

      const data = await response.json();
      setWorkflows(data.templates || []);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      let parsedError;
      try {
        parsedError = JSON.parse(error.message);
      } catch {
        parsedError = {
          message: error.message || 'An unexpected error occurred',
          type: 'unknown'
        };
      }
      setError(parsedError);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    // Exponential backoff: wait 1s, 2s, 4s, 8s...
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    setTimeout(() => {
      loadWorkflows();
    }, delay);
  };

  const handleWorkflowSelect = (workflow) => {
    setSelectedWorkflow(workflow);
  };

  const handleExecuteWorkflow = async (workflow, event) => {
    // Initialize button variables at function scope to avoid ReferenceError
    const button = event?.target;
    const originalText = button?.textContent;
    
    try {
      
      // Show loading state
      if (button) {
        button.textContent = 'Starting...';
        button.disabled = true;
      }
      
      // Prepare workflow launch request
      const launchData = {
        userPrompt: `Execute ${workflow.name} workflow for repository ${repository.name}. ${workflow.description || ''}`,
        name: `${workflow.name} - ${repository.name}`,
        description: `Automated execution of ${workflow.name} workflow for ${repository.owner?.login}/${repository.name}`,
        githubRepository: {
          id: repository.id,
          owner: repository.owner?.login,
          name: repository.name,
          full_name: repository.full_name,
          html_url: repository.html_url,
          description: repository.description,
          default_branch: repository.default_branch || 'main',
          language: repository.language,
          private: repository.private
        }
      };

      
      // Launch workflow via BMAD API
      const response = await fetch(`/api/workflows/${workflow.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(launchData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        
        // Set state to show embedded chat instead of redirecting
        setExecutingWorkflow(workflow);
        setWorkflowInstanceId(result.workflowInstanceId);
        
        // Show success message
        alert(`✅ Workflow "${workflow.name}" launched successfully!\n\nMonitoring below.`);
      } else {
        throw new Error(result.details || result.error || 'Failed to launch workflow');
      }
      
    } catch (error) {
      // Error executing workflow
      alert(`❌ Failed to launch workflow: ${error.message}`);
    } finally {
      // Reset button state
      if (button) {
        button.textContent = originalText || 'Execute';
        button.disabled = false;
      }
    }
  };

  const getComplexityColor = (complexity) => {
    switch (complexity?.toLowerCase()) {
      case 'simple':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'complex':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getProjectTypeColor = (type) => {
    const colors = {
      'greenfield': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      'brownfield': 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      'maintenance': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
      'enhancement': 'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // Skeleton loader component
  const WorkflowCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mt-1"></div>
        </div>
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16"></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div className="h-9 bg-gray-300 dark:bg-gray-600 rounded flex-1"></div>
        <div className="h-9 w-9 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <WorkflowCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const getErrorIcon = () => {
      if (error.type === 'network') return '📡';
      if (error.type === 'auth') return '🔒';
      if (error.type === 'not_found') return '🔍';
      return '⚠️';
    };

    const getErrorColor = () => {
      if (error.type === 'network') return 'text-orange-600 dark:text-orange-400';
      if (error.type === 'auth') return 'text-yellow-600 dark:text-yellow-400';
      return 'text-red-600 dark:text-red-400';
    };

    return (
      <div className="p-8 text-center">
        <div className="text-6xl mb-4">{getErrorIcon()}</div>
        <p className={`${getErrorColor()} font-semibold mb-2`}>
          {error.message || 'Failed to load workflows'}
        </p>
        {error.status && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Error Code: {error.status}
          </p>
        )}
        <div className="flex items-center justify-center space-x-3 mt-6">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center space-x-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Retry{retryCount > 0 ? ` (${retryCount})` : ''}</span>
          </button>
          {error.type === 'auth' && (
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
        {retryCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Retrying in {Math.min(Math.pow(2, retryCount), 10)} seconds...
          </p>
        )}
      </div>
    );
  }

  // Embedded Workflow Monitor Component
  const EmbeddedWorkflowMonitor = ({ workflowId, workflow, onClose }) => {
    const [workflowData, setWorkflowData] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0, eta: null });
    const [isPaused, setIsPaused] = useState(false);
    const messagesEndRef = useRef(null);
    const startTimeRef = useRef(Date.now());
    
    // Use the custom Pusher hook
    const { setupPusherSubscription, cleanup: cleanupPusher } = usePusherChat();
    
    // Scroll to bottom when messages change
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    
    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
      if (workflowId) {
        initializeMonitoring();
        return () => cleanupPusher();
      }
    }, [workflowId, cleanupPusher]);
    
    const initializeMonitoring = async () => {
      setIsLoading(true);
      try {
        // Load initial workflow data
        await loadWorkflowData();
        
        // Set up Pusher connection using custom hook
        setupPusherSubscription(
          workflowId,
          'workflow', // channelPrefix
          handleIncomingMessage, // onMessage
          handleChatStarted,     // onChatStarted  
          handleChatEnded,       // onChatEnded
          handleWorkflowUpdate   // onWorkflowUpdate
        );
        
        setIsConnected(true);
        
        // Poll for initial messages
        await pollMessages();
        
      } catch (error) {
        // Error initializing monitoring
      } finally {
        setIsLoading(false);
      }
    };
    
    const loadWorkflowData = async () => {
      try {
        const response = await fetch(`/api/workflows/live/${workflowId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkflowData(data);

          // Load existing messages from workflow data
          if (data.communication?.timeline) {
            setMessages(data.communication.timeline);
          }

          // Calculate progress
          if (data.workflow && data.workflow.sequence) {
            const total = data.workflow.sequence.length;
            const current = data.progress?.currentStep || 0;
            const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

            // Calculate ETA based on elapsed time and progress
            const elapsed = Date.now() - startTimeRef.current;
            const avgTimePerStep = current > 0 ? elapsed / current : 0;
            const remainingSteps = total - current;
            const etaMs = avgTimePerStep * remainingSteps;
            const etaMinutes = Math.round(etaMs / 60000);

            setProgress({
              current,
              total,
              percentage,
              eta: etaMinutes > 0 ? `${etaMinutes} min` : null
            });
          }

          // Check if paused
          setIsPaused(data.status === 'PAUSED' || data.status === 'PAUSED_FOR_ELICITATION');
        } else {
          // Failed to load workflow data
        }
      } catch (error) {
        // Error loading workflow data
      }
    };

    const handlePauseResume = async () => {
      try {
        const action = isPaused ? 'resume' : 'pause';
        const response = await fetch(`/api/workflows/${workflowId}/${action}`, {
          method: 'POST'
        });

        if (response.ok) {
          setIsPaused(!isPaused);
          await loadWorkflowData();
        }
      } catch (error) {
        console.error(`Failed to ${isPaused ? 'resume' : 'pause'} workflow:`, error);
      }
    };

    const handleCancel = async () => {
      if (!confirm('Are you sure you want to cancel this workflow? This action cannot be undone.')) {
        return;
      }

      try {
        const response = await fetch(`/api/workflows/${workflowId}/cancel`, {
          method: 'POST'
        });

        if (response.ok) {
          onClose();
        }
      } catch (error) {
        console.error('Failed to cancel workflow:', error);
      }
    };
    
    // Handler functions for Pusher events
    const handleIncomingMessage = (message) => {
      addMessage({
        from: message.agentId || message.agent || message.from || 'Agent',
        content: message.message || message.content,
        timestamp: message.timestamp || new Date().toISOString(),
        type: message.type || 'response',
        // Interactive message properties
        isInteractive: message.isInteractive || false,
        requiresResponse: message.requiresResponse || false,
        responseType: message.responseType,
        choices: message.choices,
        messageId: message.messageId,
        // Additional content for work completion
        workContent: message.content // For displaying generated artifacts
      });
    };
    
    const handleChatStarted = (message) => {
      addMessage({
        from: 'system',
        content: message || 'Workflow chat started',
        timestamp: new Date().toISOString(),
        type: 'status'
      });
    };
    
    const handleChatEnded = () => {
      addMessage({
        from: 'system',
        content: 'Workflow completed',
        timestamp: new Date().toISOString(),
        type: 'status'
      });
    };
    
    const handleWorkflowUpdate = (data) => {
      
      // Handle different types of workflow updates
      if (data.message) {
        addMessage({
          from: data.agent || 'system',
          content: data.message,
          timestamp: data.timestamp || new Date().toISOString(),
          type: 'status'
        });
      }
      
      if (data.agentId) {
        addMessage({
          from: 'system',
          content: `${data.agentId} is now active`,
          timestamp: data.timestamp || new Date().toISOString(),
          type: 'status'
        });
      }
    };
    
    const pollMessages = async () => {
      // Additional polling as backup to Pusher
      try {
        const response = await fetch(`/api/workflows/live/${workflowId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.communication?.timeline && data.communication.timeline.length > messages.length) {
            setMessages(data.communication.timeline);
          }
        }
      } catch (error) {
        // Error polling messages
      }
    };
    
    const addMessage = (message) => {
      setMessages(prev => {
        // Avoid duplicate messages
        const isDuplicate = prev.some(m => 
          m.timestamp === message.timestamp && 
          m.content === message.content &&
          m.from === message.from
        );
        
        if (isDuplicate) return prev;
        
        return [...prev, {
          ...message,
          id: `msg-${Date.now()}-${Math.random()}`
        }].slice(-100); // Keep last 100 messages
      });
    };
    
    const handleSendMessage = async (message) => {
      if (!message.trim()) return;
      
      try {
        // Add user message to UI immediately
        addMessage({
          from: 'user',
          content: message,
          timestamp: new Date().toISOString(),
          type: 'user'
        });
        
        // Send to workflow API
        const response = await fetch(`/api/workflows/${workflowId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message })
        });
        
        if (!response.ok) {
          // Failed to send message
          addMessage({
            from: 'system',
            content: 'Failed to send message. Please try again.',
            timestamp: new Date().toISOString(),
            type: 'error'
          });
        }
        
      } catch (error) {
        // Error sending message
        addMessage({
          from: 'system',
          content: 'Error sending message. Please check your connection.',
          timestamp: new Date().toISOString(),
          type: 'error'
        });
      }
    };

    // Handle user responses to interactive messages
    const handleInteractiveResponse = async (messageId, response, action = null, feedback = null) => {
      try {
        // Add user response to UI immediately
        addMessage({
          from: 'user',
          content: response,
          timestamp: new Date().toISOString(),
          type: 'user-response',
          respondingTo: messageId
        });

        const responseData = await fetch(`/api/workflows/${workflowId}/respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId,
            response,
            action,
            feedback
          })
        });

        if (!responseData.ok) {
          throw new Error(`Failed to send response: ${responseData.status}`);
        }

        const result = await responseData.json();

      } catch (error) {
        // Error sending interactive response
        addMessage({
          from: 'system',
          content: `Failed to send response: ${error.message}`,
          timestamp: new Date().toISOString(),
          type: 'error'
        });
      }
    };
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {workflow.name} - Live Monitor
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {progress.total > 0 ? `Step ${progress.current} of ${progress.total}` : 'Starting...'}
                  {progress.eta && ` • ETA: ${progress.eta}`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePauseResume}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? (
                  <PlayIcon className="w-5 h-5" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleCancel}
                className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Cancel Workflow"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Close Monitor"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {progress.total > 0 && (
            <div className="px-4 pb-3">
              <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 0.5 }}
                  className={`absolute top-0 left-0 h-full rounded-full ${
                    isPaused
                      ? 'bg-yellow-500'
                      : 'bg-gradient-to-r from-blue-500 to-green-500'
                  }`}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {progress.percentage}% complete
                </span>
                {isPaused && (
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    ⏸ Paused
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Chat Area */}
        <div className="h-96 flex flex-col">
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            {isLoading ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Loading workflow data...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Cog6ToothIcon className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Workflow is starting... agents will appear here shortly</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  return (
                    <InteractiveMessage 
                      key={message.id || index}
                      message={message}
                      onResponse={handleInteractiveResponse}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Message the workflow agents..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputMessage.trim()) {
                    handleSendMessage(inputMessage.trim());
                    setInputMessage('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (inputMessage.trim()) {
                    handleSendMessage(inputMessage.trim());
                    setInputMessage('');
                  }
                }}
                disabled={!inputMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
              {workflowData && (
                <>
                  <span className="mx-1">•</span>
                  <span>{workflowData.workflow?.name || 'Workflow'}</span>
                  <span className="mx-1">•</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    workflowData.status === 'RUNNING' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                    workflowData.status === 'PAUSED_FOR_ELICITATION' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {workflowData.status || 'Unknown'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Handle closing embedded monitor
  const handleCloseMonitor = () => {
    setExecutingWorkflow(null);
    setWorkflowInstanceId(null);
  };

  // Filter workflows based on search and filters
  const filteredWorkflows = workflows.filter(workflow => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // Complexity filter
    const matchesComplexity = complexityFilter === 'all' ||
      workflow.decision_guidance?.complexity?.toLowerCase() === complexityFilter;

    // Type filter
    const matchesType = typeFilter === 'all' || workflow.type === typeFilter;

    return matchesSearch && matchesComplexity && matchesType;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Cog6ToothIcon className="w-5 h-5 mr-2" />
            Available Workflows
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            for {repository.name}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
        <select
          value={complexityFilter}
          onChange={(e) => setComplexityFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Complexity</option>
          <option value="simple">Simple</option>
          <option value="moderate">Moderate</option>
          <option value="complex">Complex</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Types</option>
          <option value="greenfield">Greenfield</option>
          <option value="brownfield">Brownfield</option>
          <option value="maintenance">Maintenance</option>
          <option value="enhancement">Enhancement</option>
        </select>
      </div>

      {/* Repository Context */}
      {analysisData && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            Repository Context
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-blue-700 dark:text-blue-300">Language:</span>
              <span className="ml-1 font-medium">{repository.language || 'N/A'}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">Files:</span>
              <span className="ml-1 font-medium">{analysisData.metrics?.fileCount || 0}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">Size:</span>
              <span className="ml-1 font-medium">{repository.size ? `${Math.round(repository.size / 1024)}KB` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-blue-700 dark:text-blue-300">Type:</span>
              <span className="ml-1 font-medium">{repository.private ? 'Private' : 'Public'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Workflows Grid */}
      {filteredWorkflows.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredWorkflows.length} of {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((workflow) => (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                selectedWorkflow?.id === workflow.id 
                  ? 'border-blue-500 shadow-lg' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-md'
              }`}
              onClick={() => handleWorkflowSelect(workflow)}
            >
              <div className="p-6">
                
                {/* Workflow Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {workflow.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {workflow.description}
                    </p>
                  </div>
                  {selectedWorkflow?.id === workflow.id && (
                    <CheckCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2" />
                  )}
                </div>

                {/* Workflow Metadata */}
                <div className="space-y-3 mb-4">
                  
                  {/* Type and Complexity */}
                  <div className="flex items-center space-x-2">
                    {workflow.type && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProjectTypeColor(workflow.type)}`}>
                        {workflow.type}
                      </span>
                    )}
                    {workflow.decision_guidance?.complexity && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(workflow.decision_guidance.complexity)}`}>
                        {workflow.decision_guidance.complexity}
                      </span>
                    )}
                  </div>

                  {/* Agents with Avatars */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      {workflow.sequence?.length > 0 ? (
                        <div className="flex -space-x-2">
                          {workflow.sequence.slice(0, 3).map((step, idx) => (
                            <div
                              key={idx}
                              className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-semibold"
                              title={step.agent}
                            >
                              {step.agent?.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {workflow.sequence.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs">
                              +{workflow.sequence.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <UserIcon className="w-3 h-3" />
                      )}
                      <span>{workflow.sequence?.length || 0} agents</span>
                    </div>
                    {workflow.decision_guidance?.estimated_time && (
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>{workflow.decision_guidance.estimated_time}</span>
                      </div>
                    )}
                  </div>

                  {/* Project Types */}
                  {workflow.project_types && workflow.project_types.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Best for:</p>
                      <div className="flex flex-wrap gap-1">
                        {workflow.project_types.slice(0, 3).map((projectType, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {projectType}
                          </span>
                        ))}
                        {workflow.project_types.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{workflow.project_types.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExecuteWorkflow(workflow, e);
                    }}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <PlayIcon className="w-4 h-4" />
                    <span>Execute</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Show workflow details
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        </>
      ) : workflows.length > 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Matching Workflows
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your search or filters
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setComplexityFilter('all');
              setTypeFilter('all');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="text-center py-12">
          <Cog6ToothIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Workflows Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No workflow templates are currently available for this repository.
          </p>
        </div>
      )}

      {/* Selected Workflow Details */}
      {selectedWorkflow && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6"
        >
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            Workflow Details: {selectedWorkflow.name}
          </h4>
          
          {selectedWorkflow.decision_guidance?.when_to_use && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                When to use:
              </h5>
              <ul className="space-y-1">
                {selectedWorkflow.decision_guidance.when_to_use.map((item, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <ChevronRightIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedWorkflow.sequence && selectedWorkflow.sequence.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Workflow Steps ({selectedWorkflow.sequence.length} agents):
              </h5>
              <div className="flex flex-wrap gap-2">
                {selectedWorkflow.sequence.map((step, index) => (
                  <span key={index} className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                    {index + 1}. {step.agent}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Embedded Workflow Monitor */}
      {executingWorkflow && workflowInstanceId && (
        <EmbeddedWorkflowMonitor
          workflowId={workflowInstanceId}
          workflow={executingWorkflow}
          onClose={handleCloseMonitor}
        />
      )}
    </div>
  );
};

export default memo(WorkflowSelector);