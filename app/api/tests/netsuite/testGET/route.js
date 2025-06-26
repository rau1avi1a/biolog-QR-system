// app/api/tests/netsuite/GET/route.js
// A simple test route that fetches a known work order directly from NetSuite using user credentials
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import db from '@/db';

export const dynamic = 'force-dynamic';

// Helper to extract and verify user from auth_token cookie
async function getUserFromRequest(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) throw new Error('No authentication token provided');

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(process.env.JWT_SECRET)
  );

  await db.connect();
  const user = await db.models.User.findById(payload.userId);
  if (!user) throw new Error('User not found');
  if (!user.hasNetSuiteAccess()) throw new Error('NetSuite access not configured');
  return user;
}

export async function GET(request) {
  let auth;
  const endpoint = '/workOrder/402166';
  try {
    // 1) Authenticate user and get credentials
    const user = await getUserFromRequest(request);

    // 2) Initialize NetSuite auth with user credentials
    auth = await db.netsuite.createNetSuiteAuth(user);

    // 3) Fetch the known work order
    const workOrder = await auth.makeRequest(endpoint);

    // 4) Return the record payload
    return NextResponse.json({ success: true, workOrder });

  } catch (error) {
    console.error('❌ Test GET NetSuite workOrder error:', error);

    if (auth) {
      // Log the credentials used (redact partial if needed)
      console.error('🔑 Credentials used:', {
        accountId: auth.realmAccountId,
        consumerKey: auth.credentials.consumerKey,
        consumerSecret: auth.credentials.consumerSecret,
        tokenId: auth.credentials.tokenId,
        tokenSecret: auth.credentials.tokenSecret
      });

      // Attempt to reconstruct and log the Authorization header
      try {
        const url = `${auth.baseUrl}${endpoint}`;
        const requestData = { url, method: 'GET' };
        const oauthData = auth.oauth.authorize(requestData, auth.token);
        let header = auth.oauth.toHeader(oauthData).Authorization;
        if (!header.includes('realm=')) {
          header = header.replace(
            'OAuth ',
            `OAuth realm="${auth.realmAccountId}", `
          );
        }
        console.error('📋 Authorization header attempted:', header);
      } catch (hdrErr) {
        console.error('⚠️ Failed to generate debug header:', hdrErr);
      }
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
