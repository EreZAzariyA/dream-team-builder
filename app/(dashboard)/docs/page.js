'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileText, 
  Book, 
  ChevronRight, 
  Search,
  GitBranch,
  Layers,
  Cloud
} from 'lucide-react';

/**
 * Dashboard-integrated documentation page
 * Prepared for AWS S3 integration
 */
const DocsPage = () => {
  const searchParams = useSearchParams();
  const [doc, setDoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [tree, setTree] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  useEffect(() => {
    fetchDocs();
  }, []);

  // Handle URL file parameter
  useEffect(() => {
    const fileParam = searchParams.get('file');
    if (fileParam && files.length > 0) {
      // Find the file in our files list
      const file = files.find(f => f.path === fileParam || f.key === fileParam);
      if (file) {
        loadDoc(file.path || file.key);
      }
    }
  }, [searchParams, files]);

  const fetchDocs = async () => {
    try {
      // Fetch only current user's S3 agent documents
      const res = await fetch('/api/docs');
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
        setTree(data.tree || {});
        
        // Auto-expand first level folders
        const firstLevelFolders = Object.keys(data.tree.folders || {});
        setExpandedFolders(new Set(firstLevelFolders));
      } else {
        console.error('Failed to fetch docs:', data.error);
        setFiles([]);
        setTree({});
      }
    } catch (error) {
      console.error('Failed to fetch docs:', error);
      setFiles([]);
      setTree({});
    } finally {
      setLoading(false);
    }
  };

  const loadDoc = async (file) => {
    setLoading(true);
    setSelectedFile(file);
    try {
      // Handle S3 files vs local files
      const res = await fetch(`/api/docs?file=${encodeURIComponent(file)}`);
      const data = await res.json();
      if (data.success) {
        setDoc(data.content);
      } else {
        setDoc('Error loading document: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error(`Failed to fetch ${file}:`, error);
      setDoc('Error loading document. Please try again.');
    }
    setLoading(false);
  };

  // Filter files by search query
  const filteredFiles = files.filter(file => 
    (file.name || file).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper functions for tree management
  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  // Tree node component
  const TreeNode = ({ node, path = '', level = 0 }) => {
    const isExpanded = expandedFolders.has(path);
    
    return (
      <div style={{ marginLeft: `${level * 12}px` }}>
        {/* Folders */}
        {node.folders && Object.entries(node.folders).map(([folderName, folder]) => {
          const folderPath = path ? `${path}/${folderName}` : folderName;
          const isCurrentlyExpanded = expandedFolders.has(folderPath);
          
          return (
            <div key={folderPath}>
              <button
                onClick={() => toggleFolder(folderPath)}
                className="w-full flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg text-left group"
              >
                <div className="flex items-center space-x-2">
                  <ChevronRight 
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isCurrentlyExpanded ? 'rotate-90' : ''
                    }`} 
                  />
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {folderName}
                  </span>
                </div>
              </button>
              
              {isCurrentlyExpanded && (
                <TreeNode 
                  node={folder} 
                  path={folderPath} 
                  level={level + 1} 
                />
              )}
            </div>
          );
        })}
        
        {/* Files */}
        {node.files && node.files.map((file) => (
          <button
            key={file.key}
            onClick={() => loadDoc(file.key)}
            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200 text-left group ${
              selectedFile === file.key
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-white'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div style={{ width: '16px' }} /> {/* Spacer for alignment */}
              <FileText className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-sm font-medium">
                  {file.name.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(file.lastModified).toLocaleDateString()}
                </div>
              </div>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📚 Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Guides, API references, and technical documentation
          </p>
        </div>
        
        {/* Storage Status Indicator */}
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <Cloud className="w-4 h-4" />
          <span>Local Storage</span>
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Migration to AWS S3 pending" />
          {/* TODO: Update when AWS S3 is integrated */}
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm h-full flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto p-3">
              <nav className="space-y-1">
                {Object.keys(tree).length > 0 ? (
                  <div className="mb-4">
                    <div className="px-2 py-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400">
                            <GitBranch className="w-4 h-4" />
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                            Your Documents
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Files organized by type and agent
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <TreeNode node={tree} />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No documents found. Start chatting with agents to create documents.
                    </p>
                  </div>
                )}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm h-full overflow-hidden">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center h-full"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading documentation...</p>
                  </div>
                </motion.div>
              ) : doc ? (
                <motion.div
                  key={selectedFile}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="h-full overflow-y-auto"
                >
                  <div className="p-6">
                    <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {doc}
                      </ReactMarkdown>
                    </article>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full px-8"
                >
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                    <Book className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Welcome to Documentation
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                    Select a document from the navigation to get started. Find guides, API references, and technical documentation.
                  </p>
                  
                  {/* AWS S3 Migration Notice */}
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg max-w-md">
                    <div className="flex items-center space-x-2">
                      <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Coming Soon</span>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Documentation will be migrated to AWS S3 for better performance and scalability.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;