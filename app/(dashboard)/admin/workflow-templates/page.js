'use client';

import { useState } from 'react';
import { useWorkflowTemplates } from '../../../../lib/hooks/useWorkflowTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/common/Card';
import { Badge } from '../../../../components/common/Badge';
import { 
  FileText,
  Search, 
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  GitBranch,
  Clock,
  Users,
  Settings,
  BookOpen,
  Workflow,
  Zap,
  Database,
  FileCode,
  ChevronDown
} from 'lucide-react';
import { 
  exportTemplateToYAML, 
  exportMultipleTemplatesToYAML, 
  downloadYAMLFile, 
  generateExportFilename 
} from '../../../../lib/utils/templateExport';


export default function AdminWorkflowTemplatesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { 
    templates: allTemplates, 
    stats, 
    isLoading, 
    error
  } = useWorkflowTemplates();

  // Filter templates
  const filteredTemplates = allTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || template.type === filterType;
    const matchesSource = filterSource === 'all' || template.source === filterSource;
    return matchesSearch && matchesType && matchesSource;
  });


  const getComplexityColor = (complexity) => {
    switch (complexity) {
      case 'Simple': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Complex': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'greenfield': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'brownfield': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getSourceColor = (source) => {
    switch (source) {
      case 'bmad-core': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'database': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };


  const handleViewTemplate = (template) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleExportTemplate = (template) => {
    try {
      const yamlContent = exportTemplateToYAML(template);
      const filename = generateExportFilename(template);
      downloadYAMLFile(yamlContent, filename);
    } catch (error) {
      console.error('Failed to export template:', error);
      alert('Failed to export template. Please try again.');
    }
  };

  const handleExportAll = () => {
    try {
      if (filteredTemplates.length === 0) {
        alert('No templates to export.');
        return;
      }
      
      const yamlContent = exportMultipleTemplatesToYAML(filteredTemplates);
      const filename = `workflow-templates-export-${new Date().toISOString().split('T')[0]}.yaml`;
      downloadYAMLFile(yamlContent, filename);
    } catch (error) {
      console.error('Failed to export templates:', error);
      alert('Failed to export templates. Please try again.');
    }
  };

  const handleExportFiltered = () => {
    try {
      if (filteredTemplates.length === 0) {
        alert('No templates match the current filter.');
        return;
      }
      
      const yamlContent = exportMultipleTemplatesToYAML(filteredTemplates);
      const filterSuffix = filterType !== 'all' ? filterType : (filterSource !== 'all' ? filterSource : 'filtered');
      const filename = `workflow-templates-${filterSuffix}-${new Date().toISOString().split('T')[0]}.yaml`;
      downloadYAMLFile(yamlContent, filename);
    } catch (error) {
      console.error('Failed to export filtered templates:', error);
      alert('Failed to export templates. Please try again.');
    }
  };

  const hasError = error;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Workflow Templates
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage BMAD workflow templates and create new ones
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <FileText className="w-4 h-4 mr-1" />
            {filteredTemplates.length} templates
          </Badge>
          

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center space-x-2 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export YAML</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
              <div className="py-1">
                <button
                  onClick={handleExportFiltered}
                  disabled={filteredTemplates.filter(t => !t.isReadonly).length === 0}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export Filtered ({filteredTemplates.filter(t => !t.isReadonly).length})
                </button>
                <button
                  onClick={handleExportAll}
                  disabled={allTemplates.filter(t => !t.isReadonly).length === 0}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export All Custom ({allTemplates.filter(t => !t.isReadonly).length})
                </button>
                <div className="border-t border-gray-100 dark:border-gray-600 my-1"></div>
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                  BMAD-core templates are read-only
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Templates</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">BMAD Core</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.bmadCore}</p>
              </div>
              <FileCode className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Database</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.database}</p>
              </div>
              <Database className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Greenfield</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.greenfield}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Brownfield</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.brownfield}</p>
              </div>
              <Settings className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search templates by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="greenfield">Greenfield</option>
                  <option value="brownfield">Brownfield</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-gray-400" />
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Sources</option>
                  <option value="bmad-core">BMAD Core</option>
                  <option value="database">Database</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : hasError ? (
          <div className="col-span-full text-center py-12">
            <FileText className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-500 dark:text-red-400">Failed to load templates</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {error?.message || 'Unknown error'}
            </p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No templates found</p>
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id || template._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {template.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className={getSourceColor(template.source)}>
                        {template.source === 'bmad-core' ? (
                          <FileCode className="w-3 h-3 mr-1" />
                        ) : (
                          <Database className="w-3 h-3 mr-1" />
                        )}
                        {template.source}
                      </Badge>
                      {template.type && (
                        <Badge className={getTypeColor(template.type)}>
                          {template.type}
                        </Badge>
                      )}
                      {template.complexity && (
                        <Badge className={getComplexityColor(template.complexity)}>
                          {template.complexity}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                  {template.description || 'No description available'}
                </p>
                
                <div className="space-y-2 mb-4">
                  {template.agents && template.agents.length > 0 && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4 mr-2" />
                      <span>{template.agents.length} agents: {template.agents.slice(0, 3).join(', ')}</span>
                      {template.agents.length > 3 && <span className="ml-1">+{template.agents.length - 3} more</span>}
                    </div>
                  )}
                  {template.stepCount && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <GitBranch className="w-4 h-4 mr-2" />
                      <span>{template.stepCount} steps</span>
                    </div>
                  )}
                  {template.estimatedTime && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{template.estimatedTime}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewTemplate(template)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 rounded-lg transition-colors"
                      title="View template"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleExportTemplate(template)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600 rounded-lg transition-colors"
                      title="Export as YAML"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Read-only
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Template Detail Modal */}
      {isModalOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedTemplate.name}
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleExportTemplate(selectedTemplate)}
                    className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center space-x-1"
                    title="Export as YAML"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export YAML</span>
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={getSourceColor(selectedTemplate.source)}>
                    {selectedTemplate.source}
                  </Badge>
                  {selectedTemplate.type && (
                    <Badge className={getTypeColor(selectedTemplate.type)}>
                      {selectedTemplate.type}
                    </Badge>
                  )}
                  {selectedTemplate.complexity && (
                    <Badge className={getComplexityColor(selectedTemplate.complexity)}>
                      {selectedTemplate.complexity}
                    </Badge>
                  )}
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Description</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedTemplate.description || 'No description available'}
                  </p>
                </div>

                {selectedTemplate.sequence && selectedTemplate.sequence.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">Workflow Sequence</h3>
                    <div className="space-y-2">
                      {selectedTemplate.sequence.map((step, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {step.agent && <span className="text-blue-600">@{step.agent}</span>}
                              {step.creates && <span className="ml-2">creates: {step.creates}</span>}
                              {step.action && <span className="ml-2">action: {step.action}</span>}
                            </div>
                            {step.notes && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {step.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
    </div>
  );
}