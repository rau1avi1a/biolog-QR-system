// app/api/netsuite/health/route.js - Check NetSuite service health
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/lib/index';
import User from '@/models/User';
import { createNetSuiteAuth } from '@/services/netsuite/index.js';

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
    // Get user and check configuration
    const user = await getUserFromRequest(request);
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      user: {
        id: user._id,
        email: user.email,
        hasNetSuiteAccess: user.hasNetSuiteAccess()
      },
      netsuite: {
        configured: false,
        connectionTest: null,
        error: null
      }
    };
    
    if (!user.hasNetSuiteAccess()) {
      healthCheck.netsuite.error = 'NetSuite credentials not configured';
      return NextResponse.json(healthCheck);
    }
    
    healthCheck.netsuite.configured = true;
    
    // Test connection
    try {
      const authService = createNetSuiteAuth(user);
      const testResult = await authService.testConnection();
      
      healthCheck.netsuite.connectionTest = {
        success: testResult.success,
        message: testResult.message,
        testedAt: new Date().toISOString()
      };
      
    } catch (error) {
      healthCheck.netsuite.connectionTest = {
        success: false,
        message: error.message,
        testedAt: new Date().toISOString()
      };
    }
    
    return NextResponse.json(healthCheck);

  } catch (error) {
    console.error('NetSuite health check error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: error.message,
      netsuite: {
        configured: false,
        connectionTest: null,
        error: error.message
      }
    }, { status: 500 });
  }
}
