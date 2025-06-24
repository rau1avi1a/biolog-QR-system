// app/api/netsuite/test/route.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/db/index';
import User from '@/db/schemas/User';
import { createNetSuiteAuth } from '@/db/services/netsuite/index.js';

export const dynamic = 'force-dynamic';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    await connectMongoDB();
    const user = await User.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return user;

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export async function GET(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    if (!user.hasNetSuiteAccess()) {
      return NextResponse.json({
        success: false,
        message: 'NetSuite credentials not configured'
      }, { status: 400 });
    }

    // Test NetSuite connection
    const authService = createNetSuiteAuth(user);
    const testResult = await authService.testConnection();
    
    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      configured: true
    });

  } catch (error) {
    console.error('NetSuite test error:', error);
    return NextResponse.json({ 
      success: false,
      message: error.message,
      configured: false
    }, { status: 500 });
  }
}