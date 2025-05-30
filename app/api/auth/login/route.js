// app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import connectMongoDB from '@lib/index.js';
import User from '@/models/User';
import { SignJWT } from 'jose';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    await connectMongoDB();

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create JWT using 'jose' - Extended to 1 week
    const token = await new SignJWT({ 
      userId: user._id,
      role: user.role,
      email: user.email 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // Token expires in 7 days (1 week)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

    // Set cookie in the response directly - Extended to 1 week
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true, // Prevents client-side JS access
      secure: process.env.NODE_ENV === 'production', // Ensures HTTPS in production
      sameSite: 'lax', // Mitigates CSRF attacks
      path: '/', // Accessible on all routes
      maxAge: 60 * 60 * 24 * 7 // 7 days in seconds (1 week)
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}