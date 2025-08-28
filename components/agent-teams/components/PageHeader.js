import { RefreshCw, Github } from 'lucide-react';

const PageHeader = ({ onCleanupStuckDeployments, onLaunchGitHubWorkflow }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-h1">Agent Teams</h1>
        <div className="flex items-center gap-3">
          {onLaunchGitHubWorkflow && (
            <button
              onClick={onLaunchGitHubWorkflow}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              title="Launch GitHub-integrated workflow"
            >
              <Github className="w-4 h-4" />
              GitHub Workflow
            </button>
          )}
          {onCleanupStuckDeployments && (
            <button
              onClick={onCleanupStuckDeployments}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              title="Clean up stuck deployments that are preventing new deployments"
            >
              <RefreshCw className="w-4 h-4" />
              Cleanup Stuck Deployments
            </button>
          )}
        </div>
      </div>
      <p className="text-body text-gray-600 dark:text-gray-400">
        Pre-configured agent team bundles for different development scenarios. Each team includes specific agents and workflows optimized for particular use cases.
      </p>
    </div>
  );
};

export default PageHeader;