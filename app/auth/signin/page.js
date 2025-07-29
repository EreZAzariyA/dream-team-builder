'use client';

import { Suspense } from 'react';
import AuthForm from '../../../components/auth/AuthForm.js';

// Loading component
const AuthLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

export default function SignInPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <AuthForm mode="signin" />
    </Suspense>
  );
}
