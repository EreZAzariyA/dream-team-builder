'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API utility functions
const api = {
  // Health check
  checkHealth: async () => {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  },
  
  // Auth endpoints
  register: async (userData) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }
    return response.json();
  },
  
  login: async (credentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }
    return response.json();
  },
  
  getProfile: async (token) => {
    const response = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get profile');
    }
    return response.json();
  },
};

export default function TestApiPage() {
  const [token, setToken] = useState(null);
  const [testResults, setTestResults] = useState({});
  const queryClient = useQueryClient();
  
  // Load token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) setToken(savedToken);
  }, []);
  
  // Health check query
  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['health'],
    queryFn: api.checkHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Profile query (only if token exists)
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(token),
    enabled: !!token,
  });
  
  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: (data) => {
      setToken(data.data.token);
      localStorage.setItem('authToken', data.data.token);
      setTestResults(prev => ({ ...prev, register: 'SUCCESS' }));
      queryClient.invalidateQueries(['profile']);
    },
    onError: (error) => {
      setTestResults(prev => ({ ...prev, register: `ERROR: ${error.message}` }));
    },
  });
  
  // Login mutation
  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      setToken(data.data.token);
      localStorage.setItem('authToken', data.data.token);
      setTestResults(prev => ({ ...prev, login: 'SUCCESS' }));
      queryClient.invalidateQueries(['profile']);
    },
    onError: (error) => {
      setTestResults(prev => ({ ...prev, login: `ERROR: ${error.message}` }));
    },
  });
  
  // Test functions
  const testRegistration = () => {
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User',
    };
    registerMutation.mutate(testUser);
  };
  
  const testLogin = () => {
    const testCredentials = {
      email: 'test@example.com',
      password: 'password123',
    };
    loginMutation.mutate(testCredentials);
  };
  
  const logout = () => {
    setToken(null);
    localStorage.removeItem('authToken');
    queryClient.clear();
    setTestResults({});
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              🧪 API Integration Test
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Testing MongoDB integration and authentication APIs
            </p>
          </div>

          {/* Health Status */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              🏥 System Health
            </h2>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              {healthLoading && (
                <div className="text-blue-600">Loading health status...</div>
              )}
              
              {healthError && (
                <div className="text-red-600">
                  Health check failed: {healthError.message}
                </div>
              )}
              
              {healthData && (
                <div className="space-y-3">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    healthData.data.status === 'healthy' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                    {healthData.data.status === 'healthy' ? '✅' : '❌'} {healthData.data.status.toUpperCase()}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Database</div>
                      <div className={`font-medium ${
                        healthData.data.services.database.status === 'healthy'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {healthData.data.services.database.status}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Mongoose</div>
                      <div className={`font-medium ${
                        healthData.data.services.connections.mongoose.state === 'connected'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {healthData.data.services.connections.mongoose.state}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {Math.round(healthData.data.uptime)}s
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Memory</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {Math.round(healthData.data.memory.used / 1024 / 1024)}MB
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Authentication Tests */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              🔐 Authentication Tests
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current User Status */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Current User Status
                </h3>
                
                {!token && (
                  <div className="text-gray-500 dark:text-gray-400">
                    Not authenticated
                  </div>
                )}
                
                {token && profileLoading && (
                  <div className="text-blue-600">Loading profile...</div>
                )}
                
                {token && profileData && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Email:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {profileData.data.user.email}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {profileData.data.user.profile.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Role:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {profileData.data.user.profile.role}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Test Actions */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Test Actions
                </h3>
                
                <div className="space-y-3">
                  <button
                    onClick={testRegistration}
                    disabled={registerMutation.isPending}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {registerMutation.isPending ? 'Registering...' : 'Test Registration'}
                  </button>
                  
                  <button
                    onClick={testLogin}
                    disabled={loginMutation.isPending}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {loginMutation.isPending ? 'Logging in...' : 'Test Login'}
                  </button>
                  
                  {token && (
                    <button
                      onClick={logout}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          {Object.keys(testResults).length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                📊 Test Results
              </h2>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
              💡 Instructions
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Make sure MongoDB is running locally on port 27017</li>
              <li>• The health check runs automatically every 30 seconds</li>
              <li>• Test registration creates a user with a random email</li>
              <li>• Test login tries to login with test@example.com / password123</li>
              <li>• All API responses are cached using React Query</li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="mt-8 text-center">
            <a
              href="/"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              ← Back to Home
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}