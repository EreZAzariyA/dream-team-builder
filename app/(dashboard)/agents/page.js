'use client';

import { useState } from 'react';
import { Bot, Clock, CheckCircle, AlertCircle, User, Code, TestTube, Palette, Database, Briefcase } from 'lucide-react';

const agentTypes = [
  { 
    id: 'pm', 
    name: 'PM Agent', 
    description: 'Project management, planning, and requirement analysis',
    icon: Briefcase,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  { 
    id: 'architect', 
    name: 'Architect Agent', 
    description: 'System design, architecture planning, and technical decisions',
    icon: Code,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800'
  },
  { 
    id: 'developer', 
    name: 'Developer Agent', 
    description: 'Code implementation, feature development, and bug fixes',
    icon: Code,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  { 
    id: 'qa', 
    name: 'QA Agent', 
    description: 'Testing, quality assurance, and validation processes',
    icon: TestTube,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  { 
    id: 'ux', 
    name: 'UX Expert', 
    description: 'User experience design, UI/UX optimization, and user research',
    icon: Palette,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    borderColor: 'border-pink-200 dark:border-pink-800'
  },
  { 
    id: 'data', 
    name: 'Data Architect', 
    description: 'Database design, data modeling, and information architecture',
    icon: Database,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-800'
  }
];

const mockAgentInstances = [
  { id: 1, type: 'pm', status: 'active', currentTask: 'Analyzing project requirements for Phoenix workflow' },
  { id: 2, type: 'architect', status: 'available', currentTask: null },
  { id: 3, type: 'developer', status: 'busy', currentTask: 'Implementing authentication system' },
  { id: 4, type: 'qa', status: 'active', currentTask: 'Running security audit tests' },
  { id: 5, type: 'ux', status: 'available', currentTask: null },
  { id: 6, type: 'data', status: 'busy', currentTask: 'Designing user activity schema' }
];

const AgentsPage = () => {
  const [selectedAgent, setSelectedAgent] = useState(null);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'busy': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'available': return <Bot className="w-4 h-4 text-gray-500" />;
      default: return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'busy': return 'Busy';
      case 'available': return 'Available';
      default: return 'Offline';
    }
  };

  return (
    <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h1 className="text-h1 mb-4">AI Agents</h1>
          <p className="text-body text-gray-600 dark:text-gray-400">
            Manage and monitor your BMAD AI agents. Each agent specializes in different aspects of the development workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agentTypes.map((agentType) => {
            const instances = mockAgentInstances.filter(instance => instance.type === agentType.id);
            const IconComponent = agentType.icon;
            
            return (
              <div
                key={agentType.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 ${agentType.borderColor} p-6 hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => setSelectedAgent(agentType)}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-3 rounded-lg ${agentType.bgColor}`}>
                    <IconComponent className={`w-6 h-6 ${agentType.color}`} />
                  </div>
                  <div>
                    <h3 className="text-h4 text-gray-900 dark:text-white">{agentType.name}</h3>
                    <p className="text-body-small text-gray-500 dark:text-gray-400">
                      {instances.length} instance{instances.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <p className="text-body-small text-gray-600 dark:text-gray-400 mb-4">
                  {agentType.description}
                </p>
                
                <div className="space-y-2">
                  {instances.map((instance) => (
                    <div key={instance.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(instance.status)}
                        <span className="text-body-small">{getStatusText(instance.status)}</span>
                      </div>
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-h3 text-gray-900 dark:text-white mb-4">Agent Status Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-h2 text-green-600 mb-1">
                {mockAgentInstances.filter(a => a.status === 'active').length}
              </div>
              <div className="text-body-small text-green-800 dark:text-green-200">Active</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-h2 text-orange-600 mb-1">
                {mockAgentInstances.filter(a => a.status === 'busy').length}
              </div>
              <div className="text-body-small text-orange-800 dark:text-orange-200">Busy</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-h2 text-gray-600 mb-1">
                {mockAgentInstances.filter(a => a.status === 'available').length}
              </div>
              <div className="text-body-small text-gray-800 dark:text-gray-200">Available</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-h2 text-blue-600 mb-1">{mockAgentInstances.length}</div>
              <div className="text-body-small text-blue-800 dark:text-blue-200">Total</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-h3 text-gray-900 dark:text-white mb-4">Recent Agent Activity</h3>
          <div className="space-y-3">
            {mockAgentInstances
              .filter(agent => agent.currentTask)
              .map((agent) => {
                const agentType = agentTypes.find(type => type.id === agent.type);
                const IconComponent = agentType.icon;
                return (
                  <div key={agent.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`p-2 rounded ${agentType.bgColor}`}>
                      <IconComponent className={`w-4 h-4 ${agentType.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-body-small font-medium text-gray-900 dark:text-white">
                        {agentType.name}
                      </div>
                      <div className="text-caption text-gray-600 dark:text-gray-400">
                        {agent.currentTask}
                      </div>
                    </div>
                    {getStatusIcon(agent.status)}
                  </div>
                );
              })}
          </div>
        </div>
    </div>
  );
};

export default AgentsPage;