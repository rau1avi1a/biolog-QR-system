// middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Simplified rate limiting implementation
const WINDOW_SIZE = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute
const ipRequests = new Map();

function rateLimit(request) {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  
  const requestTimestamps = ipRequests.get(ip) || [];
  const validTimestamps = requestTimestamps.filter(timestamp => 
    now - timestamp < WINDOW_SIZE
  );

  if (validTimestamps.length >= MAX_REQUESTS) {
    return true; // Rate limit exceeded
  }

  validTimestamps.push(now);
  ipRequests.set(ip, validTimestamps);

  // Clean up old entries periodically
  if (Math.random() < 0.1) {
    for (const [key, timestamps] of ipRequests.entries()) {
      const validTs = timestamps.filter(ts => now - ts < WINDOW_SIZE);
      if (validTs.length === 0) {
        ipRequests.delete(key);
      } else {
        ipRequests.set(key, validTs);
      }
    }
  }

  return false; // Not rate limited
}

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

  // Apply rate limiting to auth endpoints
  if (pathname.startsWith('/api/auth/login') || 
      pathname.startsWith('/api/auth/request-account')) {
    if (rateLimit(request)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
  }

  // Check if path is public
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth_token')?.value;

  // If authenticated user tries to access login page, redirect to home
  if (token && pathname === '/auth/login') {
    const response = NextResponse.redirect(new URL('/', request.url));
    return response;
  }

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    return response;
  }

  try {
    // Verify token using 'jose'
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);

    // Token is valid, proceed
    return NextResponse.next();
  } catch (error) {
    console.error('JWT Verification Error:', error);
    // If token is invalid, redirect to login
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    return response;
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
     */
    '/((?!_next/static|_next/image|images|favicon.ico).*)',
  ],
};