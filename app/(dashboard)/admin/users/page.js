'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../../lib/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/common/Card';
import { Badge } from '../../../../components/common/Badge';
import { 
  User, 
  Users, 
  Search, 
  Filter,
  MoreVertical,
  Mail,
  Calendar,
  Activity,
  Edit,
  Ban,
  CheckCircle,
  Shield,
  UserX
} from 'lucide-react';

// Fetch functions
async function fetchUsers() {
  return await fetchWithAuth('/api/admin/users');
}

async function updateUser({ userId, updates }) {
  return await fetchWithAuth('/api/admin/users', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, updates }),
  });
}

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const queryClient = useQueryClient();

  // Fetch users query
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      setSelectedUser(null);
    },
    onError: (error) => {
      console.error('Failed to update user:', error);
    },
  });

  const users = usersData?.users || [];
  const stats = usersData?.stats || {};

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Handler functions
  const handleToggleUserStatus = (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const isActive = newStatus === 'active';
    
    const confirmed = window.confirm(
      `Are you sure you want to ${isActive ? 'activate' : 'deactivate'} ${user.name}?`
    );
    
    if (confirmed) {
      updateUserMutation.mutate({
        userId: user.id,
        updates: { isActive }
      });
    }
  };

  const handleToggleUserRole = (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    
    const confirmed = window.confirm(
      `Are you sure you want to make ${user.name} ${newRole === 'admin' ? 'an admin' : 'a regular user'}?`
    );
    
    if (confirmed) {
      updateUserMutation.mutate({
        userId: user.id,
        updates: { role: newRole }
      });
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'user': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatLastLogin = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(dateString);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Users className="w-4 h-4 mr-1" />
            {filteredUsers.length} users
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active || 0}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admins</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.admins || 0}</p>
              </div>
              <User className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inactive Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inactive || 0}</p>
              </div>
              <UserX className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <UserX className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-500 dark:text-red-400">Failed to load users</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{error.message}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Last Login</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Workflows</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getStatusColor(user.status)}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {formatLastLogin(user.lastLogin)}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {user.workflowCount}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Toggle Status */}
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={updateUserMutation.isLoading}
                            className={`p-2 rounded-lg transition-colors ${
                              user.status === 'active'
                                ? 'hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600'
                                : 'hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600'
                            }`}
                            title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.status === 'active' ? (
                              <Ban className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>

                          {/* Toggle Role */}
                          <button
                            onClick={() => handleToggleUserRole(user)}
                            disabled={updateUserMutation.isLoading}
                            className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/20 text-purple-600 rounded-lg transition-colors"
                            title={user.role === 'admin' ? 'Make user' : 'Make admin'}
                          >
                            {user.role === 'admin' ? (
                              <User className="w-4 h-4" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No users found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}