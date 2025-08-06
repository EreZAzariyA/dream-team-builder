'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import OnboardingWelcomeModal from './OnboardingWelcomeModal.js';
import OnboardingTour from './OnboardingTour.js';
import WorkflowLauncherModal from './WorkflowLauncherModal.js';

export default function OnboardingManager({ children }) {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [onboardingState, setOnboardingState] = useState({
    showWelcome: false,
    showTour: false,
    showWorkflowLauncher: false,
    hasSeenOnboarding: false,
    isFirstTimeUser: false
  });

  // Check if user has seen onboarding before
  useEffect(() => {
    if (session?.user) {
      const hasSeenOnboarding = localStorage.getItem(`hasSeenOnboarding_${session.user.id}`);
      const isFirstTimeUser = !hasSeenOnboarding;
      
      setOnboardingState(prev => ({
        ...prev,
        hasSeenOnboarding: !!hasSeenOnboarding,
        isFirstTimeUser,
        showWelcome: isFirstTimeUser
      }));
    }
  }, [session]);

  // Mark onboarding as seen
  const markOnboardingAsSeen = () => {
    if (session?.user) {
      localStorage.setItem(`hasSeenOnboarding_${session.user.id}`, 'true');
      setOnboardingState(prev => ({
        ...prev,
        hasSeenOnboarding: true,
        isFirstTimeUser: false
      }));
    }
  };

  // Handle welcome modal actions
  const handleStartTour = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWelcome: false,
      showTour: true
    }));
  };

  const handleQuickStart = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWelcome: false,
      showWorkflowLauncher: true
    }));
  };

  const handleSkipOnboarding = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWelcome: false,
      showTour: false,
      showWorkflowLauncher: false
    }));
    markOnboardingAsSeen();
  };

  // Handle tour completion
  const handleTourComplete = () => {
    setOnboardingState(prev => ({
      ...prev,
      showTour: false,
      showWorkflowLauncher: true
    }));
  };

  const handleTourSkip = () => {
    setOnboardingState(prev => ({
      ...prev,
      showTour: false
    }));
    markOnboardingAsSeen();
  };

  // Handle workflow launcher actions
  const handleSelectTemplate = (template) => {
    logger.info('Selected template:', template);
    setOnboardingState(prev => ({
      ...prev,
      showWorkflowLauncher: false
    }));
    markOnboardingAsSeen();
    
    // Navigate to chat interface with template pre-selected
    router.push(`/chat?template=${template.id}`);
  };

  const handleStartFromScratch = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWorkflowLauncher: false
    }));
    markOnboardingAsSeen();
    
    // Navigate to chat interface
    router.push('/chat');
  };

  const handleCloseWorkflowLauncher = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWorkflowLauncher: false
    }));
    markOnboardingAsSeen();
  };

  

  return (
    <>
      {children}
      
      {/* Welcome Modal */}
      {onboardingState.showWelcome && (
        <OnboardingWelcomeModal
          onClose={handleSkipOnboarding}
          onStartTour={handleStartTour}
          onQuickStart={handleQuickStart}
        />
      )}

      {/* Interactive Tour */}
      {onboardingState.showTour && (
        <OnboardingTour
          isActive={onboardingState.showTour}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}

      {/* Workflow Launcher Modal */}
      {onboardingState.showWorkflowLauncher && (
        <WorkflowLauncherModal
          isOpen={onboardingState.showWorkflowLauncher}
          onClose={handleCloseWorkflowLauncher}
          onSelectTemplate={handleSelectTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      )}
    </>
  );
}

// Hook for accessing onboarding controls from other components
export function useOnboarding() {
  
  const showWelcome = () => {
    // Trigger welcome modal
    window.dispatchEvent(new CustomEvent('showOnboardingWelcome'));
  };
  
  const showTour = () => {
    // Trigger tour
    window.dispatchEvent(new CustomEvent('showOnboardingTour'));
  };
  
  const showWorkflowLauncher = () => {
    // Trigger workflow launcher
    window.dispatchEvent(new CustomEvent('showWorkflowLauncher'));
  };

  return {
    showWelcome,
    showTour,
    showWorkflowLauncher
  };
}

// Enhanced OnboardingManager that listens to custom events
export function OnboardingManagerWithEvents({ children }) {
  const router = useRouter();
  const [onboardingState, setOnboardingState] = useState({
    showWelcome: false,
    showTour: false,
    showWorkflowLauncher: false
  });


  useEffect(() => {
    const handleShowWelcome = () => {
      setOnboardingState(prev => ({ ...prev, showWelcome: true }));
    };
    
    const handleShowTour = () => {
      setOnboardingState(prev => ({ ...prev, showTour: true }));
    };
    
    const handleShowWorkflowLauncher = () => {
      setOnboardingState(prev => ({ ...prev, showWorkflowLauncher: true }));
    };

    window.addEventListener('showOnboardingWelcome', handleShowWelcome);
    window.addEventListener('showOnboardingTour', handleShowTour);
    window.addEventListener('showWorkflowLauncher', handleShowWorkflowLauncher);

    return () => {
      window.removeEventListener('showOnboardingWelcome', handleShowWelcome);
      window.removeEventListener('showOnboardingTour', handleShowTour);
      window.removeEventListener('showWorkflowLauncher', handleShowWorkflowLauncher);
    };
  }, []);

  // Handle workflow launcher actions
  const handleSelectTemplate = (template) => {
    logger.info('Selected template:', template);
    setOnboardingState(prev => ({
      ...prev,
      showWorkflowLauncher: false
    }));
    
    // Navigate to chat interface with template pre-selected
    router.push(`/chat?template=${template.id}`);
  };

  const handleStartFromScratch = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWorkflowLauncher: false
    }));
    
    // Navigate to chat interface
    router.push('/chat');
  };

  const handleCloseWorkflowLauncher = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWorkflowLauncher: false
    }));
  };

  return (
    <>
      {children}
      
      {/* Workflow Launcher Modal */}
      {onboardingState.showWorkflowLauncher && (
        <WorkflowLauncherModal
          isOpen={onboardingState.showWorkflowLauncher}
          onClose={handleCloseWorkflowLauncher}
          onSelectTemplate={handleSelectTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      )}
    </>
  );
}