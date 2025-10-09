'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  FolderIcon, 
  FolderOpenIcon,
  DocumentIcon,
  CodeBracketIcon,
  EyeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

/**
 * File Tree Viewer Component
 * Uses react-syntax-highlighter for code display and custom tree implementation
 */
const FileTreeViewer = ({ repository, analysisData }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set([''])); // Root expanded by default
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Build tree structure from file index
  const buildTreeStructure = (files) => {
    const tree = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      // Build nested structure
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        
        if (!current[part]) {
          current[part] = isFile ? {
            type: 'file',
            data: file,
            path: file.path
          } : {
            type: 'folder',
            children: {},
            path: parts.slice(0, i + 1).join('/')
          };
        }
        
        if (!isFile) {
          current = current[part].children;
        }
      }
    });
    
    return tree;
  };

  // Get file icon based on extension
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap = {
      js: '📄', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
      py: '🐍', java: '☕', go: '🐹', rs: '🦀',
      html: '🌐', css: '🎨', scss: '🎨',
      json: '📋', yaml: '📄', yml: '📄',
      md: '📝', txt: '📄',
      png: '🖼️', jpg: '🖼️', gif: '🖼️', svg: '🖼️',
      pdf: '📄', zip: '📦',
      sh: '⚡', bash: '⚡'
    };
    
    return iconMap[ext] || '📄';
  };

  // Get language for syntax highlighting
  const getLanguage = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap = {
      js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
      py: 'python', java: 'java', go: 'go', rs: 'rust',
      html: 'html', css: 'css', scss: 'scss',
      json: 'json', yaml: 'yaml', yml: 'yaml',
      md: 'markdown', sh: 'bash', bash: 'bash',
      xml: 'xml', sql: 'sql', php: 'php',
      rb: 'ruby', swift: 'swift', kt: 'kotlin'
    };
    
    return langMap[ext] || 'text';
  };

  // Toggle folder expansion
  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Load file content
  const loadFileContent = async (file) => {
    if (file.size > 1024 * 1024) { // 1MB limit
      setFileContent({
        error: 'File too large to display (>1MB)',
        size: file.size
      });
      return;
    }

    setLoadingFile(true);
    try {
      const response = await fetch('/api/repo/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: repository.owner.login,
          name: repository.name,
          path: file.path,
          ref: 'main'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setFileContent({
          content: result.content,
          language: getLanguage(file.path),
          size: file.size
        });
      } else {
        setFileContent({
          error: result.error || 'Failed to load file',
          size: file.size
        });
      }
    } catch (error) {
      setFileContent({
        error: 'Failed to load file content',
        size: file.size
      });
    } finally {
      setLoadingFile(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    setSelectedFile(file);
    loadFileContent(file);
  };

  // Filter files based on search
  const filterTree = (tree, searchTerm) => {
    if (!searchTerm) return tree;
    
    const filtered = {};
    
    const shouldInclude = (item, path) => {
      if (item.type === 'file') {
        return path.toLowerCase().includes(searchTerm.toLowerCase());
      }
      
      // For folders, include if any child matches
      const hasMatchingChild = Object.entries(item.children || {}).some(([key, child]) => 
        shouldInclude(child, `${path}/${key}`)
      );
      
      return hasMatchingChild || path.toLowerCase().includes(searchTerm.toLowerCase());
    };
    
    Object.entries(tree).forEach(([key, item]) => {
      if (shouldInclude(item, key)) {
        filtered[key] = item;
      }
    });
    
    return filtered;
  };

  // Render tree node
  const renderTreeNode = (name, node, depth = 0, path = '') => {
    const currentPath = path ? `${path}/${name}` : name;
    const isExpanded = expandedFolders.has(currentPath);
    
    if (node.type === 'file') {
      return (
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex items-center space-x-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
            selectedFile?.path === node.data.path ? 'bg-blue-100 dark:bg-blue-900/30' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => handleFileSelect(node.data)}
        >
          <span className="text-sm">{getFileIcon(name)}</span>
          <span className="text-sm text-gray-900 dark:text-white truncate">{name}</span>
          <span className="text-xs text-gray-500 ml-auto">
            {node.data.lines > 0 ? `${node.data.lines} lines` : ''}
          </span>
        </motion.div>
      );
    }

    return (
      <div key={currentPath}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => toggleFolder(currentPath)}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
          )}
          {isExpanded ? (
            <FolderOpenIcon className="w-4 h-4 text-blue-600" />
          ) : (
            <FolderIcon className="w-4 h-4 text-blue-600" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
        </motion.div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {Object.entries(node.children || {})
                .sort(([,a], [,b]) => {
                  // Folders first, then files
                  if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                  }
                  return 0;
                })
                .map(([childName, childNode]) =>
                  renderTreeNode(childName, childNode, depth + 1, currentPath)
                )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (!analysisData?.fileIndex || analysisData.fileIndex.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No files found in analysis</p>
      </div>
    );
  }

  const treeStructure = buildTreeStructure(analysisData.fileIndex);
  const filteredTree = filterTree(treeStructure, searchTerm);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
      
      {/* File Tree Panel */}
      <div className="lg:col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <CodeBracketIcon className="w-5 h-5 text-gray-500" />
            <h3 className="font-medium text-gray-900 dark:text-white">Files</h3>
            <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {analysisData.fileIndex.length}
            </span>
          </div>
          
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        
        <div className="overflow-y-auto h-80 p-2">
          {Object.entries(filteredTree)
            .sort(([,a], [,b]) => {
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
              }
              return 0;
            })
            .map(([name, node]) => renderTreeNode(name, node))
          }
        </div>
      </div>

      {/* File Content Panel */}
      <div className="lg:col-span-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {selectedFile ? (
          <>
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{getFileIcon(selectedFile.path)}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedFile.path}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>{selectedFile.language}</span>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  <span>{selectedFile.lines} lines</span>
                </div>
              </div>
            </div>
            
            <div className="h-80 overflow-auto">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : fileContent?.error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">{fileContent.error}</p>
                  </div>
                </div>
              ) : fileContent?.content ? (
                <SyntaxHighlighter
                  language={fileContent.language}
                  style={isDarkMode ? oneDark : oneLight}
                  showLineNumbers
                  customStyle={{
                    margin: 0,
                    fontSize: '13px',
                    background: 'transparent'
                  }}
                >
                  {fileContent.content}
                </SyntaxHighlighter>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <EyeIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Select a file to preview
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Click on any file in the tree to view its content
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTreeViewer;