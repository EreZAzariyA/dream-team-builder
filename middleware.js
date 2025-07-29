// Temporarily disable middleware to fix OIDC error
// Re-export the auth middleware as the main middleware
// export { default, config } from './lib/auth/middleware.js';

import { NextResponse } from 'next/server';

export function middleware(request) {
  // For now, just allow all requests
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