'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import OnboardingWelcomeModal from './OnboardingWelcomeModal.js';
import OnboardingTour from './OnboardingTour.js';
import ProjectSetupWizard from './ProjectSetupWizard.js';

export default function OnboardingManager({ children }) {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [onboardingState, setOnboardingState] = useState({
    showWelcome: false,
    showTour: false,
    showProjectSetup: false,
    hasSeenOnboarding: false,
    isFirstTimeUser: false,
    selectedTemplate: null
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
      showWelcome: false
    }));
    markOnboardingAsSeen();
    // Navigate directly to workflows page for instant template selection
    router.push('/workflows');
  };

  const handleSkipOnboarding = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWelcome: false,
      showTour: false
    }));
    markOnboardingAsSeen();
  };

  // Handle tour completion
  const handleTourComplete = () => {
    setOnboardingState(prev => ({
      ...prev,
      showTour: false
    }));
    markOnboardingAsSeen();
    // Navigate directly to workflows page for instant template selection
    router.push('/workflows');
  };

  const handleTourSkip = () => {
    setOnboardingState(prev => ({
      ...prev,
      showTour: false
    }));
    markOnboardingAsSeen();
  };


  // Handle project setup wizard
  const handleProjectSetupComplete = (projectData) => {
    console.log('Project setup completed:', projectData);
    setOnboardingState(prev => ({
      ...prev,
      showProjectSetup: false,
      selectedTemplate: null
    }));
    markOnboardingAsSeen();
    
    // Navigate to workflows with comprehensive project data
    const queryParams = new URLSearchParams({
      template: projectData.template.id,
      name: encodeURIComponent(projectData.projectName),
      description: encodeURIComponent(projectData.compiledDescription),
      projectType: projectData.projectType || '',
      timeline: projectData.timeline || ''
    });
    
    router.push(`/workflows?autolaunch=true&${queryParams.toString()}`);
  };

  const handleProjectSetupClose = () => {
    setOnboardingState(prev => ({
      ...prev,
      showProjectSetup: false,
      selectedTemplate: null
    }));
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


      {/* Project Setup Wizard */}
      {onboardingState.showProjectSetup && (
        <ProjectSetupWizard
          isOpen={onboardingState.showProjectSetup}
          onClose={handleProjectSetupClose}
          onComplete={handleProjectSetupComplete}
          selectedTemplate={onboardingState.selectedTemplate}
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
  
  const showWorkflows = () => {
    // Navigate directly to workflows page for instant template selection
    window.location.href = '/workflows';
  };

  return {
    showWelcome,
    showTour,
    showWorkflows
  };
}

// Enhanced OnboardingManager that listens to custom events
export function OnboardingManagerWithEvents({ children }) {
  const router = useRouter();
  const [onboardingState, setOnboardingState] = useState({
    showWelcome: false,
    showTour: false,
    showWorkflows: false
  });


  useEffect(() => {
    const handleShowWelcome = () => {
      setOnboardingState(prev => ({ ...prev, showWelcome: true }));
    };
    
    const handleShowTour = () => {
      setOnboardingState(prev => ({ ...prev, showTour: true }));
    };
    
    const handleShowWorkflowLauncher = () => {
      setOnboardingState(prev => ({ ...prev, showWorkflows: true }));
    };

    window.addEventListener('showOnboardingWelcome', handleShowWelcome);
    window.addEventListener('showOnboardingTour', handleShowTour);
    window.addEventListener('showWorkflows', handleShowWorkflowLauncher);

    return () => {
      window.removeEventListener('showOnboardingWelcome', handleShowWelcome);
      window.removeEventListener('showOnboardingTour', handleShowTour);
      window.removeEventListener('showWorkflows', handleShowWorkflowLauncher);
    };
  }, []);

  // Handle workflow launcher actions
  const handleSelectTemplate = (template, workflowName, projectDescription) => {
    console.log('Selected BMAD template:', { template, workflowName, projectDescription });
    setOnboardingState(prev => ({
      ...prev,
      showWorkflows: false
    }));
    
    // Navigate to workflows page with template pre-selection  
    router.push(`/workflows?autolaunch=true&template=${template.id}&name=${encodeURIComponent(workflowName)}&description=${encodeURIComponent(projectDescription)}`);
  };

  const handleStartFromScratch = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWorkflows: false
    }));
    
    // Navigate to workflows page for custom BMAD workflow
    router.push('/workflows?mode=custom');
  };

  const handleCloseWorkflowLauncher = () => {
    setOnboardingState(prev => ({
      ...prev,
      showWorkflows: false
    }));
  };

  return (
    <>
      {children}
      
    </>
  );
}