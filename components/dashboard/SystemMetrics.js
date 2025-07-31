'use client';

import { CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

const StatCard = ({ icon, label, value, change, changeType, isLast }) => {
  const Icon = icon;
  return (
    <div className={`p-4 ${!isLast ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>
      <div className="flex items-center">
        <div className="bg-secondary-100 dark:bg-secondary-900/50 p-2 rounded-full">
          <Icon className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
        </div>
        <div className="ml-3">
          <p className="text-body-small text-professional-muted">{label}</p>
          <p className="text-h5 font-semibold text-professional">{value}</p>
        </div>
      </div>
      {change && (
        <div className={`text-caption mt-2 flex items-center ${changeType === 'increase' ? 'text-success' : 'text-error'}`}>
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
    <div>
      <div className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} isLast={index === stats.length - 1} />
        ))}
      </div>
    </div>
  );
};

export default SystemMetrics;