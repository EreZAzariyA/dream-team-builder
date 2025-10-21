'use client';

import { Card, CardContent } from "@/components/common/Card";
import { Activity, Sparkles } from "lucide-react";

/**
 * Chat header component
 * Shows agent info and window controls
 */
export const AdditionalInformation = () => {
  return (
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
  );
};