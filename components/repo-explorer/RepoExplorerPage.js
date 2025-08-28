'use client';

import { useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRepositoryData } from './hooks/useRepositoryData';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  CodeBracketSquareIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  Cog6ToothIcon,
  LinkIcon,
  ArrowRightIcon} from '@heroicons/react/24/outline';

import GitHubRepositorySelector from '../github/GitHubRepositorySelector';
import RepoAnalysisStatus from './components/RepoAnalysisStatus';
import RepoOverview from './components/RepoOverview';
import FileTreeViewer from './components/FileTreeViewer';
import RepoChatInterface from './components/RepoChatInterface';
import RepoInsights from './components/RepoInsights';
import GitGraph from './components/GitGraph';
import WorkflowSelector from './components/WorkflowSelector.js';
import AtWork from '../ui/AtWork';

/**
 * Repository Explorer Main Page
 * 
 * Features:
 * - GitHub repository selection using existing integration
 * - Repository analysis and insights with React Query caching
 * - File tree exploration
 * - AI-powered chat about code
 * - Code insights and suggestions
 * - Persistent state across tab switches
 */
export const RepoExplorerPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use custom hook for repository data management
  const {
    selectedRepository,
    activeTab,
    setActiveTab,
    selectRepository,
    clearSelection,
    startAnalysis,
    regenerateSummary,
    useRepositoryStatus,
    useAnalysisPolling,
    isStartingAnalysis,
    isRegeneratingSummary,
    analysisError,
    regenerationError,
    queryClient,
  } = useRepositoryData();
  const isProduction = process.env.NODE_ENV === 'production';

  useEffect(() => {
    const repoParam = searchParams.get('repo'); // e.g., "EreZAzariyA/video-scraper-challenge"  
    const idParam = searchParams.get('id'); // e.g., "1037566264"
    
    if (repoParam && idParam && !selectedRepository) {
      // Parse the repo parameter (format: owner/name)
      const [owner, name] = repoParam.split('/');
      
      if (owner && name) {
        // Create a repository object from URL parameters
        const repositoryFromUrl = {
          id: parseInt(idParam),
          name: name,
          full_name: repoParam,
          owner: {
            login: owner
          }
        };
        
        // Select the repository to restore state
        selectRepository(repositoryFromUrl);
        
        console.log('🔗 Restored repository from URL:', {
          repo: repoParam,
          id: idParam,
          repository: repositoryFromUrl
        });
      }
    }
  }, [searchParams, selectedRepository, selectRepository]);

  // Get repository analysis status with React Query caching
  const { 
    data: analysisData, 
    isLoading: isLoadingStatus,
    error: statusError 
  } = useRepositoryStatus(selectedRepository);

  // Real-time analysis updates via Pusher (with polling fallback)
  const isAnalyzing = (analysisData?.status === 'processing' || 
                      analysisData?.status === 'pending' || 
                      analysisData?.status === 'analyzing' || 
                      isStartingAnalysis) && 
                      analysisData?.status !== 'completed' && 
                      analysisData?.status !== 'failed';
  
  
  // Only enable polling for genuinely in-progress analyses
  const shouldPoll = isAnalyzing && analysisData?.status !== 'completed' && analysisData?.status !== 'failed';
  const { data: pollingData } = useAnalysisPolling(analysisData?.id, shouldPoll);

  // Handle repository selection with URL persistence
  const handleAnalyzeRepository = async (repository) => {
    if (!repository) return;
    
    // Update URL parameters
    const params = new URLSearchParams(searchParams);
    params.set('repo', repository.full_name);
    params.set('id', repository.id);
    router.replace(`/repo-explorer?${params.toString()}`);
    
    // Start analysis using our hook
    await startAnalysis(repository);
  };

  const handleRegenerateSummary = async () => {
    if (!analysisData?.id) return;
    await regenerateSummary(analysisData.id);
  };

  const handleClearRepository = () => {
    clearSelection();
    router.replace('/repo-explorer');
  };

  const tabs = useMemo(() => [
    { id: 'overview', name: 'Overview', icon: DocumentTextIcon },
    { id: 'files', name: 'File Tree', icon: CodeBracketSquareIcon },
    { id: 'git', name: 'Git History', icon: ClockIcon },
    { id: 'workflows', name: 'Workflows', icon: Cog6ToothIcon },
    { id: 'chat', name: 'Chat', icon: ChatBubbleLeftRightIcon },
    { id: 'insights', name: 'Insights', icon: LightBulbIcon },
  ], []);

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Authentication Required</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please sign in to use the Repository Explorer.</p>
        </div>
      </div>
    );
  }

  // Check if user has GitHub integration
  if (!session.user.githubAccessToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">GitHub Integration Required</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            To explore and analyze repositories, you need to connect your GitHub account first.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/integrations')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Connect GitHub Account
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            This will redirect you to the integrations page where you can securely connect your GitHub account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Repository Explorer</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Analyze and explore GitHub repositories with AI</p>
            </div>
            {selectedRepository && (
              <button
                onClick={handleClearRepository}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {!selectedRepository ? (
          /* Repository Selection */
          <div className="text-center">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Select a Repository</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose a GitHub repository to analyze and explore
            </p>
            <div className="mt-6">
              <GitHubRepositorySelector onRepositorySelect={handleAnalyzeRepository} />
            </div>
          </div>
        ) : (
          /* Repository Analysis Interface */
          <div className="space-y-6">
            {/* Repository Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {selectedRepository.owner?.avatar_url && (
                      <img 
                        className="h-10 w-10 rounded-full" 
                        src={selectedRepository.owner.avatar_url} 
                        alt={selectedRepository.owner.login}
                      />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedRepository.full_name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedRepository.description || 'No description available'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Analysis Status */}
              {(isAnalyzing || analysisData) && (
                <div className="mt-4">
                  <RepoAnalysisStatus
                    analysisId={analysisData?.id}
                    isAnalyzing={isAnalyzing}
                    realtimeProgress={pollingData}
                    analysisData={analysisData}
                    repository={selectedRepository}
                    showFileProcessing={true}
                    onAnalysisComplete={() => {
                      // Invalidate repository status query when analysis completes via Pusher
                      queryClient.invalidateQueries({
                        queryKey: ['repository-status', selectedRepository?.owner?.login, selectedRepository?.name]
                      });
                    }}
                  />
                </div>
              )}
            </div>

            {/* Error Handling */}
            {(analysisError || statusError || regenerationError) && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Error occurred
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      {analysisError?.message || statusError?.message || regenerationError?.message}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            {analysisData && !isAnalyzing && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="border-b border-gray-200 dark:border-gray-700">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab.id
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span>{tab.name}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {activeTab === 'overview' && analysisData?.status === 'completed' && (
                        <RepoOverview 
                          repository={selectedRepository}
                          analysisData={analysisData}
                          onRegenerateSummary={handleRegenerateSummary}
                          isRefreshingSummary={isRegeneratingSummary}
                        />
                      )}
                      {activeTab === 'overview' && analysisData?.status !== 'completed' && (
                        <div className="max-w-2xl mx-auto">
                          {/* Show the RepoAnalysisStatus component in overview tab during analysis */}
                          <RepoAnalysisStatus
                            analysisId={analysisData?.id}
                            isAnalyzing={isAnalyzing}
                            realtimeProgress={pollingData}
                            analysisData={analysisData}
                            repository={selectedRepository}
                            showFileProcessing={true}
                            onAnalysisComplete={() => {
                              queryClient.invalidateQueries({
                                queryKey: repositoryStatusQuery.queryKey
                              });
                            }}
                          />
                        </div>
                      )}
                      {activeTab === 'files' && analysisData?.status === 'completed' && (
                        <FileTreeViewer 
                          repository={selectedRepository}
                          analysisData={analysisData}
                        />
                      )}
                      {activeTab === 'files' && analysisData?.status !== 'completed' && (
                        <div className="text-center py-12">
                          <p className="text-gray-500 dark:text-gray-400">File tree will be available after analysis completes.</p>
                        </div>
                      )}
                      {activeTab === 'git' && (
                        <GitGraph 
                          repository={selectedRepository}
                          analysisData={analysisData}
                        />
                      )}
                      {activeTab === 'workflows' && (
                        <>
                        {isProduction ? (
                          <AtWork
                            title="Repository Explorer Feature"
                            subtitle="We're working hard to bring you advanced repository analysis capabilities. This feature will be available soon!"
                          />
                        ) : (
                          <WorkflowSelector 
                            repository={selectedRepository}
                            analysisData={analysisData}
                          />
                        )}
                        </>
                      )}
                      {activeTab === 'chat' && (
                        <RepoChatInterface 
                          repository={selectedRepository}
                          analysisData={analysisData}
                        />
                      )}
                      {activeTab === 'insights' && analysisData?.status === 'completed' && (
                        <RepoInsights 
                          repository={selectedRepository}
                          analysisData={analysisData}
                        />
                      )}
                      {activeTab === 'insights' && analysisData?.status !== 'completed' && (
                        <div className="text-center py-12">
                          <p className="text-gray-500 dark:text-gray-400">Insights will be available after analysis completes.</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoExplorerPage;