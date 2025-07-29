import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
// Temporarily disable MongoDB adapter to avoid encryption dependency issues
// import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { connectMongoose } from '../database/mongodb.js';
import { User } from '../database/models/index.js';

export const authOptions = {
  // Use JWT sessions for now (can switch to database sessions later)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
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
          console.error('Authentication error:', error);
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
  ],


  // JWT configuration (for API tokens)
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

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
    async signIn({ user, account, profile, email, credentials }) {
      try {
        await connectMongoose();

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
        }

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
        }

        return session;
      } catch (error) {
        console.error('Session callback error:', error);
        return session;
      }
    },

    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (user) {
        token.role = user.role;
        token.isEmailVerified = user.isEmailVerified;
      }

      return token;
    },

    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful authentication
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },

  // Event handlers
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`✅ User signed in: ${user.email} via ${account?.provider || 'credentials'}`);
      
      if (isNewUser) {
        console.log(`🎉 New user registered: ${user.email}`);
        // You could send welcome email here
      }
    },

    async signOut({ session, token }) {
      console.log(`👋 User signed out: ${session?.user?.email || 'Unknown'}`);
    },

    async createUser({ user }) {
      console.log(`👤 User created in database: ${user.email}`);
    },

    async linkAccount({ user, account, profile }) {
      console.log(`🔗 Account linked: ${account.provider} for ${user.email}`);
    },

    async session({ session, token }) {
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