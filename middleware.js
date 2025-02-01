// middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose'; // Import jwtVerify from 'jose'
import { rateLimitMiddleware } from './middleware/rateLimit';
import { withSecureHeaders } from 'next-secure-headers';

const publicPaths = [
  '/api/auth/login',
  '/api/auth/logout',
  '/auth/login',
  '/auth/signup',
  '/favicon.ico',
  '/api/users'
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/request-account')
  ) {
    return rateLimitMiddleware(request);
  }

  // Allow access to public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth_token')?.value;

  // If authenticated user tries to access login page, redirect to home
  if (token && pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    // Verify token using 'jose'
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);

    // If token is valid, proceed
    return NextResponse.next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    // If token is invalid, redirect to login
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - images (your local images folder)
     * - favicon.ico (favicon file)
     * - Public API routes and pages
     */
    '/((?!_next/static|_next/image|images|favicon.ico|api/auth/login|api/auth/logout|auth/login|auth/signup).*)',
  ],
};
