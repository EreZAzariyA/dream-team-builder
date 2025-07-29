import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './config.js';

// Define protected routes
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/settings',
  '/workflows',
  '/agents',
  '/api/user',
  '/api/workflows',
  '/api/agents',
];

// Define admin-only routes
const adminRoutes = [
  '/admin',
  '/api/admin',
];

// Define public routes (accessible without authentication)
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/error',
  '/auth/verify-request',
  '/api/auth',
  '/api/health',
];

// Helper function to check if route is protected
const isProtectedRoute = (pathname) => {
  return protectedRoutes.some(route => pathname.startsWith(route));
};

// Helper function to check if route is admin-only
const isAdminRoute = (pathname) => {
  return adminRoutes.some(route => pathname.startsWith(route));
};

// Helper function to check if route is public
const isPublicRoute = (pathname) => {
  return publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Allow public routes
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Check if user is authenticated for protected routes
    if (isProtectedRoute(pathname) && !token) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Check admin access for admin routes
    if (isAdminRoute(pathname)) {
      if (!token) {
        const signInUrl = new URL('/auth/signin', req.url);
        signInUrl.searchParams.set('callbackUrl', req.url);
        return NextResponse.redirect(signInUrl);
      }
      
      if (token.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    // Add security headers
    const response = NextResponse.next();
    
    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (basic)
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Always allow public routes
        if (isPublicRoute(pathname)) {
          return true;
        }
        
        // For protected routes, require token
        if (isProtectedRoute(pathname)) {
          return !!token;
        }
        
        // For admin routes, require admin role
        if (isAdminRoute(pathname)) {
          return token?.role === 'admin';
        }
        
        // Default: allow if authenticated
        return !!token;
      },
    },
  }
);

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

// Export utility functions for use in API routes
export const authMiddleware = {
  isProtectedRoute,
  isAdminRoute,
  isPublicRoute,
  
  // Check if user is authenticated (for API routes)
  requireAuth: (handler) => {
    return async (req, res) => {
      const session = await getServerSession(req, res, authOptions);
      
      if (!session) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }
      
      req.session = session;
      return handler(req, res);
    };
  },
  
  // Check if user is admin (for API routes)
  requireAdmin: (handler) => {
    return async (req, res) => {
      const session = await getServerSession(req, res, authOptions);
      
      if (!session) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }
      
      if (session.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'FORBIDDEN'
        });
      }
      
      req.session = session;
      return handler(req, res);
    };
  }
};