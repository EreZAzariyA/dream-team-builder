'use client';

import { useState, useEffect } from 'react';
import AgentChatLauncher from '@/components/agent-chat/AgentChatLauncher';
import { MessageCircle, Bot, Sparkles, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';
import { AdditionalInformation } from '@/components/agent-chat/components/AdditionalInformation';

const AgentChatPage = () => {
  const [stats, setStats] = useState({
    totalChats: 0,
    activeAgents: 0,
    avgResponseTime: '0.0',
    userSatisfaction: '0%'
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Simulate loading chat statistics
    const loadStats = async () => {
      try {
        // In a real implementation, you'd fetch this from an API
        await new Promise(resolve => setTimeout(resolve, 500));
        setStats({
          totalChats: 142,
          activeAgents: 8,
          avgResponseTime: '0.8s',
          userSatisfaction: '94%'
        });
      } catch (error) {
        console.error('Error loading chat stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
                Agent Chat
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Chat with AI agents directly or interact with live workflows
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Chats</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '---' : stats.totalChats}
                  </p>
                </div>
                <MessageCircle className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Agents</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '--' : stats.activeAgents}
                  </p>
                </div>
                <Bot className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Response</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '---' : stats.avgResponseTime}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Satisfaction</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? '---%' : stats.userSatisfaction}
                  </p>
                </div>
                <Sparkles className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500 text-white p-2 rounded-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Direct Agent Communication
              </h3>
              <p className="text-blue-700 dark:text-blue-200 text-sm">
                Chat with AI agents in their specialized personas without the overhead of formal workflows. 
                Perfect for quick questions, brainstorming, or getting expert advice on specific topics.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <AgentChatLauncher />

      <AdditionalInformation />
    </div>
  );
};

export default AgentChatPage;