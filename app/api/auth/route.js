// =============================================================================
// app/api/auth/route.js
// =============================================================================
import { NextResponse } from 'next/server';
import db from '@/db';
import { SignJWT, jwtVerify } from 'jose';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'login'; // login, logout, register

  if (action === 'login') {
    const { email, password } = await request.json();

    await db.connect();
    const user = await db.models.User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = await new SignJWT({ userId: user._id, role: user.role, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const response = NextResponse.json({
      success: true,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  }

  if (action === 'logout') {
    const response = NextResponse.json({ message: 'Logged out successfully' });
    response.cookies.set({ name: 'auth_token', value: '', expires: new Date(0) });
    return response;
  }

  if (action === 'register') {
    const { name, email, password, role, netsuiteCredentials } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    await db.connect();
    const existingUser = await db.models.User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 400 });
    }

    // Hash password before storing
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const userData = { 
      name, 
      email, 
      password: hashedPassword, 
      role: role || 'operator' 
    };
    
    const newUser = await db.models.User.create(userData);

    // Handle NetSuite credentials if provided
    if (netsuiteCredentials) {
      if (netsuiteCredentials.useEnvVars) {
        newUser.setNetSuiteCredentials({
          accountId: process.env.NETSUITE_ACCOUNT_ID,
          consumerKey: process.env.NETSUITE_CONSUMER_KEY,
          consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
          tokenId: process.env.NETSUITE_TOKEN_ID,
          tokenSecret: process.env.NETSUITE_TOKEN_SECRET
        });
      } else {
        const { accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = netsuiteCredentials;
        if (accountId && consumerKey && consumerSecret && tokenId && tokenSecret) {
          newUser.setNetSuiteCredentials({ 
            accountId, 
            consumerKey, 
            consumerSecret, 
            tokenId, 
            tokenSecret 
          });
        }
      }
      await newUser.save();
    }

    // Return user without password
    const userResponse = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      hasNetSuiteAccess: newUser.hasNetSuiteAccess()
    };

    return NextResponse.json(userResponse, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'me'; // me, users

  if (action === 'me') {
    try {
      const token = request.cookies.get('auth_token')?.value;
      if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      
      await db.connect();
      const user = await db.models.User.findById(payload.userId).select('-password');
      
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

      return NextResponse.json({
        success: true,
        user: { 
          _id: user._id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          hasNetSuiteAccess: user.hasNetSuiteAccess()
        }
      });
    } catch (error) {
      console.error('Auth verification error:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  }

  if (action === 'users') {
    try {
      // Verify user has permission to list users (admin only)
      const token = request.cookies.get('auth_token')?.value;
      if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      
      await db.connect();
      const requestingUser = await db.models.User.findById(payload.userId);
      
      if (!requestingUser || requestingUser.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const users = await db.models.User.find()
        .select('-password -netsuiteCredentials.consumerSecret -netsuiteCredentials.tokenSecret')
        .lean();

      return NextResponse.json({ success: true, users });
    } catch (error) {
      console.error('List users error:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}