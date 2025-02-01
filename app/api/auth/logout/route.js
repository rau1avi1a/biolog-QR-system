// app/api/auth/logout/route.js
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json({ message: 'Logged out successfully' });
    
    // Delete cookie by setting expires to past date
    response.cookies.set({
      name: 'auth_token',
      value: '',
      expires: new Date(0)
    });
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}