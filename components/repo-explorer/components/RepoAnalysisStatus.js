'use client';

import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { pusherClient } from '@/lib/pusher/config';

// Helper function to format file sizes
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const RepoAnalysisStatus = ({ analysisId, isAnalyzing, realtimeProgress: externalProgress, analysisData, repository, showFileProcessing = false, onAnalysisComplete }) => {
  const [localProgress, setLocalProgress] = useState({
    step: 'initializing',
    message: 'Starting analysis...',
    progress: 0
  });
  const [progressSteps, setProgressSteps] = useState({});
  const [fileProcessingLog, setFileProcessingLog] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  
  // Use external progress (SSE/polling) if available, otherwise use local Pusher state
  const realtimeProgress = externalProgress || localProgress;
  
  // Debug progress data sources
  useEffect(() => {
    console.log('🔍 RepoAnalysisStatus progress data:', {
      externalProgress,
      localProgress,
      realtimeProgress,
      isAnalyzing,
      analysisId
    });
  }, [externalProgress, localProgress, realtimeProgress, isAnalyzing, analysisId]);
  
  // Pusher integration for real-time updates
  useEffect(() => {
    // Only subscribe if analysis is actively running (not completed/failed)
    if (!analysisId || !isAnalyzing || !pusherClient || analysisData?.status === 'completed' || analysisData?.status === 'failed') {
      console.log('🔍 Pusher subscription skipped:', { analysisId, isAnalyzing, hasPusherClient: !!pusherClient, status: analysisData?.status });
      return;
    }

    const channelName = `repo-analysis-${analysisId}`;
    console.log('🔍 Setting up Pusher subscription to:', channelName);
    console.log('🔍 Pusher client state:', pusherClient.connection.state);
    
    const handleProgressUpdate = (data) => {
      console.log('🔍 Pusher progress update received:', data);
      
      // Handle different data formats (SSE vs Pusher)
      const step = data.step || (data.status ? `step-${data.status}` : 'processing');
      const message = data.message || `${data.status || 'Processing'}...`;
      const progress = typeof data.progress === 'number' ? data.progress : 
                      (data.status === 'completed' ? 100 : 
                       data.status === 'processing' ? 50 : 0);
      
      // Progress update received
      setLocalProgress({
        step,
        message,
        progress
      });
      
      // Update step status based on current step
      setProgressSteps(prev => {
        const newSteps = { ...prev };
        
        // Map analysis steps to UI steps
        switch (data.step) {
          case 'initializing':
          case 'git-setup':
          case 'repo-structure':
          case 'repo-structure-complete':
            newSteps.fetch = data.step === 'repo-structure-complete' ? 'completed' : 'in_progress';
            break;
          case 'file-indexing':
          case 'file-processing':
          case 'file-index-complete':
            newSteps.fetch = 'completed';
            newSteps.index = data.step === 'file-index-complete' ? 'completed' : 'in_progress';
            break;
          case 'metrics':
            newSteps.fetch = 'completed';
            newSteps.index = 'completed';
            newSteps.metrics = 'in_progress';
            break;
          case 'ai-summary':
            newSteps.fetch = 'completed';
            newSteps.index = 'completed';
            newSteps.metrics = 'completed';
            newSteps.summary = 'in_progress';
            break;
          case 'saving':
          case 'completed':
            newSteps.fetch = 'completed';
            newSteps.index = 'completed';
            newSteps.metrics = 'completed';
            newSteps.summary = 'completed';
            break;
        }
        
        return newSteps;
      });
    };

    const handleAnalysisComplete = (data) => {
      console.log('🔍 Pusher analysis complete received:', data);
      // Analysis complete
      setLocalProgress({
        step: 'completed',
        message: data.message,
        progress: 100
      });
      setProgressSteps({
        fetch: 'completed',
        index: 'completed',
        metrics: 'completed',
        summary: 'completed'
      });
      
      // Trigger React Query invalidation
      if (onAnalysisComplete) {
        onAnalysisComplete();
      }
    };

    const handleAnalysisError = (data) => {
      // Analysis error occurred
      setLocalProgress({
        step: 'error',
        message: data.message,
        progress: -1
      });
    };

    const handleFileStatus = (data) => {
      if (data.file) {
        // Update current file being processed
        if (data.status === 'will be processed') {
          setCurrentFile({
            file: data.file,
            status: 'processing...',
            timestamp: new Date().toLocaleTimeString()
          });
        } else if (data.status && data.status.includes('processed')) {
          // File is done processing - update status and clear after delay
          setCurrentFile(prev => prev ? {
            ...prev,
            status: 'completed'
          } : null);
          
          // Clear the banner after a brief delay
          setTimeout(() => {
            setCurrentFile(null);
          }, 800); // Keep visible for 800ms before clearing
        } else {
          // For skipped/failed files, clear immediately
          setCurrentFile(null);
        }
        
        // Add to log
        setFileProcessingLog(prev => {
          // Keep only last 50 entries to prevent memory issues
          const newLog = [...prev, {
            file: data.file,
            status: data.status,
            timestamp: new Date().toLocaleTimeString()
          }];
          return newLog;
        });
      }
    };

    // Setup Pusher connection monitoring
    const handleConnectionStateChange = (state) => {
      console.log('🔍 Pusher connection state changed:', state);
    };
    
    const handleConnectionError = (error) => {
      console.error('🔍 Pusher connection error:', error);
    };
    
    pusherClient.connection.bind('state_change', handleConnectionStateChange);
    pusherClient.connection.bind('error', handleConnectionError);

    // Setup Pusher subscription
    try {
      const channel = pusherClient.subscribe(channelName);
      
      // Add subscription event handlers
      channel.bind('pusher:subscription_succeeded', () => {
        console.log('✅ Successfully subscribed to channel:', channelName);
      });
      
      channel.bind('pusher:subscription_error', (error) => {
        console.error('❌ Failed to subscribe to channel:', channelName, error);
      });
      
      // Bind event handlers
      channel.bind('analysis-progress', handleProgressUpdate);
      channel.bind('analysis-complete', handleAnalysisComplete);
      channel.bind('analysis-error', handleAnalysisError);
      channel.bind('file-status', handleFileStatus);
      
      console.log('🔍 Pusher event handlers bound to channel:', channelName);
      
      // Cleanup function
      return () => {
        try {
          channel.unbind('analysis-progress', handleProgressUpdate);
          channel.unbind('analysis-complete', handleAnalysisComplete);
          channel.unbind('analysis-error', handleAnalysisError);
          channel.unbind('file-status', handleFileStatus);
          channel.unbind('pusher:subscription_succeeded');
          channel.unbind('pusher:subscription_error');
          pusherClient.unsubscribe(channelName);
          
          // Unbind connection listeners
          pusherClient.connection.unbind('state_change', handleConnectionStateChange);
          pusherClient.connection.unbind('error', handleConnectionError);
          
          console.log('🔍 Pusher cleanup completed for:', channelName);
        } catch (error) {
          console.error('🔍 Pusher cleanup error:', error);
        }
      };
    } catch (error) {
      // Error setting up subscription
    }
  }, [analysisId, isAnalyzing, analysisData?.status]);
  
  const getFileStatusIcon = (status) => {
    if (status.includes('processed')) return '✅';
    if (status.includes('will be processed')) return '🔍';
    if (status.includes('skipped')) return '⏭️';
    if (status.includes('failed')) return '❌';
    return '📄';
  };
  
  const getStatusIcon = () => {
    if (isAnalyzing) {
      return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (analysisData?.status === 'completed') {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
    if (analysisData?.status === 'failed') {
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    }
    return <ClockIcon className="w-5 h-5 text-gray-400" />;
  };

  const getStatusText = () => {
    if (isAnalyzing) {
      if (fileProcessingLog.length > 0) {
        return `Processing files... (${fileProcessingLog.length} processed)`;
      }
      return realtimeProgress.message || 'Analyzing repository...';
    }
    if (analysisData?.status === 'completed') return 'Analysis complete';
    if (analysisData?.status === 'failed') return 'Analysis failed';
    return 'Ready to analyze';
  };

  const getStatusColor = () => {
    if (isAnalyzing) return 'text-blue-600 dark:text-blue-400';
    if (analysisData?.status === 'completed') return 'text-green-600 dark:text-green-400';
    if (analysisData?.status === 'failed') return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const analysisSteps = [
    { id: 'fetch', name: 'Fetching repository', icon: CodeBracketIcon },
    { id: 'index', name: 'Building file index', icon: DocumentTextIcon },
    { id: 'metrics', name: 'Calculating metrics', icon: ChartBarIcon },
    { id: 'summary', name: 'Generating AI summary', icon: DocumentTextIcon },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          {getStatusIcon()}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              {repository?.name}
            </h3>
            <p className={`text-sm ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        {isAnalyzing && (
          <div className="space-y-3">
            {/* Progress Bar */}
            {realtimeProgress.progress >= 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>Progress</span>
                  <span>{realtimeProgress.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${realtimeProgress.progress}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${realtimeProgress.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
            
            {analysisSteps.map((step, index) => {
              const Icon = step.icon;
              const stepStatus = progressSteps[step.id] || 'pending'; // pending, in_progress, completed

              const isComplete = stepStatus === 'completed';
              const isActive = stepStatus === 'in_progress';
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center space-x-3"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isComplete 
                      ? 'bg-green-100 dark:bg-green-900/20' 
                      : isActive 
                      ? 'bg-blue-100 dark:bg-blue-900/20' 
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {isComplete ? (
                      <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    ) : isActive ? (
                      <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    isComplete 
                      ? 'text-green-600 dark:text-green-400' 
                      : isActive 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.name}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Currently Processing File */}
        {isAnalyzing && currentFile && (
          <div className={`mt-4 p-3 rounded-lg border transition-colors duration-300 ${
            currentFile.status === 'completed' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full ${
                currentFile.status === 'completed'
                  ? 'bg-green-500'
                  : 'bg-blue-500 animate-pulse'
              }`}></div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${
                  currentFile.status === 'completed'
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-blue-900 dark:text-blue-100'
                }`}>
                  {currentFile.status === 'completed' ? 'File Processed' : 'Currently Processing'}
                </div>
                <div className={`text-xs truncate ${
                  currentFile.status === 'completed'
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`} title={currentFile.file}>
                  📄 {currentFile.file}
                </div>
              </div>
              <div className={`text-xs ${
                currentFile.status === 'completed'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`}>
                {currentFile.timestamp}
              </div>
            </div>
          </div>
        )}

        {/* File Processing Status (when no individual files are shown) */}
        {isAnalyzing && fileProcessingLog.length === 0 && !currentFile && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                🔍 Processing repository files... 
                <span className="text-xs block text-yellow-600 dark:text-yellow-400 mt-1">
                  (File details will appear once processing begins)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* File Processing Log */}
        {showFileProcessing && fileProcessingLog.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                File Processing Log
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {fileProcessingLog.length} files processed
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600">
              <div className="space-y-1 font-mono text-xs">
                {fileProcessingLog.slice().reverse().map((logEntry, index) => (
                  <motion.div 
                    key={`${logEntry.file}-${logEntry.timestamp}-${index}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-2 py-1 transition-colors"
                  >
                    <span className="text-gray-400 dark:text-gray-500 w-14 flex-shrink-0 text-xs">
                      {logEntry.timestamp}
                    </span>
                    <span className="flex-shrink-0 w-5 text-center">
                      {getFileStatusIcon(logEntry.status)}
                    </span>
                    <span className="truncate flex-1 text-xs" title={logEntry.file}>
                      {logEntry.file}
                    </span>
                    <span className="text-xs flex-shrink-0 text-right font-medium" style={{
                      color: logEntry.status.includes('processed') ? '#059669' :
                             logEntry.status.includes('skipped') ? '#d97706' :
                             logEntry.status.includes('failed') ? '#dc2626' : '#6b7280'
                    }}>
                      {logEntry.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analysis Summary */}
        {analysisData?.status === 'completed' && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Files:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {analysisData.metrics?.fileCount || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Languages:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {analysisData.metrics?.languageCount || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">LOC:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {analysisData.metrics?.totalLines?.toLocaleString() || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Size:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {analysisData.metrics?.totalSize ? 
                    formatFileSize(analysisData.metrics.totalSize) : 
                    '0 B'
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {analysisData?.status === 'failed' && analysisData.error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">
              {analysisData.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(RepoAnalysisStatus);