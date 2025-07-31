export default function DocsLayout({ children }) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Docs Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
                ← Back to Dashboard
              </a>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                📚 Documentation
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Docs Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}