'use client';

import { Activity, Users, Workflow, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

const StatCard = ({ icon, label, value, change, changeType }) => {
  const Icon = icon;
  return (
    <div className="card p-4">
      <div className="flex items-center">
        <div className="bg-primary-100 dark:bg-primary-900/50 p-2 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-300" />
        </div>
        <div className="ml-4">
          <p className="text-body-small text-professional-muted">{label}</p>
          <p className="text-h4 font-bold text-professional">{value}</p>
        </div>
      </div>
      {change && (
        <div className={`text-caption mt-2 flex items-center ${changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}>
          {changeType === 'increase' ? '▲' : '▼'} {change}
        </div>
      )}
    </div>
  );
};

const SystemMetrics = () => {
  const stats = [
    { icon: CheckCircle, label: 'Success Rate', value: '98.2%', change: '1.2%', changeType: 'increase' },
    { icon: XCircle, label: 'Failure Rate', value: '1.8%', change: '-0.5%', changeType: 'decrease' },
    { icon: Clock, label: 'Avg. Completion', value: '12m 45s', change: '-3.2%', changeType: 'decrease' },
    { icon: Zap, label: 'Active Agents', value: '8/10', change: '', changeType: '' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default SystemMetrics;