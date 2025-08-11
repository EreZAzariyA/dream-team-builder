'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  FolderOpen, 
  Scissors, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Eye,
  Download,
  RefreshCw,
  ArrowRight,
  File,
  Folder
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';

const BmadDocumentSharding = ({ 
  className = "",
  onShardingComplete = null 
}) => {
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [shardedDocuments, setShardedDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isSharding, setIsSharding] = useState(false);
  const [shardingResult, setShardingResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Load available documents for sharding
      const availableResponse = await fetch('/api/bmad/commands/metadata?type=files');
      if (availableResponse.ok) {
        const availableData = await availableResponse.json();
        setAvailableDocuments(availableData.files || []);
      }

      // Load already sharded documents
      const shardedResponse = await fetch('/api/bmad/documents/sharded');
      if (shardedResponse.ok) {
        const shardedData = await shardedResponse.json();
        setShardedDocuments(shardedData.shardedDocuments || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShardDocument = async (document) => {
    setIsSharding(true);
    setSelectedDocument(document);
    setShardingResult(null);

    try {
      const response = await fetch('/api/bmad/documents/shard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentPath: document.path,
          documentName: document.name,
          outputDirectory: `docs/${document.name.replace('.md', '')}`
        })
      });

      const result = await response.json();

      if (result.success) {
        setShardingResult({
          success: true,
          message: result.message || 'Document sharded successfully',
          shardedFiles: result.shardedFiles || [],
          outputDirectory: result.outputDirectory
        });

        // Reload documents to show the newly sharded content
        await loadDocuments();

        if (onShardingComplete) {
          onShardingComplete(result);
        }
      } else {
        setShardingResult({
          success: false,
          message: result.error || 'Failed to shard document'
        });
      }
    } catch (error) {
      console.error('Error sharding document:', error);
      setShardingResult({
        success: false,
        message: error.message || 'Network error occurred'
      });
    } finally {
      setIsSharding(false);
    }
  };

  const getDocumentIcon = (document) => {
    if (document.name.includes('prd')) return '📋';
    if (document.name.includes('architecture')) return '🏗️';
    if (document.name.includes('story') || document.name.includes('stories')) return '📝';
    if (document.name.includes('epic')) return '🎯';
    return '📄';
  };

  const getDocumentType = (document) => {
    if (document.name.includes('prd')) return 'Product Requirements';
    if (document.name.includes('architecture')) return 'Architecture';
    if (document.name.includes('story') || document.name.includes('stories')) return 'User Stories';
    if (document.name.includes('epic')) return 'Epic';
    return 'Document';
  };

  const canShardDocument = (document) => {
    // Only shard main documents, not already sharded pieces
    return !document.name.includes('/') && document.name.endsWith('.md');
  };

  const renderAvailableDocuments = () => {
    const shardableDocuments = availableDocuments.filter(canShardDocument);

    if (shardableDocuments.length === 0) {
      return (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No documents available for sharding
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Create PRD or Architecture documents first
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shardableDocuments.map((document) => (
          <Card key={document.path} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-2xl">
                  {getDocumentIcon(document)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 dark:text-white truncate">
                    {document.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {getDocumentType(document)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {document.category}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleShardDocument(document)}
                  disabled={isSharding}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
                >
                  {isSharding && selectedDocument?.path === document.path ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sharding...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" />
                      Shard Document
                    </>
                  )}
                </button>
                
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderShardedDocuments = () => {
    if (shardedDocuments.length === 0) {
      return (
        <div className="text-center py-8">
          <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No sharded documents found
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Shard your documents to see them organized here
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {shardedDocuments.map((shardGroup) => (
          <Card key={shardGroup.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-lg">{shardGroup.name}</div>
                  <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                    {shardGroup.shards?.length || 0} sharded pieces
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shardGroup.shards?.map((shard, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <File className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-white truncate">
                          {shard.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {shard.type || 'Section'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        {shard.size || 'Unknown size'}
                      </span>
                      <button className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderShardingResult = () => {
    if (!shardingResult) return null;

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {shardingResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            Sharding Result
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`mb-4 ${
            shardingResult.success 
              ? 'text-green-700 dark:text-green-300' 
              : 'text-red-700 dark:text-red-300'
          }`}>
            {shardingResult.message}
          </p>
          
          {shardingResult.success && shardingResult.shardedFiles && (
            <div>
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">
                Created {shardingResult.shardedFiles.length} sharded files:
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <ul className="text-sm space-y-1">
                  {shardingResult.shardedFiles.map((file, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <ArrowRight className="w-3 h-3" />
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
              {shardingResult.outputDirectory && (
                <p className="text-xs text-gray-500 mt-2">
                  Output directory: {shardingResult.outputDirectory}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div>Document Sharding</div>
              <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                Break down large documents into manageable pieces for development
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Available Documents
            </button>
            <button
              onClick={() => setActiveTab('sharded')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'sharded'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Sharded Documents
            </button>
            
            <div className="ml-auto">
              <button
                onClick={loadDocuments}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Refresh documents"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'available' ? renderAvailableDocuments() : renderShardedDocuments()}

          {/* Sharding Result */}
          {renderShardingResult()}
        </CardContent>
      </Card>
    </div>
  );
};

export default BmadDocumentSharding;