'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgentTeamsData } from './hooks/useAgentTeamsData';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import PageHeader from './components/PageHeader';
import TeamGrid from './components/TeamGrid';
import TeamComparison from './components/TeamComparison';
import WorkflowSelectionModal from './components/WorkflowSelectionModal';
import WorkflowChatSection from './components/WorkflowChatSection';

const AgentTeamsPage = () => {
  const router = useRouter();
  const { teamConfigs, loading, error } = useAgentTeamsData();
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [deployedWorkflows, setDeployedWorkflows] = useState([]);
  const [selectedChatWorkflow, setSelectedChatWorkflow] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);

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

  const handleModalClose = () => {
    setIsWorkflowModalOpen(false);
    setSelectedTeam(null);
  };

  const handleDeploy = async (team, workflow, projectContext) => {
    try {
      console.log('🚀 Deploying team:', { team: team.name, workflow: workflow?.name, projectContext });
      
      // Get user prompt for the project BEFORE closing modal
      const userPrompt = prompt(
        `Describe your ${projectContext.type || 'project'} requirements:\n\n` +
        `Team: ${team.name}\n` +
        `${workflow ? `Workflow: ${workflow.name}\n` : ''}` +
        `Project Type: ${projectContext.type || 'Not specified'}\n` +
        `Project Scope: ${projectContext.scope || 'Not specified'}\n\n` +
        `Please describe what you want to build:`,
        `I want to build a ${projectContext.type || 'application'} that...`
      );
      
      if (!userPrompt || userPrompt.trim().length < 10) {
        alert('❌ Project description is required (minimum 10 characters)');
        return;
      }
      
      // Close modal and show loading state
      handleModalClose();
      setIsDeploying(true);
      setDeploymentStatus(`Deploying ${team.name}...`);
      
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
        userPrompt: userPrompt.trim(),
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
        
        // Show success message with redirect option
        const shouldRedirect = confirm(
          `✅ Team Deployment Successful!\n\n` +
          `Team: ${result.teamName}\n` +
          `Team Instance ID: ${result.teamInstanceId}\n` +
          `Workflow Instance ID: ${result.workflowInstanceId}\n` +
          `Status: ${result.teamStatus}\n\n` +
          `Click OK to go to the live workflow page to interact with your team,\n` +
          `or Cancel to stay on this page.`
        );
        
        if (shouldRedirect && result.workflowInstanceId) {
          // Redirect to live workflow page with new URL structure
          router.push(`/agent-teams/${result.teamInstanceId}/${result.workflowInstanceId}/live`);
        } else {
          // Clear loading state after a moment
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
      
      alert(
        `❌ Deployment Request Failed\n\n` +
        `Network or server error: ${error.message}\n\n` +
        `Please check your connection and try again.`
      );
      
      // Clear loading state
      setIsDeploying(false);
      setTimeout(() => setDeploymentStatus(''), 3000);
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
      <PageHeader onCleanupStuckDeployments={handleCleanupStuckDeployments} />
      
      {/* Deployment Status Display */}
      {(isDeploying || deploymentStatus) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            {isDeploying && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            )}
            <span className="font-medium text-blue-800">{deploymentStatus}</span>
          </div>
        </div>
      )}

      {/* Debug Section */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-yellow-800">Debug: Active Deployments</h3>
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
      
      <TeamGrid teams={teamConfigs} onSelectWorkflow={handleTeamSelect} />
      <TeamComparison teams={teamConfigs} />
      
      {/* Workflow Chat Section - Temporarily disabled due to React error */}
      {false && deployedWorkflows.length > 0 && (
        <WorkflowChatSection 
          deployedWorkflows={deployedWorkflows}
          selectedWorkflow={selectedChatWorkflow}
          onSelectWorkflow={setSelectedChatWorkflow}
        />
      )}
      
      <WorkflowSelectionModal
        team={selectedTeam}
        isOpen={isWorkflowModalOpen}
        onClose={handleModalClose}
        onDeploy={handleDeploy}
      />
    </div>
  );
};

export default AgentTeamsPage;