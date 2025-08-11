'use client';

/**
 * Scroll to bottom button component
 * Shows when user has scrolled up from the bottom of messages
 */
const ScrollToBottomButton = ({ isVisible, onClick }) => {
  if (!isVisible) return null;

  return (
    <div className="absolute bottom-6 right-6 z-10">
      <button
        onClick={onClick}
        className="bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        title="Scroll to bottom"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
    </div>
  );
};

export default ScrollToBottomButton;