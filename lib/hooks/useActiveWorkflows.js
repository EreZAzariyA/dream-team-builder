import { useQuery } from '@tanstack/react-query';

export const useActiveWorkflows = (options) => {
  return useQuery({
    queryKey: ['activeWorkflows'],
    queryFn: async () => {
      const response = await fetch('/api/workflows/active');
      if (!response.ok) {
        throw new Error('Failed to fetch active workflows');
      }
      const data = await response.json();
      return data.workflows;
    },
    ...options,
  });
};
