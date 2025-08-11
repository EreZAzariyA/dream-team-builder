'use client';

import { useState, useEffect } from 'react';
import { 
  Terminal, 
  Play, 
  HelpCircle, 
  FileText, 
  FolderOpen,
  CheckSquare,
  Settings,
  Zap,
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';

const COMMAND_DEFINITIONS = {
  // PM Commands
  'create-prd': {
    id: 'create-prd',
    name: 'Create PRD',
    description: 'Create a Product Requirements Document using templates',
    icon: FileText,
    category: 'Document Creation',
    requiresTemplate: true,
    templates: ['prd-tmpl.yaml'],
    interactive: true
  },
  'create-brownfield-prd': {
    id: 'create-brownfield-prd',
    name: 'Create Brownfield PRD',
    description: 'Create PRD for existing project enhancements',
    icon: FileText,
    category: 'Document Creation',
    requiresTemplate: true,
    templates: ['brownfield-prd-tmpl.yaml'],
    interactive: true
  },
  'shard-prd': {
    id: 'shard-prd',
    name: 'Shard PRD',
    description: 'Break down PRD into manageable pieces for development',
    icon: FolderOpen,
    category: 'Document Management',
    requiresFile: true,
    interactive: false
  },
  
  // Dev Commands
  'develop-story': {
    id: 'develop-story',
    name: 'Develop Story',
    description: 'Implement a user story with full development workflow',
    icon: Play,
    category: 'Development',
    requiresFile: true,
    interactive: false
  },
  'run-tests': {
    id: 'run-tests',
    name: 'Run Tests',
    description: 'Execute linting and tests for the project',
    icon: CheckSquare,
    category: 'Testing',
    requiresFile: false,
    interactive: false
  },
  
  // SM Commands
  'draft': {
    id: 'draft',
    name: 'Draft Story',
    description: 'Create next story from sharded documents',
    icon: FileText,
    category: 'Story Management',
    requiresTemplate: true,
    templates: ['story-tmpl.yaml'],
    interactive: true
  },
  
  // QA Commands
  'review-story': {
    id: 'review-story',
    name: 'Review Story',
    description: 'Perform senior developer code review with refactoring',
    icon: CheckSquare,
    category: 'Quality Assurance',
    requiresFile: true,
    interactive: false
  },
  
  // Universal Commands
  'help': {
    id: 'help',
    name: 'Help',
    description: 'Show available commands for this agent',
    icon: HelpCircle,
    category: 'System',
    requiresFile: false,
    interactive: false
  },
  'exit': {
    id: 'exit',
    name: 'Exit Agent',
    description: 'Exit the current agent mode',
    icon: Settings,
    category: 'System',
    requiresFile: false,
    interactive: false
  }
};

const BmadAgentCommandInterface = ({ 
  agent, 
  onCommandExecute,
  isExecuting = false,
  lastResult = null,
  className = ""
}) => {
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [commandParams, setCommandParams] = useState({});
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [availableFiles, setAvailableFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agent) {
      fetchAvailableResources();
    }
  }, [agent]);

  const fetchAvailableResources = async () => {
    try {
      setLoading(true);
      
      // Fetch available templates
      const templatesResponse = await fetch('/api/bmad/commands/metadata?type=templates');
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        setAvailableTemplates(templatesData.templates || []);
      }

      // Fetch available documents/files
      const filesResponse = await fetch('/api/bmad/commands/metadata?type=files');
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setAvailableFiles(filesData.files || []);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!agent) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Terminal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Select a BMAD agent to see available commands
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get commands for this agent
  const agentCommands = (agent.commands || []).map(cmdId => {
    const definition = COMMAND_DEFINITIONS[cmdId] || {
      id: cmdId,
      name: cmdId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `Execute ${cmdId} command`,
      icon: Terminal,
      category: 'Agent Command',
      requiresFile: false,
      interactive: false
    };
    return definition;
  });

  // Group commands by category
  const groupedCommands = agentCommands.reduce((groups, cmd) => {
    const category = cmd.category || 'Other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(cmd);
    return groups;
  }, {});

  const handleCommandSelect = (command) => {
    setSelectedCommand(command);
    setCommandParams({});
  };

  const handleExecuteCommand = async () => {
    if (!selectedCommand) return;

    const executionContext = {
      command: selectedCommand,
      agent: agent,
      parameters: commandParams
    };

    await onCommandExecute(executionContext);
    setSelectedCommand(null);
    setCommandParams({});
  };

  const renderCommandParams = () => {
    if (!selectedCommand) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <selectedCommand.icon className="w-5 h-5" />
            Execute: {selectedCommand.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCommand.description}
          </p>

          {/* Template Selection */}
          {selectedCommand.requiresTemplate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Template
              </label>
              <select
                value={commandParams.template || ''}
                onChange={(e) => setCommandParams({ ...commandParams, template: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Choose a template...</option>
                {availableTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File Selection */}
          {selectedCommand.requiresFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select File/Document
              </label>
              <select
                value={commandParams.file || ''}
                onChange={(e) => setCommandParams({ ...commandParams, file: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Choose a file...</option>
                {availableFiles.map(file => (
                  <option key={file.path} value={file.path}>
                    {file.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Interactive Input */}
          {selectedCommand.interactive && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Context (Optional)
              </label>
              <textarea
                value={commandParams.context || ''}
                onChange={(e) => setCommandParams({ ...commandParams, context: e.target.value })}
                placeholder="Provide additional context or specific requirements..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          {/* Execute Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setSelectedCommand(null)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteCommand}
              disabled={isExecuting || (selectedCommand.requiresTemplate && !commandParams.template) || (selectedCommand.requiresFile && !commandParams.file)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Execute Command
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLastResult = () => {
    if (!lastResult) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {lastResult.success ? (
              <CheckSquare className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            Last Command Result
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lastResult.success ? (
            <div className="text-sm text-green-700 dark:text-green-300">
              Command executed successfully
              {lastResult.output && (
                <pre className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs overflow-x-auto">
                  {lastResult.output}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-sm text-red-700 dark:text-red-300">
              Command failed: {lastResult.error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              {agent.icon}
            </div>
            <div>
              <div className="text-lg">{agent.name} Commands</div>
              <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                Available commands for {agent.title}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading commands...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category}>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {commands.map(command => {
                      const IconComponent = command.icon;
                      return (
                        <button
                          key={command.id}
                          onClick={() => handleCommandSelect(command)}
                          className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded flex items-center justify-center flex-shrink-0">
                              <IconComponent className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {command.name}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {command.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                {command.requiresTemplate && (
                                  <Badge variant="outline" className="text-xs">
                                    Template Required
                                  </Badge>
                                )}
                                {command.requiresFile && (
                                  <Badge variant="outline" className="text-xs">
                                    File Required
                                  </Badge>
                                )}
                                {command.interactive && (
                                  <Badge variant="outline" className="text-xs">
                                    Interactive
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {agentCommands.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No commands available for this agent</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Command Execution Panel */}
      {renderCommandParams()}

      {/* Last Result */}
      {renderLastResult()}
    </div>
  );
};

export default BmadAgentCommandInterface;