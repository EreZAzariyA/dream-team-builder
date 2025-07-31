'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Code, FileText } from 'lucide-react';

const ActivityItem = ({ item }) => {
  const icons = {
    communication: <MessageSquare className="w-4 h-4" />,
    commit: <Code className="w-4 h-4" />,
    artifact: <FileText className="w-4 h-4" />,
  };

  return (
    <motion.div
      className="flex items-start space-x-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`p-2 rounded-full bg-${item.color}-100 text-${item.color}-600 dark:bg-${item.color}-900/50 dark:text-${item.color}-300`}>
        {icons[item.type]}
      </div>
      <div className="flex-1">
        <p className="text-body-small text-professional">{item.text}</p>
        <p className="text-caption text-professional-subtle">{item.time}</p>
      </div>
    </motion.div>
  );
};

const RealTimeActivityFeed = () => {
  const activities = [
    { type: 'communication', color: 'primary', text: 'PM Agent sent PRD to Architect Agent', time: '2m ago' },
    { type: 'commit', color: 'accent', text: 'Developer Agent committed changes to feature/auth', time: '5m ago' },
    { type: 'artifact', color: 'success', text: 'Architect Agent generated new database schema', time: '12m ago' },
    { type: 'communication', color: 'primary', text: 'QA Agent requested clarification from Developer Agent', time: '20m ago' },
  ];

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <ActivityItem key={index} item={activity} />
      ))}
    </div>
  );
};

export default RealTimeActivityFeed;