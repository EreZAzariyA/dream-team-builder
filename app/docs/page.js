'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocsPage = () => {
  const [doc, setDoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch('/api/docs');
        const data = await res.json();
        setFiles(data.files);
      } catch (error) {
        console.error('Failed to fetch docs:', error);
      }
    };
    fetchDocs();
  }, []);

  const loadDoc = async (file) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docs?file=${file}`);
      const data = await res.json();
      setDoc(data.content);
    } catch (error) {
      console.error(`Failed to fetch ${file}:`, error);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full">
        <aside className="w-64 bg-gray-100 dark:bg-gray-800 p-4 overflow-y-auto">
          <h2 className="text-h4 font-semibold mb-4">Documents</h2>
          <ul>
            {files.map(file => (
              <li key={file} className="mb-2">
                <button onClick={() => loadDoc(file)} className="text-left w-full text-body text-professional-muted hover:text-professional transition-colors">
                  {file}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <p>Loading...</p>
          ) : doc ? (
            <article className="prose dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc}</ReactMarkdown>
            </article>
          ) : (
            <p>Select a document to view.</p>
          )}
        </main>
    </div>
  );
};

export default DocsPage;
