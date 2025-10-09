
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '../../common/Card';
import { WorkflowErrorWrapper } from '../../common/WorkflowErrorBoundary';
import { Loader2, AlertCircle } from 'lucide-react';

// Import the new smaller components
import WorkflowHeader from './WorkflowHeader';
import WorkflowProgress from './WorkflowProgress';
import WorkflowControls from './WorkflowControls';
import WorkflowArtifacts from './WorkflowArtifacts';
import { useLiveWorkflow } from './useLiveWorkflow';

const LiveWorkflow = () => {
  // Extract parameters from the new route structure
  const { teamId, workflowId } = useParams();
  const workflowInstanceId = workflowId; // Use workflowId as the instance ID
  
  // Use the custom hook for live workflow data
  const {
    workflowInstance,
    loading,
    realTimeData,
    elicitationPrompt,
    waitingForAgent,
    respondingAgent,
    setElicitationPrompt,
    setWaitingForAgent,
    setRespondingAgent,
    setRealTimeData,
    setWorkflowInstance
  } = useLiveWorkflow(workflowInstanceId);

  // Local state for artifacts and UI interactions
  const [artifacts, setArtifacts] = useState([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [elicitationResponse, setElicitationResponse] = useState('');
  const [elicitationLoading, setElicitationLoading] = useState(false);
  
  // Fetch artifacts for the workflow (moved from hook to keep component-specific)
  const fetchArtifacts = useCallback(async () => {
    if (!workflowInstanceId) return;
    
    setLoadingArtifacts(true);
    try {
      const response = await fetch(`/api/workflows/${workflowInstanceId}/artifacts`);
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setArtifacts(data.artifacts || []);
        } else {
          console.warn('⚠️ Empty artifacts response');
        }
      } else if (response.status === 401) {
        console.warn('❌ Authentication failed for artifacts - stopping polling');
        return 'auth_failed';
      }
    } catch (error) {
      console.error('❌ Error fetching artifacts:', error);
    } finally {
      setLoadingArtifacts(false);
    }
  }, [workflowInstanceId]);

  // Periodically refresh artifacts (every 10 seconds)
  useEffect(() => {
    fetchArtifacts(); // Initial load
    
    const interval = setInterval(async () => {
      const result = await fetchArtifacts();
      if (result === 'auth_failed') {
        console.warn('Stopping artifacts polling due to authentication failure');
        clearInterval(interval);
      }
    }, 20000); // Refresh every 20 seconds
    return () => clearInterval(interval);
  }, [fetchArtifacts]);

  const triggerDemoEvents = async () => {
    try {
      const response = await fetch(`/api/test-pusher?workflowId=${workflowInstanceId}`);
      if (response.ok) {
        const result = await response.json();
      }
    } catch (error) {
      console.error('Failed to trigger demo events:', error);
    }
  };

  const handleElicitationSubmit = async () => {
    if (!elicitationResponse.trim()) return;

    try {
      setElicitationLoading(true);
      const response = await fetch(`/api/workflows/${workflowInstanceId}/resume-elicitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          elicitationResponse: elicitationResponse.trim(),
          agentId: elicitationPrompt?.agentId // Pass the agentId back to the backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit elicitation response');
      }
      setElicitationResponse(''); // Clear input
      setElicitationPrompt(null); // Clear prompt
      setElicitationLoading(false);
      // Workflow status will be updated via Pusher
    } catch (error) {
      console.error('Error submitting elicitation response:', error);
      setElicitationLoading(false);
    }
  };
  console.log({elicitationPrompt});

  // Unified message handler for both free chat and elicitation responses
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    try {
      // Debug: Log the current state to understand the flow
      console.log('🔍 [DEBUG] handleSendMessage called with:', {
        message,
        hasElicitationPrompt: !!elicitationPrompt,
        elicitationPromptDetails: elicitationPrompt ? {
          agentId: elicitationPrompt.agentId,
          instruction: elicitationPrompt.instruction?.substring(0, 100) + '...'
        } : null,
        currentAgent: realTimeData.currentAgent,
        workflowInstanceId
      });

      // If there's an active elicitation prompt, treat this as an elicitation response
      if (elicitationPrompt) {
        // Don't add message locally - let the backend handle it and real-time updates show it
        // This prevents duplicate messages and ensures consistency with database
        
        setElicitationLoading(true);
        setWaitingForAgent(true);
        setRespondingAgent(elicitationPrompt.agentId);
        setElicitationResponse(message); // Set the message as the response
        
        // Debug: Log what we're about to send
        console.log('🔍 [DEBUG] About to send elicitation response:', {
          message,
          messageType: typeof message,
          messageString: String(message),
          agentId: elicitationPrompt?.agentId
        });
        
        // const selectedNumber = parseInt(message.trim());
        // if (isNaN(selectedNumber) || selectedNumber < 1 || (elicitationPrompt.options && selectedNumber > elicitationPrompt.options.length)) {
        //     console.error("Invalid elicitation response: Please enter a number corresponding to an option.");
        //     // Optionally, display an error message to the user in the UI
        //     setElicitationLoading(false);
        //     setWaitingForAgent(false);
        //     setRespondingAgent(null);
        //     return; // Stop processing if input is invalid
        // }

        const requestBody = { 
          elicitationResponse: message, // Send the message
          agentId: elicitationPrompt?.agentId
        };
        
        // Debug: Log the request body being sent
        console.log('🔍 [DEBUG] Request body being sent:', requestBody);
        console.log('🔍 [DEBUG] Stringified body:', JSON.stringify(requestBody));
        
        const response = await fetch(`/api/workflows/${workflowInstanceId}/resume-elicitation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error('Failed to submit elicitation response');
        }

        setElicitationResponse('');
        setElicitationPrompt(null);
        setElicitationLoading(false);
      } else {
        // Regular free chat message - Use new chat API
        console.log('🔍 [DEBUG] Treating as regular chat message (no elicitation prompt)');
        try {
          // Add user message immediately to provide instant feedback
          const userMessage = {
            id: `user-msg-${Date.now()}`,
            from: 'user',
            fromName: 'You',
            content: message.trim(),
            timestamp: new Date().toISOString(),
            type: 'user_input'
          };
          
          console.log('🔍 [DEBUG] Adding user message to realTimeData:', userMessage);
          
          setRealTimeData(prev => ({
            ...prev,
            messages: [...prev.messages, userMessage].slice(-50)
          }));
          
          const response = await fetch(`/api/workflows/${workflowInstanceId}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: message.trim(),
              targetAgent: realTimeData.currentAgent // Send to current workflow agent
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send chat message');
          }

          const result = await response.json();
          
          // Messages will be delivered via real-time Pusher events
          // The API handles both user message and agent response
          console.log('✅ [FREE CHAT] Chat message sent successfully:', result);
          
        } catch (chatError) {
          console.error('Error sending free chat message:', chatError);
          
          // Add error message to chat
          const errorMessage = {
            id: `error-msg-${Date.now()}`,
            from: 'System',
            content: `❌ Failed to send message: ${chatError.message}`,
            timestamp: new Date().toISOString(),
            type: 'error'
          };
          
          setRealTimeData(prev => ({
            ...prev,
            messages: [...prev.messages, errorMessage].slice(-50)
          }));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setElicitationLoading(false);
      setWaitingForAgent(false);
      setRespondingAgent(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Helper function for file size formatting (used by GeneratedFiles component)
  const formatFileSize = (size) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
      fileSize /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(fileSize * 10) / 10} ${units[unitIndex]}`;
  };

  const downloadFile = async (filename) => {
    try {
      const response = await fetch(`/api/workflows/${workflowInstanceId}/artifacts/${filename}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download file:', filename);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const downloadAllFiles = async () => {
    try {
      const response = await fetch(`/api/workflows/${workflowInstanceId}/artifacts/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflowInstanceId}-artifacts.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download zip file');
      }
    } catch (error) {
      console.error('Error downloading zip:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflowInstance) {
    return (
      <div className="p-8">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Workflow Not Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              The workflow instance could not be found or has been deleted.
            </p>
            <div className="mt-4 space-x-2">
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
              <button 
                onClick={() => window.history.back()} 
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Go Back
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <WorkflowErrorWrapper
      title="Live workflow page encountered an error"
      onError={(error, errorInfo) => {
        console.error('LiveWorkflowPage error:', error, errorInfo);
      }}
      onReset={() => {
        // Reset state on error recovery
        setRealTimeData(prev => ({
          ...prev,
          messages: [],
          isConnected: false
        }));
        setElicitationPrompt(null);
      }}
    >
      <div className="p-8 space-y-6">
        {/* Header Section */}
        <WorkflowHeader
          workflowInstance={workflowInstance}
          realTimeData={realTimeData}
          onTriggerDemo={triggerDemoEvents}
          formatTimestamp={formatTimestamp}
        />

        {/* Progress Section */}
        <WorkflowProgress
          realTimeData={realTimeData}
          workflowInstance={workflowInstance}
          formatTimestamp={formatTimestamp}
        />

        {/* Communication Section */}
        <WorkflowControls
          realTimeData={realTimeData}
          elicitationPrompt={elicitationPrompt}
          elicitationResponse={elicitationResponse}
          elicitationLoading={elicitationLoading}
          waitingForAgent={waitingForAgent}
          respondingAgent={respondingAgent}
          workflowInstance={workflowInstance}
          onSendMessage={handleSendMessage}
          onElicitationResponseChange={setElicitationResponse}
          onElicitationSubmit={handleElicitationSubmit}
        />

        {/* Artifacts Section */}
        <WorkflowArtifacts
          workflowInstanceId={workflowInstanceId}
          artifacts={artifacts}
          loadingArtifacts={loadingArtifacts}
          onRefreshArtifacts={fetchArtifacts}
          onDownloadFile={downloadFile}
          onDownloadAll={downloadAllFiles}
          formatTimestamp={formatTimestamp}
          formatFileSize={formatFileSize}
        />
      </div>
    </WorkflowErrorWrapper>
  );
};

export default LiveWorkflow;
