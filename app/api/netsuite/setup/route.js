// app/api/netsuite/setup/route.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/lib/index';
import User from '@/models/User';

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

// Set up NetSuite credentials for current user
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json();
    
    const { 
      accountId, 
      consumerKey, 
      consumerSecret, 
      tokenId, 
      tokenSecret,
      useEnvVars = false 
    } = body;

    if (useEnvVars) {
      // Use environment variables
      user.setNetSuiteCredentials({
        accountId: process.env.NETSUITE_ACCOUNT_ID,
        consumerKey: process.env.NETSUITE_CONSUMER_KEY,
        consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
        tokenId: process.env.NETSUITE_TOKEN_ID,
        tokenSecret: process.env.NETSUITE_TOKEN_SECRET
      });
    } else {
      // Validate required fields
      if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
        return NextResponse.json({
          success: false,
          message: 'All NetSuite credentials are required'
        }, { status: 400 });
      }

      user.setNetSuiteCredentials({
        accountId,
        consumerKey,
        consumerSecret,
        tokenId,
        tokenSecret
      });
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: 'NetSuite credentials configured successfully',
      configured: user.hasNetSuiteAccess()
    });

  } catch (error) {
    console.error('NetSuite setup error:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}

// Get current NetSuite configuration status
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    
    return NextResponse.json({
      success: true,
      configured: user.hasNetSuiteAccess(),
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('NetSuite setup status error:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}