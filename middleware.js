import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Define admin-only routes
const adminRoutes = [
  '/admin',
  '/api/admin',
];

// Define user-only routes (admin cannot access)
const userRoutes = [
  '/dashboard',
  '/profile',
  '/settings',
  '/workflows',
  '/agents',
  '/api/user',
  '/api/workflows',
  '/api/agents',
];

// Helper function to check if route is admin-only
const isAdminRoute = (pathname) => {
  return adminRoutes.some(route => pathname.startsWith(route));
};

// Helper function to check if route is user-only
const isUserRoute = (pathname) => {
  return userRoutes.some(route => pathname.startsWith(route));
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  const token = await getToken({ req: request });
  
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
  
  // Check user access for user routes (prevent admin access)
  if (isUserRoute(pathname)) {
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