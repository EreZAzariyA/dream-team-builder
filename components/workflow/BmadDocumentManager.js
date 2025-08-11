'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';
import BmadDocumentViewer from './BmadDocumentViewer';
import BmadTemplateVariableForm from './BmadTemplateVariableForm';
import { 
  FileText, 
  Download, 
  Eye, 
  Edit3, 
  Share2, 
  Clock,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  Archive,
  Layers,
  RefreshCw
} from 'lucide-react';

const BMAD_DOCUMENT_TYPES = {
  'project-brief.md': { icon: '📋', color: 'blue', category: 'Planning' },
  'prd.md': { icon: '📄', color: 'purple', category: 'Requirements' },
  'architecture.md': { icon: '🏗️', color: 'cyan', category: 'Architecture' },
  'front-end-spec.md': { icon: '🎨', color: 'pink', category: 'Design' },
  'brownfield-prd.md': { icon: '🔧', color: 'amber', category: 'Enhancement' },
  'competitor-analysis.md': { icon: '📊', color: 'green', category: 'Research' },
  'market-research.md': { icon: '📈', color: 'emerald', category: 'Research' },
  'user-stories.md': { icon: '👥', color: 'indigo', category: 'Stories' }
};

const BmadDocumentManager = ({ 
  workflowId,
  artifacts = [],
  onRefresh,
  onDownload,
  onView,
  loading = false 
}) => {
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created');
  const [showShardModal, setShowShardModal] = useState(false);
  const [showFillTemplateModal, setShowFillTemplateModal] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  useEffect(() => {
    // Process artifacts into document format
    const processedDocs = artifacts.map(artifact => {
      const docType = BMAD_DOCUMENT_TYPES[artifact.filename] || { 
        icon: '📄', 
        color: 'gray', 
        category: 'Other' 
      };
      
      return {
        id: artifact.filename,
        filename: artifact.filename,
        title: artifact.filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: docType,
        size: artifact.size,
        created: artifact.createdAt,
        modified: artifact.modifiedAt || artifact.createdAt,
        status: artifact.status || 'completed',
        version: artifact.version || '1.0',
        agentId: artifact.createdBy || 'system'
      };
    });

    setDocuments(processedDocs);
  }, [artifacts]);

  const filteredDocuments = documents.filter(doc => {
    if (filter === 'all') return true;
    return doc.type.category.toLowerCase() === filter.toLowerCase();
  });

  const sortedDocuments = filteredDocuments.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.title.localeCompare(b.title);
      case 'type':
        return a.type.category.localeCompare(b.type.category);
      case 'size':
        return (b.size || 0) - (a.size || 0);
      case 'created':
      default:
        return new Date(b.created || 0) - new Date(a.created || 0);
    }
  });

  const categories = [...new Set(documents.map(doc => doc.type.category))];
  const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString([], { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'draft': return <Edit3 className="w-4 h-4 text-amber-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // BMAD Document Operations - These will be implemented when backend APIs are ready
  // All operations currently show UI placeholders since backend APIs don't exist yet

  const handleShard = async (doc) => {
    console.log('BMAD Shard operation for:', doc.filename);
    try {
      const response = await fetch('/api/bmad/documents/shard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          documentType: doc.type || 'generic',
          content: doc.content || `# ${doc.title}\n\nDocument content placeholder`,
          projectName: doc.projectName || 'Project'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`✅ Document sharded into ${result.shardsGenerated} pieces:`, result.shards);
        // Update documents list with shards
        const newDocs = result.shards.map(shard => ({
          id: shard.id,
          name: shard.filename,
          title: shard.title,
          type: shard.type,
          content: shard.content,
          size: shard.content.length,
          agent: doc.agent,
          created: new Date().toISOString(),
          category: doc.category,
          isSharded: true,
          parentDocument: doc.id
        }));
        setDocuments(prev => [...prev, ...newDocs]);
        onRefresh?.();
        alert(`✅ Successfully sharded "${doc.title}" into ${result.shardsGenerated} manageable sections!`);
      } else {
        throw new Error(result.message || 'Sharding failed');
      }
    } catch (error) {
      console.error('❌ Sharding error:', error);
      alert(`❌ Sharding failed: ${error.message}`);
    }
  };

  const handleFillTemplate = async () => {
    console.log('BMAD Template Fill operation');
    setIsLoadingTemplates(true);
    try {
      // Load available templates
      const response = await fetch('/api/bmad/documents/fill-template');
      const result = await response.json();
      if (result.success) {
        setAvailableTemplates(result.templates);
        setShowFillTemplateModal(true);
      } else {
        throw new Error(result.message || 'Failed to load templates');
      }
    } catch (error) {
      console.error('❌ Template loading error:', error);
      alert(`❌ Failed to load templates: ${error.message}`);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleValidate = async (doc) => {
    console.log('BMAD Validation operation for:', doc.filename);
    try {
      const response = await fetch('/api/bmad/documents/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          content: doc.content || `# ${doc.title}\n\nDocument content placeholder`,
          documentType: doc.type || 'generic'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setValidationResult(result.validation);
        // Update document with validation results
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? { ...d, validation: result.validation } : d
        ));
        
        const status = result.validation.valid ? '✅ Validation passed!' : '⚠️ Validation issues found';
        alert(`${status} Check the document for details.`);
      } else {
        throw new Error(result.message || 'Validation failed');
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      alert(`❌ Validation failed: ${error.message}. API may not be implemented yet.`);
    }
  };

  const handleExport = async (doc, format) => {
    // TODO: Implement when backend /api/bmad/documents/export is ready
    // This should export documents in multiple formats
    console.log(`BMAD Export operation for: ${doc.filename} as ${format}`);
    alert(`BMAD Document export not yet implemented. This will export ${doc.title} as ${format} with proper BMAD formatting.`);
  };

  return (
    <>
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">BMAD Documents</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {documents.length} documents • {formatFileSize(totalSize)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh documents"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Category:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            >
              <option value="all">All ({documents.length})</option>
              {categories.map(category => (
                <option key={category} value={category.toLowerCase()}>
                  {category} ({documents.filter(d => d.type.category === category).length})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            >
              <option value="created">Date Created</option>
              <option value="name">Name</option>
              <option value="type">Category</option>
              <option value="size">Size</option>
            </select>
          </div>
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : sortedDocuments.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Documents Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Documents will appear here as your BMAD agents create them during the workflow.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* Document Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{doc.type.icon}</div>
                    <div>
                      <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 leading-tight">
                        {doc.title}
                      </h3>
                      <Badge 
                        className={`text-xs mt-1 bg-${doc.type.color}-50 text-${doc.type.color}-700 border-${doc.type.color}-200 dark:bg-${doc.type.color}-900/20 dark:text-${doc.type.color}-300`}
                      >
                        {doc.type.category}
                      </Badge>
                    </div>
                  </div>
                  {getStatusIcon(doc.status)}
                </div>

                {/* Document Metadata */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Size: {formatFileSize(doc.size)}</span>
                    <span>v{doc.version}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Created: {formatDate(doc.created)}
                  </div>
                  {doc.modified !== doc.created && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Modified: {formatDate(doc.modified)}
                    </div>
                  )}
                </div>

                {/* Document Actions */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => onView?.(doc.filename)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                  <button
                    onClick={() => onDownload?.(doc.filename)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                  <button
                    onClick={() => handleShard(doc)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <Layers className="w-3 h-3" />
                    Shard
                  </button>
                  <button
                    onClick={() => handleFillTemplate(doc)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    Fill
                  </button>
                  <button
                    onClick={() => handleValidate(doc)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Validate
                  </button>
                  <div className="relative group">
                    <button
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                      <button
                        onClick={() => handleExport(doc, 'md')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Export as MD
                      </button>
                      <button
                        onClick={() => handleExport(doc, 'pdf')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Export as PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Document Categories Summary */}
        {categories.length > 0 && !loading && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Document Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {categories.map(category => {
                const count = documents.filter(d => d.type.category === category).length;
                return (
                  <Badge
                    key={category}
                    variant="outline"
                    className="text-xs px-3 py-1 cursor-pointer"
                    onClick={() => setFilter(category.toLowerCase())}
                  >
                    {category} ({count})
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* TODO: Remove these placeholder modals when backend APIs are implemented */}
        {/* These will be replaced with proper BMAD workflow integration */}
      </CardContent>
    </Card>

    {/* Document Viewer Modal */}
    <BmadDocumentViewer
      document={selectedDocument}
      isOpen={showDocumentViewer}
      onClose={() => {
        setShowDocumentViewer(false);
        setSelectedDocument(null);
      }}
      onSave={handleSaveDocument}
      onValidate={async (docId, content) => {
        const doc = { id: docId, content, type: selectedDocument?.type };
        return await handleValidate(doc);
      }}
      onExport={async (docId, format) => {
        const doc = documents.find(d => d.id === docId);
        if (doc) await handleExport(doc, format);
      }}
    />

    {/* Template Variable Form Modal */}
    {showFillTemplateModal && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setShowFillTemplateModal(false)}></div>
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedTemplate ? `Fill Template: ${selectedTemplate.name}` : 'Select Template'}
              </h3>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {!selectedTemplate ? (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Available Templates</h4>
                  {isLoadingTemplates ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading templates...</span>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {availableTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
                        >
                          <div className="font-medium text-gray-900">{template.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-blue-600">{template.type}</span>
                            <span className="text-xs text-gray-400">{template.variableCount} variables</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <BmadTemplateVariableForm
                  template={selectedTemplate}
                  onSubmit={handleTemplateSubmit}
                  onCancel={() => setSelectedTemplate(null)}
                />
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowFillTemplateModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );

  // Helper functions
  function handleViewDocument(doc) {
    setSelectedDocument(doc);
    setShowDocumentViewer(true);
  }

  function handleSaveDocument(docId, content) {
    console.log('Saving document:', docId, content);
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, content, modified: new Date().toISOString() } : doc
    ));
  }

  async function handleTemplateSubmit(variables) {
    if (!selectedTemplate) return;
    
    try {
      const response = await fetch('/api/bmad/documents/fill-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          variables,
          projectName: variables.project_name || 'Project',
          agentId: selectedTemplate.agent
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // Add generated document to list
        const newDoc = {
          id: result.document.id,
          name: `${result.document.title}.md`,
          title: result.document.title,
          type: result.document.type,
          content: result.document.content,
          size: result.document.content.length,
          agent: result.document.agent,
          created: result.document.metadata.generatedAt,
          category: BMAD_DOCUMENT_TYPES[result.document.type]?.category || 'Generated',
          isGenerated: true,
          templateId: selectedTemplate.id
        };
        
        setDocuments(prev => [...prev, newDoc]);
        setShowFillTemplateModal(false);
        setSelectedTemplate(null);
        onRefresh?.();
        alert(`✅ Successfully generated "${result.document.title}" from template!`);
      } else {
        throw new Error(result.message || 'Template processing failed');
      }
    } catch (error) {
      console.error('❌ Template processing error:', error);
      alert(`❌ Template processing failed: ${error.message}`);
    }
  }
};

export default BmadDocumentManager;