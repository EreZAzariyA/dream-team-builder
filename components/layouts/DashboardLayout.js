'use client';

import Sidebar from './Sidebar';
import Header from './Header';
import MainContent from './MainContent';
import OnboardingManager from '../onboarding/OnboardingManager';
import { ToastContainer } from '../ui/ToastContainer';

const DashboardLayout = ({ children }) => {
  return (
    <OnboardingManager>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-professional">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <MainContent>
            {children}
          </MainContent>
        </div>
      </div>
      <ToastContainer />
    </OnboardingManager>
  );
};

export default DashboardLayout;