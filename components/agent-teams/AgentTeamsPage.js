'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAgentTeamsData } from './hooks/useAgentTeamsData';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import PageHeader from './components/PageHeader';
import TeamGrid from './components/TeamGrid';
import TeamComparison from './components/TeamComparison';
import WorkflowSelectionModal from './components/WorkflowSelectionModal';
import GitHubWorkflowModal from './components/GitHubWorkflowModal';
import WorkflowChatSection from './components/WorkflowChatSection';
import DeploymentHistory from './components/DeploymentHistory';
import DeploymentStatusIndicator from './components/DeploymentStatusIndicator';
import DeploymentAnalytics from './components/DeploymentAnalytics';
import GitHubWorkflowLauncher from '../workflows/GitHubWorkflowLauncher';

const AgentTeamsPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { teamConfigs, loading, error } = useAgentTeamsData();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [deployedWorkflows, setDeployedWorkflows] = useState([]);
  const [selectedChatWorkflow, setSelectedChatWorkflow] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [deploymentError, setDeploymentError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showGitHubLauncher, setShowGitHubLauncher] = useState(false);

  // Debug function to check active deployments
  const handleGetDebugInfo = async () => {
    try {
      const response = await fetch('/api/agent-teams/cleanup', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await response.json();
      setDebugInfo(result);
      
      if (result.success) {
        console.log('🔍 Active deployments:', result.activeDeployments);
      } else {
        console.error('❌ Debug info failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Debug request failed:', error);
      setDebugInfo({ error: error.message });
    }
  };

  // Cleanup function for stuck deployments
  const handleCleanupStuckDeployments = async () => {
    try {
      const response = await fetch('/api/agent-teams/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup_failed' }),
      });

      const result = await response.json();

      if (result.success) {
        alert(
          `✅ Cleanup Successful!\n\n` +
          `Cleaned up ${result.cleanedCount} stuck deployments.\n\n` +
          `You can now deploy new teams.`
        );
      } else {
        alert(`❌ Cleanup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      alert(`❌ Cleanup request failed: ${error.message}`);
    }
  };

  // Force cleanup ALL deployments (for debugging)
  const handleForceCleanupAll = async () => {
    if (!confirm('⚠️ This will FORCE cleanup ALL active deployments. Are you sure?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/agent-teams/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'force_cleanup_all' }),
      });

      const result = await response.json();

      if (result.success) {
        alert(
          `✅ Force Cleanup Successful!\n\n` +
          `Force cleaned ${result.cleanedCount} deployments.\n\n` +
          `You can now deploy new teams.`
        );
        // Refresh debug info
        handleGetDebugInfo();
      } else {
        alert(`❌ Force cleanup failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Force cleanup error:', error);
      alert(`❌ Force cleanup request failed: ${error.message}`);
    }
  };

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
    setIsWorkflowModalOpen(true);
  };

  const handleGitHubDeploy = (team) => {
    setSelectedTeam(team);
    setIsGitHubModalOpen(true);
  };

  const handleModalClose = () => {
    setIsWorkflowModalOpen(false);
    setSelectedTeam(null);
  };

  const handleGitHubModalClose = () => {
    setIsGitHubModalOpen(false);
    setSelectedTeam(null);
  };

  const handleGitHubWorkflowDeploy = async (team, workflow, projectContext) => {
    try {
      console.log('🐙 Deploying GitHub workflow:', { 
        team: team.name, 
        workflow: workflow?.name, 
        repository: projectContext.repository?.full_name,
        targetBranch: projectContext.targetBranch
      });
      
      // Optional initial prompt for GitHub workflows
      const userPrompt = prompt(
        `🐙 Starting ${team.name} + GitHub Integration\n\n` +
        `Repository: ${projectContext.repository.full_name}\n` +
        `Branch: ${projectContext.targetBranch}\n` +
        `${workflow ? `Workflow: ${workflow.name}\n` : 'Mode: GitHub story development\n'}` +
        `${projectContext.type ? `Project Type: ${projectContext.type}\n` : ''}` +
        `${projectContext.scope ? `Project Scope: ${projectContext.scope}\n` : ''}\n` +
        `➤ You can leave this empty to start immediately\n` +
        `➤ The agents will analyze the repository and ask for clarification\n` +
        `➤ Or provide specific instructions for the repository work\n\n` +
        `Optional instructions for repository work:`,
        ``
      );
      
      const finalPrompt = userPrompt?.trim() || null;
      
      // Close modal and show loading state
      handleGitHubModalClose();
      setIsDeploying(true);
      setDeploymentStatus(`Deploying ${team.name} to ${projectContext.repository.name}...`);
      setDeploymentError(null);
      
      // Prepare GitHub deployment payload
      const deploymentPayload = {
        teamId: team.id,
        workflowId: workflow?.id || null,
        projectContext: {
          type: projectContext.type || null,
          scope: projectContext.scope || null,
          githubMode: true,
          repository: {
            id: projectContext.repository.id,
            name: projectContext.repository.name,
            full_name: projectContext.repository.full_name,
            owner: projectContext.repository.owner.login,
            private: projectContext.repository.private,
            language: projectContext.repository.language
          },
          targetBranch: projectContext.targetBranch || 'main'
        },
        userPrompt: finalPrompt,
      };
      
      console.log('📤 Sending GitHub deployment request:', deploymentPayload);
      
      // Call GitHub deployment API
      const response = await fetch('/api/agent-teams/deploy-github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deploymentPayload),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ GitHub deployment successful:', result);
        setDeploymentStatus('✅ GitHub deployment successful!');
        
        // Add deployed workflow to the list
        if (result.workflowInstanceId) {
          const deployedWorkflow = {
            workflowInstanceId: result.workflowInstanceId,
            teamName: result.teamName || `${team.name} + GitHub`,
            teamInstanceId: result.teamInstanceId,
            status: result.teamStatus || 'active',
            deployedAt: new Date().toISOString(),
            githubMode: true,
            repository: projectContext.repository
          };
          
          setDeployedWorkflows(prev => [...prev, deployedWorkflow]);
          setSelectedChatWorkflow(deployedWorkflow);
        }
        
        // Auto-redirect to live workflow
        setDeploymentStatus(`✅ GitHub deployment successful! Redirecting to live workflow...`);
        
        if (result.workflowInstanceId) {
          setTimeout(() => {
            console.log(`🔀 Auto-redirecting to GitHub workflow: ${result.workflowInstanceId}`);
            router.push(`/agent-teams/${result.teamInstanceId}/${result.workflowInstanceId}/live`);
          }, 1500);
        } else {
          setTimeout(() => {
            setIsDeploying(false);
            setDeploymentStatus('');
          }, 2000);
        }
        
      } else {
        console.error('❌ GitHub deployment failed:', result);
        setDeploymentStatus('❌ GitHub deployment failed');
        
        alert(
          `❌ GitHub Deployment Failed\n\n` +
          `Error: ${result.error}\n` +
          `${result.details ? `Details: ${result.details}\n` : ''}` +
          `Repository: ${projectContext.repository.full_name}\n` +
          `\nPlease check your GitHub access and try again.`
        );
        
        setIsDeploying(false);
        setTimeout(() => setDeploymentStatus(''), 3000);
      }
      
    } catch (error) {
      console.error('❌ GitHub deployment request failed:', error);
      setDeploymentStatus('❌ GitHub request failed');
      setDeploymentError(error.message);
      
      setIsDeploying(false);
      setTimeout(() => {
        setDeploymentStatus('');
        setDeploymentError(null);
      }, 10000);
    }
  };

  const handleDeploy = async (team, workflow, projectContext) => {
    // Handle GitHub deployment differently
    if (projectContext?.githubMode) {
      return handleGitHubWorkflowDeploy(team, workflow, projectContext);
    }
    try {
      console.log('🚀 Deploying team:', { team: team.name, workflow: workflow?.name, projectContext });
      
      // Optional initial prompt - user can skip and agents will ask for clarification
      const userPrompt = prompt(
        `🚀 Starting ${team.name} Team\n\n` +
        `${workflow ? `Workflow: ${workflow.name}\n` : 'Mode: Story-driven development\n'}` +
        `${projectContext.type ? `Project Type: ${projectContext.type}\n` : ''}` +
        `${projectContext.scope ? `Project Scope: ${projectContext.scope}\n` : ''}\n` +
        `➤ You can leave this empty and click OK to start immediately\n` +
        `➤ The agents will ask for clarification during the workflow (official BMAD methodology)\n` +
        `➤ Or provide an initial description if you prefer\n\n` +
        `Optional project description:`,
        ``
      );
      
      // If user provides input, use it; otherwise let agents ask for clarification
      const finalPrompt = userPrompt?.trim() || null;
      
      // Close appropriate modal and show loading state
      if (projectContext?.githubMode) {
        handleGitHubModalClose();
      } else {
        handleModalClose();
      }
      setIsDeploying(true);
      setDeploymentStatus(`Deploying ${team.name}...`);
      setDeploymentError(null);
      
      // Show deployment starting notification
      console.log(`🚀 Starting deployment for ${team.name}...`);
      
      // Prepare deployment payload
      const deploymentPayload = {
        teamId: team.id,
        workflowId: workflow?.id || null, // null for story-driven teams
        projectContext: {
          type: projectContext.type || null,
          scope: projectContext.scope || null,
        },
        userPrompt: finalPrompt,
      };
      
      console.log('📤 Sending deployment request:', deploymentPayload);
      
      // Call team deployment API
      const response = await fetch('/api/agent-teams/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deploymentPayload),
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Team deployment successful:', result);
        setDeploymentStatus('✅ Deployment successful!');
        
        // Add deployed workflow to the list
        if (result.workflowInstanceId) {
          const deployedWorkflow = {
            workflowInstanceId: result.workflowInstanceId,
            teamName: result.teamName || team.name,
            teamInstanceId: result.teamInstanceId,
            status: result.teamStatus || 'active',
            deployedAt: new Date().toISOString()
          };
          
          setDeployedWorkflows(prev => [...prev, deployedWorkflow]);
          setSelectedChatWorkflow(deployedWorkflow);
        }
        
        // Show brief success message and automatically redirect
        setDeploymentStatus(`✅ Deployment successful! Redirecting to live workflow...`);
        
        if (result.workflowInstanceId) {
          // Brief delay to show success message, then redirect automatically
          setTimeout(() => {
            console.log(`🔀 Auto-redirecting to live workflow: ${result.workflowInstanceId}`);
            router.push(`/agent-teams/${result.teamInstanceId}/${result.workflowInstanceId}/live`);
          }, 1500);
        } else {
          // No workflow ID available, clear loading state
          setTimeout(() => {
            setIsDeploying(false);
            setDeploymentStatus('');
          }, 2000);
        }
        
      } else {
        console.error('❌ Team deployment failed:', result);
        setDeploymentStatus('❌ Deployment failed');
        
        // Show detailed error message
        alert(
          `❌ Team Deployment Failed\n\n` +
          `Error: ${result.error}\n` +
          `${result.details ? `Details: ${result.details}\n` : ''}` +
          `${result.teamInstanceId ? `Team Instance: ${result.teamInstanceId}\n` : ''}` +
          `\nPlease try again or contact support if the issue persists.`
        );
        
        // Clear loading state
        setIsDeploying(false);
        setTimeout(() => setDeploymentStatus(''), 3000);
      }
      
    } catch (error) {
      console.error('❌ Deployment request failed:', error);
      setDeploymentStatus('❌ Request failed');
      setDeploymentError(error.message);
      
      // Clear loading state
      setIsDeploying(false);
      setTimeout(() => {
        setDeploymentStatus('');
        setDeploymentError(null);
      }, 10000); // Keep error visible longer
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        onCleanupStuckDeployments={handleCleanupStuckDeployments}
        onLaunchGitHubWorkflow={() => setShowGitHubLauncher(true)}
      />
      
      {/* Enhanced Deployment Status Display */}
      {(isDeploying || deploymentStatus || deploymentError) && (
        <DeploymentStatusIndicator
          isDeploying={isDeploying}
          deploymentStatus={deploymentStatus}
          error={deploymentError}
          onRetry={() => {
            // Reset states and allow user to try again
            setDeploymentError(null);
            setDeploymentStatus('');
            setIsDeploying(false);
          }}
          onCancel={() => {
            // Clear all deployment states
            setDeploymentError(null);
            setDeploymentStatus('');
            setIsDeploying(false);
          }}
        />
      )}

      {/* Admin Debug Section - Only visible to admins */}
      {session?.user?.role === 'admin' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-yellow-800">Admin Debug: Active Deployments</h3>
            <div className="space-x-2">
              <button
                onClick={handleGetDebugInfo}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              >
                Check Active Deployments
              </button>
              <button
                onClick={handleForceCleanupAll}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                🚨 Force Cleanup ALL
              </button>
            </div>
          </div>
          
          {debugInfo && (
            <div className="bg-white rounded border p-3">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      
      <TeamGrid teams={teamConfigs} onSelectWorkflow={handleTeamSelect} onGitHubDeploy={handleGitHubDeploy} />
      <TeamComparison teams={teamConfigs} />
      
      {/* Analytics and History Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeploymentHistory />
        <DeploymentAnalytics />
      </div>
      
      {/* Workflow Chat Section */}
      {deployedWorkflows.length > 0 && (
        <WorkflowChatSection 
          deployedWorkflows={deployedWorkflows}
          selectedWorkflow={selectedChatWorkflow}
          onSelectWorkflow={setSelectedChatWorkflow}
        />
      )}
      
      {/* GitHub Workflow Launcher Modal */}
      {showGitHubLauncher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Launch GitHub-Integrated Workflow
              </h2>
              <button
                onClick={() => setShowGitHubLauncher(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <GitHubWorkflowLauncher 
              onWorkflowStarted={() => setShowGitHubLauncher(false)}
              className="p-0"
            />
          </div>
        </div>
      )}
      
      <WorkflowSelectionModal
        team={selectedTeam}
        isOpen={isWorkflowModalOpen}
        onClose={handleModalClose}
        onDeploy={handleDeploy}
      />
      
      <GitHubWorkflowModal
        team={selectedTeam}
        isOpen={isGitHubModalOpen}
        onClose={handleGitHubModalClose}
        onDeploy={handleDeploy}
      />
    </div>
  );
};

export default AgentTeamsPage;