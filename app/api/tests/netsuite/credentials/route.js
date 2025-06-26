// app/api/tests/credentials/route.js - Test NetSuite Credentials
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import db from '@/db';

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

    await db.connect();
    const user = await db.models.User.findById(payload.userId);
    
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
    console.log('🔍 Starting credential verification...');
    
    const results = {
      timestamp: new Date().toISOString(),
      environment: {},
      user: {},
      comparison: {},
      oauth: {},
      recommendations: []
    };

    // Check environment variables
    console.log('📋 Checking environment variables...');
    results.environment = {
      accountId: {
        exists: !!process.env.NETSUITE_ACCOUNT_ID,
        value: process.env.NETSUITE_ACCOUNT_ID ? `${process.env.NETSUITE_ACCOUNT_ID.substring(0, 8)}...` : null,
        length: process.env.NETSUITE_ACCOUNT_ID?.length || 0
      },
      consumerKey: {
        exists: !!process.env.NETSUITE_CONSUMER_KEY,
        length: process.env.NETSUITE_CONSUMER_KEY?.length || 0
      },
      consumerSecret: {
        exists: !!process.env.NETSUITE_CONSUMER_SECRET,
        length: process.env.NETSUITE_CONSUMER_SECRET?.length || 0
      },
      tokenId: {
        exists: !!process.env.NETSUITE_TOKEN_ID,
        length: process.env.NETSUITE_TOKEN_ID?.length || 0
      },
      tokenSecret: {
        exists: !!process.env.NETSUITE_TOKEN_SECRET,
        length: process.env.NETSUITE_TOKEN_SECRET?.length || 0
      }
    };

    // Check user credentials
    try {
      console.log('👤 Checking user credentials...');
      const user = await getUserFromRequest(request);
      
      if (user.netsuiteCredentials?.isConfigured) {
        results.user = {
          configured: true,
          accountId: {
            exists: !!user.netsuiteCredentials.accountId,
            value: user.netsuiteCredentials.accountId ? `${user.netsuiteCredentials.accountId.substring(0, 8)}...` : null,
            length: user.netsuiteCredentials.accountId?.length || 0
          },
          consumerKey: {
            exists: !!user.netsuiteCredentials.consumerKey,
            length: user.netsuiteCredentials.consumerKey?.length || 0
          },
          consumerSecret: {
            exists: !!user.netsuiteCredentials.consumerSecret,
            length: user.netsuiteCredentials.consumerSecret?.length || 0
          },
          tokenId: {
            exists: !!user.netsuiteCredentials.tokenId,
            length: user.netsuiteCredentials.tokenId?.length || 0
          },
          tokenSecret: {
            exists: !!user.netsuiteCredentials.tokenSecret,
            length: user.netsuiteCredentials.tokenSecret?.length || 0
          }
        };
      } else {
        results.user = { configured: false };
      }
    } catch (error) {
      console.log('⚠️ User credential check failed:', error.message);
      results.user = { error: error.message };
    }

    // Compare with what would be used
    console.log('🔗 Creating auth service to test...');
    try {
      const user = await getUserFromRequest(request).catch(() => null);
      const auth = await db.netsuite.createNetSuiteAuth(user);
      
      results.oauth = {
        success: true,
        realmAccountId: auth.realmAccountId,
        baseUrl: auth.baseUrl,
        credentialsUsed: {
          accountId: auth.credentials.accountId ? `${auth.credentials.accountId.substring(0, 8)}...` : null,
          consumerKeyLength: auth.credentials.consumerKey?.length || 0,
          consumerSecretLength: auth.credentials.consumerSecret?.length || 0,
          tokenIdLength: auth.credentials.tokenId?.length || 0,
          tokenSecretLength: auth.credentials.tokenSecret?.length || 0
        }
      };

      // Test OAuth signature generation
      console.log('🔐 Testing OAuth signature generation...');
      const testUrl = `${auth.baseUrl}/currency?limit=1`;
      const oauthData = auth.debugOAuthSignature(testUrl, 'GET');
      
      results.oauth.signatureTest = {
        url: testUrl,
        method: 'GET',
        timestamp: oauthData.oauth_timestamp,
        nonce: oauthData.oauth_nonce,
        hasSignature: !!oauthData.oauth_signature,
        signatureLength: oauthData.oauth_signature?.length || 0
      };
      
    } catch (error) {
      console.log('❌ OAuth test failed:', error.message);
      results.oauth = {
        success: false,
        error: error.message
      };
    }

    // Generate recommendations
    console.log('💡 Generating recommendations...');
    
    if (!results.environment.accountId.exists && !results.user.configured) {
      results.recommendations.push('❌ No NetSuite credentials found in environment OR user settings');
    }
    
    if (results.environment.accountId.exists && results.user.configured) {
      results.recommendations.push('⚠️ Both environment AND user credentials are configured - user credentials will take precedence');
    }
    
    if (results.oauth.success) {
      results.recommendations.push('✅ OAuth service created successfully - credentials appear valid');
    } else {
      results.recommendations.push('❌ OAuth service creation failed - check credential format and values');
    }

    // Specific credential format checks
    if (results.oauth.credentialsUsed?.accountId) {
      const accountId = results.oauth.realmAccountId;
      if (!accountId.includes('_')) {
        results.recommendations.push('⚠️ Account ID might be missing sandbox suffix (should be like "1234567_SB1" for sandbox)');
      }
      if (!accountId.match(/^\d+_[A-Z0-9]+$/)) {
        results.recommendations.push('⚠️ Account ID format looks incorrect (should be numbers_letters like "4511488_SB1")');
      }
    }

    console.log('✅ Credential verification complete');

    return NextResponse.json({
      success: true,
      results,
      summary: {
        environmentConfigured: Object.values(results.environment).every(cred => cred.exists),
        userConfigured: results.user.configured === true,
        oauthWorking: results.oauth.success === true,
        recommendationCount: results.recommendations.length
      }
    });

  } catch (error) {
    console.error('💥 Credential test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}