'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Edit, 
  CheckCircle, 
  Clock, 
  User, 
  Code, 
  TestTube,
  Eye,
  ArrowRight,
  Loader2,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card';
import { Badge } from '../common/Badge';

const STORY_STATUSES = {
  'draft': {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    icon: Edit
  },
  'ready': {
    label: 'Ready for Dev',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    icon: Clock
  },
  'in_development': {
    label: 'In Development',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    icon: Code
  },
  'ready_for_review': {
    label: 'Ready for Review',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    icon: Eye
  },
  'in_qa': {
    label: 'In QA',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    icon: TestTube
  },
  'completed': {
    label: 'Completed',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: CheckCircle
  },
  'blocked': {
    label: 'Blocked',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: Clock
  }
};

const BmadStoryManager = ({ 
  className = "",
  onStorySelect = null,
  onStoryCreate = null
}) => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStory, setSelectedStory] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bmad/stories');
      if (response.ok) {
        const data = await response.json();
        setStories(data.stories || []);
      }
    } catch (error) {
      console.error('Error loading stories:', error);
      // Load sample stories for demo
      setStories(getSampleStories());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async (storyData) => {
    try {
      const response = await fetch('/api/bmad/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storyData)
      });

      if (response.ok) {
        const result = await response.json();
        await loadStories(); // Reload stories
        setShowCreateForm(false);
        
        if (onStoryCreate) {
          onStoryCreate(result.story);
        }
      }
    } catch (error) {
      console.error('Error creating story:', error);
    }
  };

  const handleStatusUpdate = async (storyId, newStatus) => {
    try {
      const response = await fetch(`/api/bmad/stories/${storyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        await loadStories(); // Reload stories
      }
    } catch (error) {
      console.error('Error updating story status:', error);
      // Update locally for demo
      setStories(prev => prev.map(story => 
        story.id === storyId ? { ...story, status: newStatus } : story
      ));
    }
  };

  const filteredStories = stories.filter(story => {
    const matchesStatus = statusFilter === 'all' || story.status === statusFilter;
    const matchesSearch = !searchTerm || 
      story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.epicName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  const getStatusInfo = (status) => {
    return STORY_STATUSES[status] || STORY_STATUSES.draft;
  };

  const renderStoryCard = (story) => {
    const statusInfo = getStatusInfo(story.status);
    const StatusIcon = statusInfo.icon;

    return (
      <Card 
        key={story.id} 
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => {
          setSelectedStory(story);
          if (onStorySelect) {
            onStorySelect(story);
          }
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-800 dark:text-white line-clamp-1">
                  {story.title}
                </h4>
                <Badge className={`text-xs ${statusInfo.color} flex items-center gap-1`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusInfo.label}
                </Badge>
              </div>
              
              {story.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {story.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-4">
                  {story.epicName && (
                    <span>Epic: {story.epicName}</span>
                  )}
                  {story.storyPoints && (
                    <span>{story.storyPoints} pts</span>
                  )}
                  {story.assignee && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {story.assignee}
                    </div>
                  )}
                </div>
                <div>
                  {story.updatedAt && (
                    <span>Updated {new Date(story.updatedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {story.acceptanceCriteria.length} acceptance criteria
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStatusFilter = () => {
    const statusCounts = stories.reduce((acc, story) => {
      acc[story.status] = (acc[story.status] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
          }`}
        >
          All ({statusCounts.all || 0})
        </button>

        {Object.entries(STORY_STATUSES).map(([status, info]) => {
          const count = statusCounts[status] || 0;
          if (count === 0) return null;

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                statusFilter === status
                  ? info.color
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              {info.label} ({count})
            </button>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Loading stories...</span>
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
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div>BMAD Story Management</div>
              <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                Manage user stories throughout the development lifecycle
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={loadStories}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Refresh stories"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                New Story
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search stories by title, description, or epic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Status Filter */}
            {renderStatusFilter()}
          </div>

          {/* Stories Grid */}
          {filteredStories.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {stories.length === 0 ? 'No stories found' : 'No stories match your search'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {stories.length === 0 ? 'Create your first user story' : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStories.map(renderStoryCard)}
            </div>
          )}

          {/* Results Summary */}
          {filteredStories.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredStories.length} of {stories.length} stories
              {statusFilter !== 'all' && ` (${STORY_STATUSES[statusFilter]?.label} only)`}
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Story Modal */}
      {showCreateForm && (
        <CreateStoryModal
          onClose={() => setShowCreateForm(false)}
          onCreate={handleCreateStory}
        />
      )}

      {/* Story Details Modal */}
      {selectedStory && (
        <StoryDetailsModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
};

// Simple create story modal component
const CreateStoryModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    acceptanceCriteria: [''],
    epicName: '',
    storyPoints: 1
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onCreate({
        ...formData,
        id: `story_${Date.now()}`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptanceCriteria: formData.acceptanceCriteria.filter(ac => ac.trim())
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Create New Story
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Epic Name
                </label>
                <input
                  type="text"
                  value={formData.epicName}
                  onChange={(e) => setFormData(prev => ({ ...prev, epicName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Story Points
                </label>
                <select
                  value={formData.storyPoints}
                  onChange={(e) => setFormData(prev => ({ ...prev, storyPoints: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {[1, 2, 3, 5, 8, 13].map(points => (
                    <option key={points} value={points}>{points}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Create Story
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Simple story details modal component
const StoryDetailsModal = ({ story, onClose, onStatusUpdate }) => {
  const statusInfo = STORY_STATUSES[story.status] || STORY_STATUSES.draft;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              {story.title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {statusInfo.label}
              </Badge>
              {story.epicName && (
                <Badge variant="outline">Epic: {story.epicName}</Badge>
              )}
              {story.storyPoints && (
                <Badge variant="outline">{story.storyPoints} pts</Badge>
              )}
            </div>

            {story.description && (
              <div>
                <h4 className="font-medium text-gray-800 dark:text-white mb-2">Description</h4>
                <p className="text-gray-600 dark:text-gray-400">{story.description}</p>
              </div>
            )}

            {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 dark:text-white mb-2">
                  Acceptance Criteria ({story.acceptanceCriteria.length})
                </h4>
                <ul className="space-y-1">
                  {story.acceptanceCriteria.map((criteria, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {criteria}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">Change Status</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STORY_STATUSES).map(([status, info]) => {
                  const Icon = info.icon;
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        onStatusUpdate(story.id, status);
                        onClose();
                      }}
                      disabled={story.status === status}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                        story.status === status
                          ? info.color
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Icon className="w-3 h-3" />
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sample data for demo
function getSampleStories() {
  return [
    {
      id: 'story-1',
      title: 'User Registration with Email Validation',
      description: 'As a new user, I want to register with email validation so that I can securely access the application.',
      status: 'completed',
      epicName: 'User Authentication',
      storyPoints: 5,
      assignee: 'James (Dev)',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T15:30:00Z',
      acceptanceCriteria: [
        'User can enter email, password, and confirm password',
        'Email validation is performed client-side and server-side',
        'Confirmation email is sent to user',
        'Account is activated only after email confirmation'
      ]
    },
    {
      id: 'story-2',
      title: 'User Login with JWT Authentication',
      description: 'As a registered user, I want to login with my credentials so that I can access my personal tasks.',
      status: 'in_development',
      epicName: 'User Authentication',
      storyPoints: 3,
      assignee: 'James (Dev)',
      createdAt: '2024-01-16T09:00:00Z',
      updatedAt: '2024-01-22T11:45:00Z',
      acceptanceCriteria: [
        'User can login with email and password',
        'JWT token is generated and stored securely',
        'Invalid credentials show appropriate error message',
        'User is redirected to dashboard after successful login'
      ]
    },
    {
      id: 'story-3',
      title: 'Password Reset Functionality',
      description: 'As a user, I want to reset my password if I forget it so that I can regain access to my account.',
      status: 'ready',
      epicName: 'User Authentication',
      storyPoints: 8,
      createdAt: '2024-01-17T14:00:00Z',
      updatedAt: '2024-01-22T16:20:00Z',
      acceptanceCriteria: [
        'User can request password reset via email',
        'Reset link is sent to user email',
        'Reset link expires after 24 hours',
        'User can set new password using valid reset link'
      ]
    }
  ];
}

export default BmadStoryManager;