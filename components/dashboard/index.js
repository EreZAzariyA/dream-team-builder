// Clean dashboard components export
export { default as QuickNavigation } from './sections/QuickNavigation';
export { default as SystemOverview } from './sections/SystemOverview';
export { default as ActiveProjects } from './sections/ActiveProjects';
export { default as AgentStatus } from './sections/AgentStatus';

// Reusable components
export { default as NavigationCard } from './components/NavigationCard';
export { default as MetricCard } from './components/MetricCard';
export { default as HealthIndicator, HealthCard } from './components/HealthIndicator';

// Data hooks
export { useDashboardData, useActiveProjects, useAgentStatus } from './hooks/useDashboardData';

// Keep useful legacy components
export { default as RealTimeActivityFeed } from './RealTimeActivityFeed';
export { default as SmartInsights } from './SmartInsights';