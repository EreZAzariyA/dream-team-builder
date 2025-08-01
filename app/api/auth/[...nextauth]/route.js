import NextAuth from 'next-auth';
import { authOptions } from '../../../../lib/auth/config.js';

// Initialize NextAuth with our configuration
const handler = NextAuth(authOptions);

// Export named exports for each HTTP method (required in App Router)
export const GET = handler;
export const POST = handler;