const ErrorState = ({ error }) => {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <h3 className="text-h4 text-red-800 dark:text-red-200 mb-2">Error Loading Agent Teams</h3>
      <p className="text-body text-red-600 dark:text-red-400">{error}</p>
    </div>
  );
};

export default ErrorState;