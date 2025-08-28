import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define admin-only routes
const adminRoutes = [
  '/admin',
  '/api/admin',
  '/api/monitoring'
];

// Define protected routes that require authentication (both user and admin can access)
const protectedRoutes = [
  '/api/user',
  '/api/usage',
  '/api/ai',
  '/api/bmad',
  '/api/chat',
  '/api/integrations',
  '/api/pusher'
];

// Define public routes that don't require authentication
const publicRoutes = [
  '/api/bmad/test', // Test endpoint for BMAD system
  '/api/workflows/templates' // Public workflow templates endpoint
];

// Define user-only routes (admin cannot access)
const userRoutes = [
  '/dashboard',
  '/settings',
  '/agent-teams',
  '/agents',
  '/api/workflows',
  '/api/agents',
];

// Helper function to check if route is admin-only
const isAdminRoute = (pathname) => {
  return adminRoutes.some(route => pathname.startsWith(route));
};

// Helper function to check if route is public (no auth required)
const isPublicRoute = (pathname) => {
  return publicRoutes.some(route => pathname.startsWith(route));
};

// Helper function to check if route requires authentication
const isProtectedRoute = (pathname) => {
  return protectedRoutes.some(route => pathname.startsWith(route));
};

// Helper function to check if route is user-only
const isUserRoute = (pathname) => {
  return userRoutes.some(route => pathname.startsWith(route));
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  let token = null;
  let tokenError = null;
  
  try {
    token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
    });
  } catch (error) {
    tokenError = error;
    console.warn('Token validation failed in middleware:', {
      path: pathname,
      error: error.message,
      userAgent: request.headers.get('user-agent')?.substring(0, 100)
    });
    // Continue with null token to allow proper redirect handling
  }
  
  // If token retrieval failed due to malformed cookies, clear them
  if (tokenError && tokenError.message.includes('JWE')) {
    const response = NextResponse.redirect(new URL('/auth/signin', request.url));
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('__Host-next-auth.csrf-token');
    return response;
  }
  
  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Check admin access for admin routes
  if (isAdminRoute(pathname)) {
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(signInUrl);
    }
    
    if (token.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  // Check authentication for protected routes (both user and admin can access)
  else if (isProtectedRoute(pathname)) {
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(signInUrl);
    }
    // Both users and admins can access these routes, so no role restriction
  }
  
  // Check user access for user-only routes (prevent admin access)
  else if (isUserRoute(pathname)) {
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(signInUrl);
    }
    
    if (token.role === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/settings/:path*',
    '/agent-teams/:path*',
    '/agents/:path*',
    '/api/((?!auth).+)', // All API routes except /api/auth
  ],
};