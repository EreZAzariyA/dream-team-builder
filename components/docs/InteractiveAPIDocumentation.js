'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

async function fetchOpenAPISpec() {
  const response = await fetch('/api/docs/openapi');
  if (!response.ok) {
    throw new Error('Failed to fetch OpenAPI specification');
  }
  return response.json();
}

async function generateAPISpec() {
  const response = await fetch('/api/docs/openapi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputPath: 'docs/openapi.json' })
  });
  if (!response.ok) {
    throw new Error('Failed to generate API specification');
  }
  return response.json();
}

export default function InteractiveAPIDocumentation() {
  const [selectedPath, setSelectedPath] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [testPayload, setTestPayload] = useState('{}');
  const [testResponse, setTestResponse] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: spec, error, isLoading, refetch } = useQuery({
    queryKey: ['openapi-spec'],
    queryFn: fetchOpenAPISpec,
  });

  const handleGenerateSpec = async () => {
    setIsGenerating(true);
    try {
      await generateAPISpec();
      await refetch();
    } catch (error) {
      console.error('Error generating spec:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestEndpoint = async () => {
    if (!selectedPath || !selectedMethod) return;

    try {
      const url = selectedPath.replace(/\{([^}]+)\}/g, 'test-id');
      let fetchOptions = {
        method: selectedMethod.toUpperCase(),
        headers: { 'Content-Type': 'application/json' }
      };

      if (['POST', 'PUT', 'PATCH'].includes(selectedMethod.toUpperCase())) {
        fetchOptions.body = testPayload;
      }

      const response = await fetch(url, fetchOptions);
      const result = await response.json();
      
      setTestResponse({
        status: response.status,
        statusText: response.statusText,
        data: result
      });
    } catch (error) {
      setTestResponse({
        status: 'Error',
        statusText: error.message,
        data: null
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">Loading API documentation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-red-500">Error loading API documentation: {error.message}</div>
        <button 
          onClick={handleGenerateSpec}
          disabled={isGenerating}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate API Documentation'}
        </button>
      </div>
    );
  }

  const paths = spec?.paths || {};
  const pathKeys = Object.keys(paths);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            📚 API Documentation
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {spec?.info?.title} - Version {spec?.info?.version}
          </p>
        </div>
        <button 
          onClick={handleGenerateSpec}
          disabled={isGenerating}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isGenerating ? 'Regenerating...' : 'Regenerate Docs'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Endpoints List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Available Endpoints
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pathKeys.map(path => {
              const methods = Object.keys(paths[path]);
              return (
                <div key={path} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700">
                    <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
                      {path}
                    </code>
                  </div>
                  <div className="p-3 space-y-2">
                    {methods.map(method => {
                      const methodInfo = paths[path][method];
                      const isSelected = selectedPath === path && selectedMethod === method;
                      
                      return (
                        <button
                          key={method}
                          onClick={() => {
                            setSelectedPath(path);
                            setSelectedMethod(method);
                            setTestResponse(null);
                          }}
                          className={`w-full text-left p-2 rounded-md text-sm ${
                            isSelected 
                              ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-600' 
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                          } border hover:bg-gray-50 dark:hover:bg-gray-700`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                method.toUpperCase() === 'GET' ? 'bg-green-200 text-green-800' :
                                method.toUpperCase() === 'POST' ? 'bg-blue-200 text-blue-800' :
                                method.toUpperCase() === 'PUT' ? 'bg-yellow-200 text-yellow-800' :
                                method.toUpperCase() === 'DELETE' ? 'bg-red-200 text-red-800' :
                                'bg-gray-200 text-gray-800'
                              }`}>
                                {method.toUpperCase()}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {methodInfo.summary}
                              </span>
                            </div>
                            {methodInfo.tags && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {methodInfo.tags[0]}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {methodInfo.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Endpoint Details & Testing */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Endpoint Details & Testing
          </h3>
          
          {selectedPath && selectedMethod ? (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {selectedMethod.toUpperCase()} {selectedPath}
                </h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {paths[selectedPath][selectedMethod].description}
                </p>
                
                {/* Parameters */}
                {paths[selectedPath][selectedMethod].parameters && (
                  <div className="mb-3">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">Parameters:</h5>
                    <div className="space-y-1">
                      {paths[selectedPath][selectedMethod].parameters.map((param, idx) => (
                        <div key={idx} className="text-sm">
                          <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">
                            {param.name}
                          </code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">
                            ({param.schema.type}) - {param.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Request Body for POST/PUT methods */}
                {['post', 'put', 'patch'].includes(selectedMethod.toLowerCase()) && (
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">Request Body:</h5>
                    <textarea
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-mono bg-white dark:bg-gray-800"
                      placeholder="Enter JSON payload..."
                    />
                  </div>
                )}

                <button
                  onClick={handleTestEndpoint}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Test Endpoint
                </button>
              </div>

              {/* Test Response */}
              {testResponse && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Response:</h5>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Status:</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        typeof testResponse.status === 'number' && testResponse.status < 400 
                          ? 'bg-green-200 text-green-800' 
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {testResponse.status} {testResponse.statusText}
                      </span>
                    </div>
                    <pre className="bg-white dark:bg-gray-800 p-3 rounded border text-xs overflow-x-auto">
                      {JSON.stringify(testResponse.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Select an endpoint from the list to view details and test it
            </div>
          )}
        </div>
      </div>

      {/* API Info */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Servers:</h4>
            <ul className="space-y-1">
              {spec?.servers?.map((server, idx) => (
                <li key={idx} className="text-sm">
                  <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                    {server.url}
                  </code>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    {server.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Authentication:</h4>
            <ul className="space-y-1">
              {Object.entries(spec?.components?.securitySchemes || {}).map(([name, scheme]) => (
                <li key={name} className="text-sm">
                  <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                    {name}
                  </code>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    {scheme.type} ({scheme.scheme || scheme.in})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}