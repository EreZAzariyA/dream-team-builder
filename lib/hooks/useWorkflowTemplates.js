import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../react-query';

// Fetch functions
async function fetchBmadTemplates() {
  const response = await fetch('/api/workflows/templates');
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.status}`);
  }
  return await response.json();
}

export function useWorkflowTemplates() {
  const queryClient = useQueryClient();

  // Fetch BMAD core templates only
  const { data: bmadData, isLoading, error } = useQuery({
    queryKey: ['bmad-templates'],
    queryFn: fetchBmadTemplates,
    staleTime: 60000, // 1 minute
  });

  // Format templates from BMAD core
  const templates = (bmadData?.templates || []).map(t => ({ 
    ...t, 
    source: 'bmad-core', 
    isReadonly: true 
  }));

  // Stats
  const stats = {
    total: templates.length,
    bmadCore: templates.length,
    database: 0,
    greenfield: templates.filter(t => t.type === 'greenfield').length,
    brownfield: templates.filter(t => t.type === 'brownfield').length
  };

  return {
    templates,
    stats,
    isLoading,
    error
  };
}