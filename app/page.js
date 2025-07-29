import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start max-w-4xl">
        
        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            🎯 Dream Team
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
            AI-powered documentation assistant with BMAD agent workflow visualization
          </p>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Redux Toolkit + React-Query + WebSocket Architecture Ready
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-8">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">BMAD Agents</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Autonomous agents for PM, Architect, Dev, and QA workflows
            </p>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Real-time Updates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Live workflow visualization with WebSocket integration
            </p>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl mb-3">🔄</div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">State Management</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Redux Toolkit with intelligent caching via React-Query
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 items-center flex-col sm:flex-row mt-8">
          <Link
            href="/auth/signin"
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue-600 text-white gap-2 hover:bg-blue-700 font-medium text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            🔐 Sign In
          </Link>
          
          <Link
            href="/auth/signup"
            className="rounded-full border border-solid border-green-600 text-green-600 dark:text-green-400 transition-colors flex items-center justify-center hover:bg-green-50 dark:hover:bg-green-900/20 font-medium text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            👤 Sign Up
          </Link>
          
          <Link
            href="/dashboard"
            className="rounded-full border border-solid border-blue-600 text-blue-600 dark:text-blue-400 transition-colors flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm sm:text-base h-12 px-6 w-full sm:w-auto"
          >
            📊 Dashboard
          </Link>
        </div>

        {/* Architecture Status */}
        <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mt-8">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            🏗️ Architecture Status
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-green-500 font-mono text-lg">✓</div>
              <div className="text-gray-600 dark:text-gray-400">Redux Store</div>
            </div>
            <div className="text-center">
              <div className="text-green-500 font-mono text-lg">✓</div>
              <div className="text-gray-600 dark:text-gray-400">React Query</div>
            </div>
            <div className="text-center">
              <div className="text-green-500 font-mono text-lg">✓</div>
              <div className="text-gray-600 dark:text-gray-400">WebSocket</div>
            </div>
            <div className="text-center">
              <div className="text-green-500 font-mono text-lg">✓</div>
              <div className="text-gray-600 dark:text-gray-400">Providers</div>
            </div>
          </div>
        </div>

      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
