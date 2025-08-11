'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AgentChatLauncher from '@/components/workflow/AgentChatLauncher';
import { MessageCircle, Bot, Users, Sparkles, Activity, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/common/Card';

const AgentChatPage = () => {
  const [stats, setStats] = useState({
    totalChats: 0,
    activeAgents: 8,
    avgResponseTime: '0.8s',
    userSatisfaction: '94%'
  });
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
              Agent Chat
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Chat directly with AI agent personas without workflow overhead
            </p>
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

      {/* Additional Information */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* How It Works */}
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-500" />
              How Agent Chat Works
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Select an Agent</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Choose from 8 specialized AI agents, each with unique expertise</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Start Conversation</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Begin chatting naturally - no formal commands or workflows required</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Get Expert Advice</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive persona-appropriate responses and expert guidance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="bg-white dark:bg-gray-800">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Best Practices
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Be Specific</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Provide context and specific details to get more targeted advice</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Choose the Right Agent</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Match your question to the agent&apos;s expertise for best results</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Use Quick Actions</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Try the quick action buttons for common scenarios</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Follow Up</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Ask follow-up questions to dive deeper into topics</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentChatPage;