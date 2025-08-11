import { Loader2 } from 'lucide-react';

const LoadingState = () => {
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="flex items-center space-x-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-body text-gray-600 dark:text-gray-400">Loading agent teams...</span>
      </div>
    </div>
  );
};

export default LoadingState;