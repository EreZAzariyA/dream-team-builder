const WorkflowList = ({ workflows }) => {
  if (!workflows) return null;

  return (
    <div>
      <h4 className="text-body font-semibold text-gray-900 dark:text-white mb-3">Available Workflows</h4>
      <div className="space-y-1">
        {workflows.map((workflow, index) => (
          <div
            key={`${workflow}-${index}`}
            className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-caption text-gray-600 dark:text-gray-400"
          >
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            {workflow.replace('.yaml', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowList;