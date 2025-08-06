'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';
import { 
  Loader2,
  Package,
  Download,
  FileText,
  Code,
  File
} from 'lucide-react';

const GeneratedFiles = ({ 
  artifacts = [],
  loading = false,
  onDownloadFile,
  onDownloadAll,
  formatTimestamp,
  formatFileSize
}) => {
  // Helper functions for file handling
  const getFileIcon = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    const iconMap = {
      'md': FileText,
      'js': Code,
      'ts': Code,
      'py': Code,
      'java': Code,
      'json': File,
      'yaml': File,
      'yml': File,
      'txt': FileText,
      'html': Code,
      'css': Code
    };
    return iconMap[ext] || File;
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Generated Files
          </div>
          <div className="flex items-center space-x-2">
            {artifacts.length > 0 && (
              <button
                onClick={onDownloadAll}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors duration-200 flex items-center"
              >
                <Download className="w-3 h-3 mr-1" />
                Download All
              </button>
            )}
            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {artifacts.length}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Loading artifacts...</span>
          </div>
        ) : artifacts.length > 0 ? (
          <div className="space-y-3">
            {artifacts.map((artifact, index) => {
              const FileIcon = getFileIcon(artifact.filename);
              const fileType = artifact.type || 'file';
              const agent = artifact.agent || 'unknown';
              
              return (
                <div 
                  key={artifact.filename || index}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-4">
                      <FileIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {artifact.filename}
                        </span>
                        <Badge className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {fileType}
                        </Badge>
                        {agent !== 'unknown' && (
                          <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {agent}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        {artifact.description && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {artifact.description}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatFileSize(artifact.size)}
                        </span>
                        {artifact.savedAt && (
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(artifact.savedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onDownloadFile(artifact.filename)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            
            {/* Summary section */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {artifacts.length}
                  </div>
                  <div className="text-xs text-gray-500">Total Files</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {artifacts.reduce((sum, a) => sum + (a.size || 0), 0) > 0 
                      ? formatFileSize(artifacts.reduce((sum, a) => sum + (a.size || 0), 0))
                      : '0 B'
                    }
                  </div>
                  <div className="text-xs text-gray-500">Total Size</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {[...new Set(artifacts.map(a => a.type))].length}
                  </div>
                  <div className="text-xs text-gray-500">File Types</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {[...new Set(artifacts.map(a => a.agent).filter(Boolean))].length}
                  </div>
                  <div className="text-xs text-gray-500">Contributors</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
              No Files Generated Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Artifacts will appear here as agents complete their tasks
            </p>
            <div className="text-sm text-gray-500">
              Files are automatically saved and will be available for download
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GeneratedFiles;