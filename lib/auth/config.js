import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
// Temporarily disable MongoDB adapter to avoid encryption dependency issues

import { connectMongoose } from '../database/mongodb.js';
import { User } from '../database/models/index.js';
import { logUserActivity } from '../utils/activityLogger.js';
import logger from '../utils/logger.js';


export const authOptions = {
  // Use JWT sessions for better compatibility with credentials provider
  // Note: adapter is not used with JWT strategy
  session: {
    strategy: 'jwt',
    // Production: 30 minutes, Development: 3 hours
    maxAge: process.env.NODE_ENV === 'production' ? 30 * 60 : 3 * 60 * 60,
    updateAge: process.env.NODE_ENV === 'production' ? 20 * 60 : 90 * 60, // Longer update interval to reduce session calls
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
    async signIn({ user, account, profile }) {
      try {
        await connectMongoose();

        // Handle GitHub OAuth sign in (login only)
        if (account?.provider === 'github') {
          // Check if user already exists with this GitHub ID (returning user)
          const existingGitHubUser = await User.findOne({ githubId: account.providerAccountId });
          
          if (existingGitHubUser) {
            // Existing GitHub user - refresh token and login
            existingGitHubUser.githubAccessToken = account.access_token;
            await existingGitHubUser.save();
            await existingGitHubUser.updateLastLogin();
            logger.info(`🔄 GitHub login for existing user: ${existingGitHubUser.email}`);
            
            return {
              id: existingGitHubUser._id.toString(),
              email: existingGitHubUser.email,
              name: existingGitHubUser.profile.name,
              image: existingGitHubUser.profile.avatar,
              role: existingGitHubUser.profile.role,
              isEmailVerified: existingGitHubUser.isEmailVerified,
              githubId: existingGitHubUser.githubId,
              githubAccessToken: existingGitHubUser.githubAccessToken
            };
          }
          
          // Check if user exists by email (potential duplicate account)
          const existingEmailUser = await User.findByEmail(user.email);
          if (existingEmailUser) {
            // User exists with same email but no GitHub ID
            // This could be account linking, but we handle that separately now
            logger.warn(`GitHub login attempted for email already registered: ${user.email}`);
            return false; // Deny login - user should use integration linking instead
          }
          
          // Create new user from GitHub (fresh signup)
          const newUser = await User.createUser({
            email: user.email,
            githubId: account.providerAccountId,
            profile: {
              name: user.name || profile?.name || profile?.login,
              avatar: user.image || profile?.avatar_url,
            },
            isEmailVerified: true, // GitHub emails are pre-verified
            githubAccessToken: account.access_token,
          });
          
          await newUser.updateLastLogin();
          logger.info(`✨ New user created via GitHub login: ${user.email}`);
          
          return {
            id: newUser._id.toString(),
            email: newUser.email,
            name: newUser.profile.name,
            image: newUser.profile.avatar,
            role: newUser.profile.role,
            isEmailVerified: newUser.isEmailVerified,
            githubId: newUser.githubId,
            githubAccessToken: newUser.githubAccessToken
          };
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

    async session({ session, token, trigger, newSession }) {
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

        // If session is being updated (via update() call) or refreshed, get latest user data from database
        if (session.user.id && (trigger === 'update' || !token.githubId)) {
          try {
            await connectMongoose();
            
            let user = null;
            
            // First try to find by ID (if it's a valid ObjectId)
            try {
              const mongoose = require('mongoose');
              if (mongoose.Types.ObjectId.isValid(session.user.id)) {
                user = await User.findById(session.user.id);
              } else {
                throw new Error('Invalid ObjectId format');
              }
            } catch (findByIdError) {
              // If findById fails with cast error, it means session.user.id is not a valid ObjectId
              // This happens when session.user.id contains a provider ID instead of MongoDB ObjectId
              logger.info('Invalid ObjectId in session, searching by email instead:', findByIdError.message);
              if (session.user.email) {
                user = await User.findByEmail(session.user.email);
                
                if (user) {
                  // Fix the session and token with correct MongoDB ObjectId
                  session.user.id = user._id.toString();
                  token.sub = user._id.toString();
                  logger.info('Fixed session with correct MongoDB ObjectId:', user._id);
                }
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
            // Don't fail the session if database lookup fails - just continue with existing session
          }
        }

        return session;
      } catch (error) {
        console.error('Session callback error:', error);
        return session;
      }
    },

    async jwt({ token, user, account, trigger, session }) {
      try {
        const maxAge = process.env.NODE_ENV === 'production' ? 30 * 60 : 3 * 60 * 60;
        
        // Handle session updates (when update() is called)
        if (trigger === 'update' && session) {
          // Refresh user data from database
          await connectMongoose();
          if (token.sub) {
            try {
              const user = await User.findById(token.sub);
              if (user) {
                token.githubId = user.githubId;
                token.githubAccessToken = user.githubAccessToken;
              }
            } catch (error) {
              console.error('Failed to refresh user data in JWT callback:', error);
            }
          }
          return token;
        }
      
      // Initial sign in - only set expiry if token doesn't have one yet
      if (user && !token.exp) {
        // Set token expiry and issued time
        const now = Math.floor(Date.now() / 1000);
        token.iat = now;
        token.exp = now + maxAge;
        
        // For OAuth providers, ensure we use the correct MongoDB ObjectId
        if (account?.provider && (account.provider === 'google' || account.provider === 'github')) {
          // The signIn callback should have returned the correct user object
          // but let's ensure token.sub is set correctly
          if (user.id && user.id.length === 24) { // MongoDB ObjectId length
            token.sub = user.id;
          } else {
            // Fallback: lookup by email to get the correct MongoDB ObjectId
            try {
              await connectMongoose();
              const dbUser = await User.findByEmail(user.email);
              if (dbUser) {
                token.sub = dbUser._id.toString();
              }
            } catch (error) {
              console.error('Failed to fetch user in JWT callback:', error);
            }
          }
          
          // Set other user properties
          token.role = user.role;
          token.isEmailVerified = user.isEmailVerified;
          token.githubId = user.githubId;
          token.githubAccessToken = user.githubAccessToken;
        } else {
          // For credentials provider, user data should already be correct
          token.sub = user.id; // Make sure this is set
          token.role = user.role;
          token.isEmailVerified = user.isEmailVerified;
          token.githubId = user.githubId;
        }
      } else {
        // Check if token is expired with grace period
        const now = Math.floor(Date.now() / 1000);
        const gracePeriod = 5 * 60; // 5 minute grace period
        
        if (token.exp && now > (token.exp + gracePeriod)) {
          // Token has expired beyond grace period
          console.warn('JWT token expired beyond grace period, clearing session');
          return null;
        }
        
        // Handle tokens without expiration - set a new expiration instead of rejecting
        if (!token.exp) {
          console.warn('Token missing expiration, setting new expiration');
          token.iat = now;
          token.exp = now + maxAge;
        }
        
        // Handle expired tokens within grace period
        if (token.exp && now > token.exp && now <= (token.exp + gracePeriod)) {
          console.info('JWT token expired but within grace period, refreshing');
          token.iat = now;
          token.exp = now + maxAge;
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
    } catch (error) {
      console.error('JWT callback error:', error);
      // Return token as-is if there's an error to avoid breaking auth completely
      return token;
    }
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
        logger.info(`🎉 New user registered: ${user.email}`);
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
      logger.info(`🔗 Account linked: ${account.provider} for ${user.email}`);
      logger.info({ user, account });
      
    },

    async session({ session }) {
      // Called whenever a session is checked
      // Can be used for analytics or session tracking
    },
  },

  // Security options
  useSecureCookies: process.env.NODE_ENV === 'production',
  
  // Debug mode for development - explicitly disabled in production to prevent file system operations
  debug: process.env.NODE_ENV === 'development' && process.env.NEXTAUTH_DEBUG === 'true',

  // Theme
  theme: {
    colorScheme: 'auto', // "auto" | "dark" | "light"
    brandColor: '#3b82f6', // Blue
    logo: '/logo.svg', // Add your logo
  },
};

export default authOptions;