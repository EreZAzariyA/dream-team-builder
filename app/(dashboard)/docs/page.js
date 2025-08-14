'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileText, 
  Book, 
  Code, 
  Zap, 
  ChevronRight, 
  Search,
  BookOpen,
  GitBranch,
  Layers,
  Cloud
} from 'lucide-react';

/**
 * Dashboard-integrated documentation page
 * Prepared for AWS S3 integration
 */
const DocsPage = () => {
  const [doc, setDoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Document categories for better organization
  const docCategories = [
    {
      id: 'getting-started',
      name: 'Getting Started',
      icon: <Zap className="w-5 h-5" />,
      description: 'Quick start guides and setup',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900',
      borderColor: 'border-green-200 dark:border-green-800',
      files: ['README.md', 'quickstart.md', 'installation.md']
    },
    {
      id: 'api',
      name: 'API Documentation',
      icon: <Code className="w-5 h-5" />,
      description: 'REST API endpoints and examples',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      borderColor: 'border-blue-200 dark:border-blue-800',
      files: ['api.md', 'endpoints.md', 'authentication.md']
    },
    {
      id: 'bmad',
      name: 'BMAD System',
      icon: <GitBranch className="w-5 h-5" />,
      description: 'Agent orchestration and workflows',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      borderColor: 'border-orange-200 dark:border-orange-800',
      files: ['bmad.md', 'agents.md', 'orchestration.md']
    },
    {
      id: 'guides',
      name: 'User Guides',
      icon: <BookOpen className="w-5 h-5" />,
      description: 'Step-by-step tutorials',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      borderColor: 'border-purple-200 dark:border-purple-800',
      files: ['user-guide.md', 'workflows.md', 'best-practices.md']
    }
  ];

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      // TODO: Replace with AWS S3 integration
      // Future implementation will use: await documentService.listFiles()
      const res = await fetch('/api/docs');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Failed to fetch docs:', error);
      // TODO: Implement S3 fallback strategy
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDoc = async (file) => {
    setLoading(true);
    setSelectedFile(file);
    try {
      // TODO: Replace with AWS S3 integration
      // Future implementation will use: await documentService.getDocument(file)
      const res = await fetch(`/api/docs?file=${file}`);
      const data = await res.json();
      setDoc(data.content);
    } catch (error) {
      console.error(`Failed to fetch ${file}:`, error);
      // TODO: Implement S3 error handling and caching
      setDoc('Error loading document. Please try again.');
    }
    setLoading(false);
  };

  // Filter files by search query
  const filteredFiles = files.filter(file => 
    file.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Categorize files
  const getCategoryFiles = (categoryFiles) => {
    return filteredFiles.filter(file => 
      categoryFiles.some(catFile => file.includes(catFile.replace('.md', '')))
    );
  };

  // Get uncategorized files
  const uncategorizedFiles = filteredFiles.filter(file => {
    return !docCategories.some(category => 
      category.files.some(catFile => file.includes(catFile.replace('.md', '')))
    );
  });

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

            {/* Navigation Categories */}
            <div className="flex-1 overflow-y-auto p-3">
              <nav className="space-y-1">
                {docCategories.map((category) => {
                  const categoryFiles = getCategoryFiles(category.files);
                  if (categoryFiles.length === 0) return null;

                  return (
                    <div key={category.id} className="mb-4">
                      {/* Category Header */}
                      <div className="px-2 py-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-6 h-6 rounded-lg ${category.bgColor} flex items-center justify-center`}>
                            <span className={category.color}>{category.icon}</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                              {category.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {category.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Category Files */}
                      <div className="space-y-1 ml-2">
                        {categoryFiles.map(file => (
                          <button
                            key={file}
                            onClick={() => loadDoc(file)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200 text-left group ${
                              selectedFile === file
                                ? `${category.bgColor} ${category.borderColor} border text-gray-900 dark:text-white`
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium">
                                {file.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Uncategorized Files */}
                {uncategorizedFiles.length > 0 && (
                  <div className="mb-4">
                    <div className="px-2 py-2 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                        Other Documents
                      </h3>
                    </div>
                    <div className="space-y-1 ml-2">
                      {uncategorizedFiles.map(file => (
                        <button
                          key={file}
                          onClick={() => loadDoc(file)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200 text-left group ${
                            selectedFile === file
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-white'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">
                              {file.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                        </button>
                      ))}
                    </div>
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