'use client';

import Link from "next/link";
import { Bot, Zap, Workflow, Users, BarChart, Plug } from "lucide-react";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900">
      {/* Navigation Header */}
      <header className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-h3 font-bold text-gray-900 dark:text-white">Dream Team</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/docs" className="text-body text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Documentation
            </Link>
            {session ? (
              <Link href="/dashboard" className="btn-primary">
                Dashboard
              </Link>
            ) : (
              <Link href="/auth/signin" className="btn-primary">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-6">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400 text-body-small font-medium mb-6">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              BMAD Architecture Ready
            </div>
          </div>
          <h1 className="text-display text-gray-900 dark:text-white mb-6">
            AI-Powered Development
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Agent Orchestration
            </span>
          </h1>
          <p className="text-body-large text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Streamline your development workflow with autonomous AI agents. From project management to deployment, 
            let our BMAD system coordinate PM, Architect, Developer, and QA agents to deliver professional results.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {session ? (
              <Link href="/dashboard" className="btn-primary">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/auth/signup" className="btn-primary">
                  Get Started Free
                </Link>
                <Link href="/dashboard" className="btn-outline">
                  View Dashboard
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="group p-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-h4 text-gray-900 dark:text-white mb-3">BMAD Agent System</h3>
            <p className="text-body text-gray-600 dark:text-gray-300">
              Coordinate PM, Architect, Developer, and QA agents for complete project automation
            </p>
          </div>
          
          <div className="group p-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-h4 text-gray-900 dark:text-white mb-3">Real-time Workflows</h3>
            <p className="text-body text-gray-600 dark:text-gray-300">
              Live workflow visualization with WebSocket integration and instant updates
            </p>
          </div>
          
          <div className="group p-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-h4 text-gray-900 dark:text-white mb-3">Smart Architecture</h3>
            <p className="text-body text-gray-600 dark:text-gray-300">
              Redux Toolkit + React Query + WebSocket for enterprise-grade performance
            </p>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-h2 text-gray-900 dark:text-white mb-4">
              Experience the Power
            </h2>
            <p className="text-body text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              See how our AI agents work together to deliver complete development workflows
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <BarChart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-h4 text-gray-900 dark:text-white mb-1">Analytics</div>
              <div className="text-caption text-gray-600 dark:text-gray-400">Performance Insights</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-h4 text-gray-900 dark:text-white mb-1">Agents</div>
              <div className="text-caption text-gray-600 dark:text-gray-400">AI Workforce</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Workflow className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-h4 text-gray-900 dark:text-white mb-1">Workflows</div>
              <div className="text-caption text-gray-600 dark:text-gray-400">Automated Processes</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Plug className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-h4 text-gray-900 dark:text-white mb-1">Integrations</div>
              <div className="text-caption text-gray-600 dark:text-gray-400">Connect Everything</div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-8 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-h3 text-gray-900 dark:text-white mb-2">
                System Status
              </h3>
              <p className="text-body text-gray-600 dark:text-gray-300">
                All systems operational and ready for production
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-body-small font-medium text-gray-700 dark:text-gray-300">Redux Store</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-body-small font-medium text-gray-700 dark:text-gray-300">React Query</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-body-small font-medium text-gray-700 dark:text-gray-300">WebSocket</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="text-h4 font-bold text-gray-900 dark:text-white">Dream Team</span>
            </div>
            <p className="text-body text-gray-600 dark:text-gray-300 mb-4">
              AI-Powered Development Agent Orchestration Platform
            </p>
            <div className="flex items-center justify-center space-x-6 text-body-small text-gray-500 dark:text-gray-400">
              <Link href="/docs" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Documentation
              </Link>
              <Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                Dashboard
              </Link>
              {!session && (
                <Link href="/auth/signin" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
