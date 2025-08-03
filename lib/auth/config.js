import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
// Temporarily disable MongoDB adapter to avoid encryption dependency issues

import { connectMongoose } from '../database/mongodb.js';
import { User } from '../database/models/index.js';
import { logUserActivity } from '../utils/activityLogger.js';
import { getToken } from 'next-auth/jwt';

export const authOptions = {
  // Use JWT sessions for better compatibility with credentials provider
  // Note: adapter is not used with JWT strategy
  session: {
    strategy: 'jwt',
    // Production: 30 minutes, Development: 3 hours
    maxAge: process.env.NODE_ENV === 'production' ? 30 * 60 : 3 * 60 * 60,
    updateAge: process.env.NODE_ENV === 'production' ? 15 * 60 : 60 * 60, // Half of maxAge
  },
  
  // Configure authentication providers
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { 
          label: 'Email', 
          type: 'email',
          placeholder: 'your@email.com'
        },
        password: { 
          label: 'Password', 
          type: 'password',
          placeholder: 'Your password'
        },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error('Email and password required');
          }

          // Connect to database
          await connectMongoose();

          // Find user by email
          const user = await User.findByEmail(credentials.email);
          if (!user) {
            throw new Error('No user found with this email');
          }

          // Check if user is active
          if (!user.isActive) {
            throw new Error('Account is deactivated');
          }

          // Verify password
          const isPasswordValid = await user.comparePassword(credentials.password);
          if (!isPasswordValid) {
            throw new Error('Invalid password');
          }

          // Update last login
          await user.updateLastLogin();

          // Return user object for session
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.profile.name,
            image: user.profile.avatar,
            role: user.profile.role,
            isEmailVerified: user.isEmailVerified,
          };

        } catch (error) {
          console.error('Authentication error:', error?.message);
          throw error;
        }
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      allowDangerousEmailAccountLinking: false,
      authorization: {
        url: "https://github.com/login/oauth/authorize",
        params: {
          scope: "read:user user:email repo",
          prompt: "consent"
        },
      },
    }),
  ],

  // JWT configuration (for API tokens)
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Add secret at root level for NextAuth v4+
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development',

  // Custom pages
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/welcome',
  },

  // Callbacks for customizing behavior
  callbacks: {
    async signIn({ user, account }) {
      try {
        await connectMongoose();

        // Handle GitHub OAuth sign in (including account linking)
        if (account?.provider === 'github') {
          let existingUser = await User.findByEmail(user.email);
          
          if (!existingUser) {
            // Check if this is an account linking attempt by looking for GitHub user with same email
            // In a real scenario, you might want to check localStorage or session data
            // For now, we'll create a new user or find existing by email
            const potentialUser = await User.findByEmail(user.email);
            if (potentialUser) {
              existingUser = potentialUser;
            }
          }
          
          if (!existingUser) {
            // Create new user from GitHub profile
            existingUser = await User.createUser({
              email: user.email,
              githubId: account.providerAccountId,
              profile: {
                name: user.name || profile?.name || profile?.login,
                avatar: user.image || profile?.avatar_url,
              },
              isEmailVerified: true, // GitHub emails are pre-verified
              githubAccessToken: account.access_token,
            });
          } else {
            // Link GitHub account to existing user (this handles account linking)
            if (!existingUser.githubId) {
              existingUser.githubId = account.providerAccountId;
              existingUser.githubAccessToken = account.access_token;
              if (!existingUser.profile.avatar && user.image) {
                existingUser.profile.avatar = user.image;
              }
              await existingUser.save();
            } else {
              // Update GitHub access token for existing GitHub-linked user
              existingUser.githubAccessToken = account.access_token;
              await existingUser.save();
            }
          }

          // Update last login
          await existingUser.updateLastLogin();
          return existingUser;
        }

        // Handle Google OAuth sign in
        if (account?.provider === 'google') {
          let existingUser = await User.findByEmail(user.email);
          
          if (!existingUser) {
            // Create new user from Google profile
            existingUser = await User.createUser({
              email: user.email,
              googleId: account.providerAccountId,
              profile: {
                name: user.name || profile?.name,
                avatar: user.image || profile?.picture,
              },
              isEmailVerified: true, // Google emails are pre-verified
            });
          } else if (!existingUser.googleId) {
            // Link Google account to existing user
            existingUser.googleId = account.providerAccountId;
            if (!existingUser.profile.avatar && user.image) {
              existingUser.profile.avatar = user.image;
            }
            await existingUser.save();
          }

          // Update last login
          await existingUser.updateLastLogin();
          return existingUser;
        }
        // For other providers (e.g., credentials) or if no existingUser found/created for Google
        return true;
      } catch (error) {
        console.error('Sign in callback error:', error);
        return false;
      }
    },

    async session({ session, token }) {
      try {
        // Add token data to session
        if (token) {
          session.user.id = token.sub;
          session.user.role = token.role || 'user';
          session.user.isEmailVerified = token.isEmailVerified || false;
          session.user.name = token.name;
          session.user.email = token.email;
          session.user.image = token.picture;
          session.user.githubId = token.githubId;
          session.user.githubAccessToken = token.githubAccessToken;
        }

        // If session is being refreshed and githubId is missing, get updated user data from database
        if (session.user.id && !token.githubId) {
          try {
            await connectMongoose();
            
            let user = null;
            
            // First try to find by ID (if it's a valid ObjectId)
            try {
              user = await User.findById(session.user.id);
            } catch (e) {
              // If findById fails with cast error, it means session.user.id is not a valid ObjectId
              // This happens when session.user.id contains a provider ID instead of MongoDB ObjectId
              console.log('Invalid ObjectId in session, searching by email instead');
              user = await User.findByEmail(session.user.email);
              
              if (user) {
                // Fix the session and token with correct MongoDB ObjectId
                session.user.id = user._id.toString();
                token.sub = user._id.toString();
                console.log('Fixed session with correct MongoDB ObjectId:', user._id);
              }
            }
            
            if (user) {
              if (user.githubId) {
                session.user.githubId = user.githubId;
                token.githubId = user.githubId;
              }
              if (user.githubAccessToken) {
                session.user.githubAccessToken = user.githubAccessToken;
                token.githubAccessToken = user.githubAccessToken;
              }
            }
          } catch (dbError) {
            console.error('Failed to fetch updated user data:', dbError);
          }
        }

        return session;
      } catch (error) {
        console.error('Session callback error:', error);
        return session;
      }
    },

    async jwt({ token, user, account, trigger }) {
      const maxAge = process.env.NODE_ENV === 'production' ? 30 * 60 : 3 * 60 * 60;
      
      // Initial sign in - only set expiry if token doesn't have one yet
      if (user && !token.exp) {
        // Set token expiry and issued time
        const now = Math.floor(Date.now() / 1000);
        token.iat = now;
        token.exp = now + maxAge;
        
        // For OAuth providers, user.id might be the provider ID, not MongoDB ObjectId
        // We need to find the actual MongoDB user
        if (account?.provider && (account.provider === 'google' || account.provider === 'github')) {
          try {
            await connectMongoose();
            const dbUser = await User.findByEmail(user.email);
            if (dbUser) {
              token.sub = dbUser._id.toString(); // Set the MongoDB ObjectId as the subject
              token.role = dbUser.profile.role;
              token.isEmailVerified = dbUser.isEmailVerified;
              token.githubId = dbUser.githubId;
              token.githubAccessToken = dbUser.githubAccessToken;
            }
          } catch (error) {
            console.error('Failed to fetch user in JWT callback:', error);
          }
        } else {
          // For credentials provider, user data should already be correct
          token.role = user.role;
          token.isEmailVerified = user.isEmailVerified;
          token.githubId = user.githubId;
        }
      } else {
        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if (token.exp && now > token.exp) {
          // Token has expired, force re-authentication
          return null;
        }
        
        // Don't create new tokens - only use existing ones
        if (!token.exp) {
          return null;
        }
        
        // Update token expiry on each request (sliding expiration)
        const timeUntilExpiry = token.exp - now;
        const refreshThreshold = maxAge * 0.5; // Refresh when 50% of lifetime remains
        
        if (timeUntilExpiry < refreshThreshold) {
          token.iat = now;
          token.exp = now + maxAge;
        }
      }
      
      return token;
    },

    async redirect({ url, baseUrl }) {
      // If url is a relative path, construct full URL
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      
      // If url is a full URL with same origin, use it
      if (url.startsWith(baseUrl)) return url;
      
      // For external URLs or invalid URLs, redirect to dashboard
      return `${baseUrl}/dashboard`;
    },
  },

  // Event handlers
  events: {
    async signIn({ user, account }) {
      let isNewUser = null;
      // Get the actual MongoDB user ID for activity logging
      if (account?.provider) {
        try {
          await connectMongoose();
          const dbUser = await User.findByEmail(user.email);
          if (dbUser) {
            await logUserActivity(dbUser._id, 'login', { method: account.provider });
            isNewUser = false;
          }
        } catch (error) {
          console.error('Failed to log OAuth login activity:', error);
        }
      } else {
        // For credentials login, user.id should already be the MongoDB ObjectId
        await logUserActivity(user.id, 'login', { method: 'credentials' });
      }
      
      if (isNewUser) {
        console.log(`🎉 New user registered: ${user.email}`);
        // You could send welcome email here
      }
    },

    async signOut({ session }) {
      
      // Log user logout activity with proper MongoDB ObjectId
      if (session?.user?.id) {
        try {
          // session.user.id should be the MongoDB ObjectId in JWT sessions
          await logUserActivity(session.user.id, 'logout');
        } catch (error) {
          console.error('Failed to log logout activity:', error);
        }
      }
    },

    async createUser({ user }) {
    },

    async linkAccount({ user, account }) {
      console.log(`🔗 Account linked: ${account.provider} for ${user.email}`);
      console.log({ user, account });
      
    },

    async session({ session }) {
      // Called whenever a session is checked
      // Can be used for analytics or session tracking
    },
  },

  // Security options
  useSecureCookies: process.env.NODE_ENV === 'production',
  
  // Debug mode for development
  debug: process.env.NODE_ENV === 'development',

  // Theme
  theme: {
    colorScheme: 'auto', // "auto" | "dark" | "light"
    brandColor: '#3b82f6', // Blue
    logo: '/logo.svg', // Add your logo
  },
};

export default authOptions;