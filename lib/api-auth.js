// lib/api-auth.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import User from '@/models/User';
import connectMongoDB from '@lib/index.js';

/**
 * Higher-order function to enforce authentication.
 * @param {Function} handler - The API route handler to wrap.
 * @returns {Function} - The wrapped handler with authentication.
 */
export function withAuth(handler) {
  return async (request, context) => {
    try {
      // Retrieve cookies from the request
      const cookiesList = await cookies();
      const token = cookiesList.get('auth_token')?.value;

      if (!token) {
        return NextResponse.json(
          { message: 'Unauthorized' },
          { status: 401 }
        );
      }

      try {
        // Verify the JWT using 'jose'
        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        // Connect to MongoDB
        await connectMongoDB();

        // Fetch the user data
        const user = await User.findById(payload.userId).select('-password');

        if (!user) {
          return NextResponse.json(
            { message: 'User not found' },
            { status: 401 }
          );
        }

        // Create a new context object to avoid modifying the original
        const newContext = {
          ...context,
          user,
          params: await Promise.resolve(context.params) // Handle async params
        };

        // Proceed to the original handler with updated context
        return handler(request, newContext);
      } catch (error) {
        console.error('Token verification error:', error);
        return NextResponse.json(
          { message: 'Invalid token' },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error('API auth error:', error);
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Higher-order function to enforce role-based access.
 * @param {Function} handler - The API route handler to wrap.
 * @param {Array<string>} allowedRoles - Array of roles allowed to access the route.
 * @returns {Function} - The wrapped handler with role-based access control.
 */
export function withRole(handler, allowedRoles) {
  return withAuth(async (request, context) => {
    try {
      const user = context.user;

      if (!user || !allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { message: 'Forbidden' },
          { status: 403 }
        );
      }

      // User has the required role; proceed to the handler
      return handler(request, context);
    } catch (error) {
      console.error('Role check error:', error);
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}