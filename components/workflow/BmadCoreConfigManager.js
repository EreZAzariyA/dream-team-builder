'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  FileText, 
  FolderOpen, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  Edit,
  Eye,
  Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';

const BmadCoreConfigManager = ({ className = "" }) => {
  const [config, setConfig] = useState(null);
  const [editedConfig, setEditedConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bmad/core-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setEditedConfig(data.rawContent || '');
        setLastSaved(data.lastModified);
      } else {
        console.error('Failed to load core config');
      }
    } catch (error) {
      console.error('Error loading core config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveResult(null);
    
    try {
      const response = await fetch('/api/bmad/core-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editedConfig
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setConfig(result.config);
        setLastSaved(result.lastModified);
        setSaveResult({ success: true, message: 'Configuration saved successfully' });
        setEditing(false);
      } else {
        setSaveResult({ success: false, message: result.error || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setSaveResult({ success: false, message: 'Network error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setSaveResult(null);
  };

  const handleCancel = () => {
    setEditedConfig(config?.rawContent || '');
    setEditing(false);
    setSaveResult(null);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editedConfig);
      setSaveResult({ success: true, message: 'Configuration copied to clipboard' });
      setTimeout(() => setSaveResult(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const renderConfigEditor = () => {
    if (!editing) {
      return (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
          <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            {editedConfig}
          </pre>
        </div>
      );
    }

    return (
      <textarea
        value={editedConfig}
        onChange={(e) => setEditedConfig(e.target.value)}
        className="w-full h-64 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        placeholder="Enter YAML configuration..."
      />
    );
  };

  const renderConfigSummary = () => {
    if (!config) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">PRD Settings</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Version:</span>
                <Badge variant="outline" className="text-xs">
                  {config.prd?.prdVersion || 'Not set'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Sharded:</span>
                <span className={config.prd?.prdSharded ? 'text-green-600' : 'text-gray-500'}>
                  {config.prd?.prdSharded ? 'Yes' : 'No'}
                </span>
              </div>
              {config.prd?.prdShardedLocation && (
                <div className="text-gray-600 dark:text-gray-400">
                  📁 {config.prd.prdShardedLocation}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">Architecture</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Version:</span>
                <Badge variant="outline" className="text-xs">
                  {config.architecture?.architectureVersion || 'Not set'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Sharded:</span>
                <span className={config.architecture?.architectureSharded ? 'text-green-600' : 'text-gray-500'}>
                  {config.architecture?.architectureSharded ? 'Yes' : 'No'}
                </span>
              </div>
              {config.architecture?.architectureShardedLocation && (
                <div className="text-gray-600 dark:text-gray-400">
                  📁 {config.architecture.architectureShardedLocation}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Development</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Story Location:</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {config.devStoryLocation || 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Debug Log:</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {config.devDebugLog || 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Always Load:</span>
                <span className="text-gray-600 dark:text-gray-400">
                  {config.devLoadAlwaysFiles?.length || 0} files
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">System</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Markdown Exploder:</span>
                <span className={config.markdownExploder ? 'text-green-600' : 'text-gray-500'}>
                  {config.markdownExploder ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Slash Prefix:</span>
                <Badge variant="outline" className="text-xs">
                  {config.slashPrefix || 'BMad'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Loading core configuration...</span>
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
              <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div>BMAD Core Configuration</div>
              <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                Manage project settings and workflow configuration
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-gray-500">
                  Last saved: {new Date(lastSaved).toLocaleString()}
                </span>
              )}
              <button
                onClick={loadConfig}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Refresh configuration"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Configuration Summary */}
          {renderConfigSummary()}

          {/* Save Result */}
          {saveResult && (
            <div className={`p-3 rounded-lg mb-4 flex items-center gap-2 ${
              saveResult.success 
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
            }`}>
              {saveResult.success ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span className="text-sm">{saveResult.message}</span>
            </div>
          )}

          {/* Configuration Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-800 dark:text-white">
                core-config.yaml
              </h4>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveConfig}
                      disabled={saving}
                      className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          Save
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={copyToClipboard}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleEdit}
                      className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 transition-colors flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {renderConfigEditor()}
          </div>

          {/* Developer Files */}
          {config?.devLoadAlwaysFiles && config.devLoadAlwaysFiles.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-800 dark:text-white mb-3">
                Developer Load-Always Files
              </h4>
              <div className="space-y-2">
                {config.devLoadAlwaysFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BmadCoreConfigManager;