import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../react-query';

export const useActiveWorkflows = (options) => {
  return useQuery({
    queryKey: ['activeWorkflows'],
    queryFn: async () => {
      const data = await fetchWithAuth('/api/workflows/active');
      return data.workflows;
    },
    ...options,
  });
};
