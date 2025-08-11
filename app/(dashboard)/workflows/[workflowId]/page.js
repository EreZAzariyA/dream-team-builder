'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/common/Card';
import { ArrowLeft, Loader2, CheckCircle, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePusherSimple } from '../../../../lib/pusher/SimplePusherClient';
import { CHANNELS, EVENTS } from '../../../../lib/pusher/config';

const WorkflowDetailPage = () => {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowInstanceId, setWorkflowInstanceId] = useState(null);
  const [isDiagramCollapsed, setIsDiagramCollapsed] = useState(true);

  const [autoNavCountdown, setAutoNavCountdown] = useState(0);
  const { workflowId } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  // Pusher integration for real-time updates
  const { connected: pusherConnected, pusher: pusherClient } = usePusherSimple();

  useEffect(() => {
    if (workflowId) {
      const fetchWorkflow = async () => {
        try {
          const response = await fetch(`/api/workflows/${workflowId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch workflow');
          }
          const data = await response.json();
          setWorkflow(data);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      };

      fetchWorkflow();
    }
  }, [workflowId]);

  // Auto-navigate to live monitoring when workflow instance is created
  useEffect(() => {
    if (!workflowInstanceId) return;

    console.info('🚀 Workflow instance created, starting auto-navigation countdown');
    setAutoNavCountdown(2);
    
    const countdownInterval = setInterval(() => {
      setAutoNavCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Schedule navigation for next tick to avoid setState during render
          setTimeout(() => {
            console.info('🚀 Auto-navigating to live monitoring...');
            router.push(`/workflows/live/${workflowInstanceId}`);
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [workflowInstanceId, router]);

  // Subscribe to workflow updates when instance is created
  useEffect(() => {
    if (!workflowInstanceId || !pusherClient || !pusherConnected) return;

    console.info('🔌 Subscribing to workflow instance:', workflowInstanceId);
    const channelName = CHANNELS.WORKFLOW(workflowInstanceId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind(EVENTS.WORKFLOW_UPDATE, (data) => {
      console.info('🔄 Workflow update:', data);
      if (data.status) {
        setLaunchStatus(prev => `${prev} • Status: ${data.status}`);
      }
    });

    return () => {
      console.info('🧹 Unsubscribing from workflow:', workflowInstanceId);
      if (channel) {
        channel.unbind_all();
        pusherClient.unsubscribe(channelName);
      }
    };
  }, [workflowInstanceId, pusherClient, pusherConnected]);

  const handleLaunch = async () => {
    if (!userPrompt.trim()) {
      setLaunchStatus('Please enter a project description before launching the workflow.');
      return;
    }
    
    setIsLaunching(true);
    setLaunchStatus('Starting workflow...');
    
    console.info('🚀 Starting workflow launch...', { workflowId, userPrompt: userPrompt.trim() });
    
    try {
      const requestBody = {
        userPrompt: userPrompt.trim(),
        name: projectName.trim() || `${workflowId} Project`,
        description: description.trim() || `AI-generated project using ${workflowId} workflow`
      };
      
      console.info('📤 Sending request:', requestBody);
      
      const response = await fetch(`/api/workflows/${workflowId}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      console.info('📥 Response received:', { status: response.status, ok: response.ok });
      
      // Better error handling for JSON parsing
      let result;
      let responseText;
      try {
        responseText = await response.text();
        console.info('📜 Response text length:', responseText.length);
        
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        result = JSON.parse(responseText);
        console.info('✅ Parsed result:', result);
      } catch (jsonError) {
        console.error('❌ JSON parsing error:', jsonError);
        console.error('Raw response text:', responseText);
        throw new Error(`Invalid response from server: ${jsonError.message}`);
      }
      
      if (!response.ok) {
        console.error('❌ API Error:', result);
        throw new Error(result.error || 'Failed to start workflow');
      }
      
      console.info('🎉 Workflow launched successfully:', result);
      setWorkflowInstanceId(result.workflowInstanceId);
      setLaunchStatus(`Workflow started successfully! Instance ID: ${result.workflowInstanceId}`);
      setIsLaunching(false);

      console.info('🚀 Workflow instance created:', result.workflowInstanceId);
    } catch (error) {
      console.error('❌ Launch error:', error);
      setLaunchStatus(`Error: ${error.message}`);
      setIsLaunching(false);
    }
  };

  // Test Pusher message sending
  const sendTestMessage = async (workflowInstanceId, message = 'Test message from workflow launch page') => {
    try {
      const response = await fetch('/api/pusher/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          target: {
            type: 'workflow',
            id: workflowInstanceId
          },
          userId: session?.user?.id // Use actual authenticated user ID
        })
      });
      
      if (response.ok) {
        console.info('✅ Test message sent successfully');
        return true;
      } else {
        console.error('❌ Failed to send test message');
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending test message:', error);
      return false;
    }
  };

  // Handle custom test message
  

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4 animate-pulse"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-8 animate-pulse"></div>
        <Card className="bg-white dark:bg-gray-800 shadow-md animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workflow) {
    return <div className="p-8">Workflow not found.</div>;
  }

  return (
    <div className="p-8">
      <Link href="/workflows" className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Workflows
      </Link>
      <h1 className="text-h1 font-semibold text-gray-800 dark:text-white">{workflow.name}</h1>
      <p className="text-body text-gray-600 dark:text-gray-400 mt-2 mb-8">{workflow.description}</p>

      <Card className="bg-white dark:bg-gray-800 shadow-md mb-8">
        <CardHeader>
          <CardTitle>Project Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name (Optional)
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Task Manager App"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label htmlFor="userPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="userPrompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Describe your project in detail. For example: 'I want to build a To-Do App with JWT authentication, user registration, task management, and a clean modern UI'"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any additional requirements, preferences, or constraints"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardHeader>
          <div 
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsDiagramCollapsed(!isDiagramCollapsed)}
          >
            <CardTitle>Workflow Diagram</CardTitle>
            <div className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors">
              <ChevronDown 
                className={`w-5 h-5 transition-transform duration-300 ease-in-out ${
                  isDiagramCollapsed ? 'transform -rotate-90' : 'transform rotate-0'
                }`} 
              />
            </div>
          </div>
        </CardHeader>
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isDiagramCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
          }`}
        >
          <CardContent>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm text-gray-800 dark:text-gray-200">{workflow.flow_diagram}</pre>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="mt-8 flex flex-col items-end">
        <button 
          onClick={handleLaunch} 
          disabled={isLaunching || !userPrompt.trim()}
          className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 transition-colors disabled:bg-primary-400 disabled:cursor-not-allowed flex items-center"
        >
          {isLaunching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isLaunching ? 'Launching...' : 'Launch Workflow'}
        </button>
        {launchStatus && (
          <div className="mt-2">
            <p className={`text-sm ${launchStatus.includes('Failed') || launchStatus.includes('Please enter') ? 'text-red-500' : 'text-green-500'}`}>
              {launchStatus}
            </p>
            {launchStatus.includes('Instance ID:') && (
              <div className="mt-3 space-y-2">
                {autoNavCountdown > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Auto-navigating to live monitoring in {autoNavCountdown} seconds...
                    </span>
                    <button
                      onClick={() => {
                        setAutoNavCountdown(0);
                        router.push(`/workflows/live/${workflowInstanceId}`);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Go Now
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => {
                    const instanceId = launchStatus.match(/Instance ID: (\w+)/)?.[1];
                    if (instanceId) {
                      router.push(`/workflows/live/${instanceId}`);
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  View Live Progress →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default WorkflowDetailPage;
