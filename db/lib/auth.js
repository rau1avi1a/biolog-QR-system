// db/lib/auth.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import db from '@/db/index.js';

/**
 * Higher-order function to enforce authentication in API routes.
 * @param {Function} handler - API route handler to wrap.
 * @returns {Function} Wrapped handler with authentication.
 */
export function withAuth(handler) {
  return async (request, context) => {
    try {
      const cookiesList = await cookies();
      const token = cookiesList.get('auth_token')?.value;

      if (!token) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }

      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      await db.connect();
      const user = await db.models.User.findById(payload.userId).select('-password');
      if (!user) {
        return NextResponse.json({ message: 'User not found' }, { status: 401 });
      }

      const newContext = {
        ...context,
        user,
        params: context?.params || {}
      };

      return handler(request, newContext);

    } catch (error) {
      console.error('API auth error:', error);
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
  };
}

/**
 * Higher-order function to enforce role-based access in API routes.
 * @param {Function} handler - API route handler to wrap.
 * @param {Array<string>} allowedRoles - Roles allowed to access the route.
 * @returns {Function} Wrapped handler with role-based access control.
 */
export function withRole(handler, allowedRoles) {
  return withAuth(async (request, context) => {
    try {
      const user = context.user;

      if (!user || !allowedRoles.includes(user.role)) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }

      return handler(request, context);
    } catch (error) {
      console.error('Role check error:', error);
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
  });
}

/**
 * Basic authentication check for Next.js server components.
 * @param {string} [loginPath="/"] - Redirect path if unauthorized.
 * @returns {Promise<Object>} Authenticated user object or redirects.
 */
export async function basicAuth(loginPath = "/") {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value ?? null;

  if (!token) {
    redirect(loginPath);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    await db.connect();
    const user = await db.models.User.findById(payload.userId).select('-password');
    if (!user) {
      redirect(loginPath);
    }

    return {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('Auth error:', error);
    redirect(loginPath);
  }
}
