// Client-safe auth configuration (no database imports)
// This is used for client-side NextAuth components

export const publicAuthConfig = {
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup', 
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/welcome',
  },
  
  providers: [
    // Only include provider configurations that don't require server-side imports
    {
      id: 'credentials',
      name: 'Email and Password',
      type: 'credentials',
    },
    {
      id: 'google',
      name: 'Google',
      type: 'oauth',
    }
  ],
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Theme configuration
  theme: {
    colorScheme: 'auto',
    brandColor: '#3b82f6',
    logo: '/logo.svg',
  },
};