'use client';

import WorkflowAnalytics from "@/components/analytics/WorkflowAnalytics";


const AnalyticsPage = () => {
  return (
    <div className="p-6">
        <h1 className="text-h1 mb-4">Analytics</h1>
        <WorkflowAnalytics />
    </div>
  );
};

export default AnalyticsPage;