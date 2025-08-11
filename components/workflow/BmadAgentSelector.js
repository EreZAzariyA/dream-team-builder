'use client';

import { useState, useEffect } from 'react';
import { 
  User, 
  Settings, 
  Zap, 
  Search, 
  ChevronDown, 
  MessageSquare, 
  Code, 
  TestTube,
  Palette,
  BarChart3,
  CheckSquare,
  Users,
  FileText,
  Brain
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';

const AGENT_DEFINITIONS = {
  'pm': {
    id: 'pm',
    name: 'John',
    title: 'Product Manager',
    icon: '📋',
    lucideIcon: FileText,
    color: 'blue',
    description: 'Creates PRDs, product strategy, feature prioritization',
    capabilities: ['PRD Creation', 'Market Research', 'Feature Planning', 'Requirements Gathering'],
    commands: ['create-prd', 'create-brownfield-prd', 'create-epic', 'create-story', 'doc-out', 'shard-prd']
  },
  'architect': {
    id: 'architect',
    name: 'Sarah',
    title: 'Solution Architect',
    icon: '🏗️',
    lucideIcon: Settings,
    color: 'purple',
    description: 'System design, technical architecture, scalability planning',
    capabilities: ['System Design', 'Technical Architecture', 'Technology Selection', 'Scalability Planning'],
    commands: ['create-architecture', 'review-tech-stack', 'design-patterns', 'create-doc']
  },
  'dev': {
    id: 'dev',
    name: 'James',
    title: 'Full Stack Developer',
    icon: '💻',
    lucideIcon: Code,
    color: 'green',
    description: 'Code implementation, debugging, refactoring, development best practices',
    capabilities: ['Code Implementation', 'Debugging', 'Testing', 'Code Review'],
    commands: ['develop-story', 'run-tests', 'explain', 'implement-feature']
  },
  'qa': {
    id: 'qa',
    name: 'Maria',
    title: 'QA Specialist',
    icon: '🔍',
    lucideIcon: TestTube,
    color: 'orange',
    description: 'Test planning, quality assurance, bug validation',
    capabilities: ['Test Planning', 'Quality Assurance', 'Bug Detection', 'Code Review'],
    commands: ['review-story', 'create-test-plan', 'validate-implementation', 'run-qa-checklist']
  },
  'ux-expert': {
    id: 'ux-expert',
    name: 'Alex',
    title: 'UX Designer',
    icon: '🎨',
    lucideIcon: Palette,
    color: 'pink',
    description: 'UI/UX design, user research, prototypes, interface design',
    capabilities: ['UI/UX Design', 'User Research', 'Prototyping', 'Design Systems'],
    commands: ['create-mockups', 'user-research', 'design-review', 'create-style-guide']
  },
  'sm': {
    id: 'sm',
    name: 'Bob',
    title: 'Scrum Master',
    icon: '🏃',
    lucideIcon: BarChart3,
    color: 'teal',
    description: 'Story creation, epic management, agile process guidance',
    capabilities: ['Story Creation', 'Sprint Planning', 'Process Management', 'Team Coordination'],
    commands: ['draft', 'story-checklist', 'plan-sprint', 'create-next-story']
  },
  'po': {
    id: 'po',
    name: 'Lisa',
    title: 'Product Owner',
    icon: '✅',
    lucideIcon: CheckSquare,
    color: 'indigo',
    description: 'Backlog management, story validation, acceptance criteria',
    capabilities: ['Backlog Management', 'Story Validation', 'Acceptance Criteria', 'Priority Setting'],
    commands: ['validate-story', 'prioritize-backlog', 'review-sprint', 'acceptance-test']
  },
  'analyst': {
    id: 'analyst',
    name: 'David',
    title: 'Business Analyst',
    icon: '🧠',
    lucideIcon: Brain,
    color: 'cyan',
    description: 'Market research, requirements gathering, competitive analysis',
    capabilities: ['Market Research', 'Business Analysis', 'Requirements Gathering', 'Competitive Analysis'],
    commands: ['market-research', 'analyze-competitors', 'gather-requirements', 'business-case']
  }
};

const COLOR_SCHEMES = {
  blue: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
  purple: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300',
  green: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
  orange: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
  pink: 'bg-pink-50 border-pink-200 text-pink-800 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-300',
  teal: 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-900/30 dark:border-teal-700 dark:text-teal-300',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300',
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-900/30 dark:border-cyan-700 dark:text-cyan-300'
};

const BmadAgentSelector = ({ 
  selectedAgent, 
  onAgentSelect, 
  onCommandSelect,
  availableAgents = null,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Use provided agents or fetch from API
  useEffect(() => {
    if (availableAgents) {
      setAgents(availableAgents);
      setLoading(false);
    } else {
      fetchAgents();
    }
  }, [availableAgents]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/bmad/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      } else {
        console.warn('Failed to fetch agents, using defaults');
        setAgents(Object.values(AGENT_DEFINITIONS));
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents(Object.values(AGENT_DEFINITIONS));
    } finally {
      setLoading(false);
    }
  };

  // Merge fetched agents with local definitions
  const enrichedAgents = agents.map(agent => {
    const definition = AGENT_DEFINITIONS[agent.id] || {};
    return {
      ...definition,
      ...agent,
      name: definition.name || agent.name || agent.id,
      title: definition.title || agent.title || agent.id,
      icon: definition.icon || '🤖',
      lucideIcon: definition.lucideIcon || User,
      color: definition.color || 'blue',
      description: definition.description || agent.description || 'AI Agent',
      capabilities: definition.capabilities || agent.capabilities || [],
      commands: definition.commands || agent.commands || []
    };
  });

  const filteredAgents = enrichedAgents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAgentSelect = (agent) => {
    onAgentSelect(agent);
    setIsOpen(false);
  };

  const currentAgent = selectedAgent ? 
    enrichedAgents.find(a => a.id === selectedAgent.id) || selectedAgent : null;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Agent Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          {currentAgent ? (
            <>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${COLOR_SCHEMES[currentAgent.color]}`}>
                {currentAgent.icon}
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-800 dark:text-white">
                  {currentAgent.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {currentAgent.title}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-500" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-800 dark:text-white">
                  Select BMAD Agent
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Choose an AI agent to work with
                </div>
              </div>
            </>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Agent List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredAgents.map((agent) => {
              const IconComponent = agent.lucideIcon;
              return (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  className={`w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                    currentAgent?.id === agent.id ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 flex-shrink-0 ${COLOR_SCHEMES[agent.color]}`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {agent.name}
                        </span>
                        <Badge className={`text-xs ${COLOR_SCHEMES[agent.color]}`}>
                          {agent.title}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {agent.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.slice(0, 3).map((capability, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {capability}
                          </span>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            +{agent.capabilities.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredAgents.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No agents found matching "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BmadAgentSelector;