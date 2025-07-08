// services/netsuite/auth.service.js - FIXED AUTHENTICATION
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import db from '../../index.js';

/**
 * NetSuite OAuth 1.0 (TBA) Authentication Service - FIXED
 * The issue was in OAuth signature generation and realm handling
 */
export class NetSuiteAuth {
  constructor(credentials) {
    this.credentials = credentials;
    
    console.log('🔐 Initializing NetSuite Auth with credentials:', {
      accountId: credentials.accountId,
      consumerKeyLength: credentials.consumerKey?.length,
      consumerSecretLength: credentials.consumerSecret?.length,
      tokenIdLength: credentials.tokenId?.length,
      tokenSecretLength: credentials.tokenSecret?.length
    });
    
    // CRITICAL: Store original account ID for OAuth realm
    this.realmAccountId = credentials.accountId; // "4511488_SB1"
    
    // Convert account ID format for URL: 4511488_SB1 -> 4511488-sb1
    const urlAccountId = credentials.accountId.toLowerCase().replace('_', '-');
    this.baseUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
    
    console.log('🌐 NetSuite URLs configured:', {
      realmAccountId: this.realmAccountId,
      urlAccountId: urlAccountId,
      baseUrl: this.baseUrl
    });

    // FIXED: Set up OAuth 1.0 with correct configuration
    this.oauth = OAuth({
      consumer: {
        key: credentials.consumerKey,
        secret: credentials.consumerSecret,
      },
      signature_method: 'HMAC-SHA256',
      hash_function(base_string, key) {
        return crypto.createHmac('sha256', key).update(base_string).digest('base64');
      },
      // IMPORTANT: These parameters are critical for NetSuite
      parameter_seperator: ', ',
      realm: this.realmAccountId
    });

    this.token = {
      key: credentials.tokenId,
      secret: credentials.tokenSecret,
    };
    
    console.log('✅ OAuth configured successfully');
  }

  /**
   * Access to database models through db
   */
  get models() {
    return db.models;
  }

  /**
   * Access to other services through db
   */
  get services() {
    return db.services;
  }

  /**
   * Ensure database connection
   */
  async connect() {
    return db.connect();
  }

/**
   * FIXED: Make authenticated requests to NetSuite REST API
   */
async makeRequest(endpoint, method = 'GET', body = null, customHeaders = {}) {
  const url = `${this.baseUrl}${endpoint}`;
  
  console.log('🚀 Making NetSuite API request:', {
    method,
    endpoint,
    url,
    hasBody: !!body
  });

  // Step 1: Create the request data for OAuth
  const requestData = { 
    url, 
    method: method.toUpperCase() 
  };

  // Step 2: Generate OAuth authorization data
  const oauthData = this.oauth.authorize(requestData, this.token);
  
  console.log('🔑 OAuth data generated:', {
    oauth_consumer_key: oauthData.oauth_consumer_key,
    oauth_token: oauthData.oauth_token,
    oauth_signature_method: oauthData.oauth_signature_method,
    oauth_timestamp: oauthData.oauth_timestamp,
    oauth_nonce: oauthData.oauth_nonce,
    oauth_version: oauthData.oauth_version,
    oauth_signature: oauthData.oauth_signature ? 'present' : 'missing'
  });

  // Step 3: Create the Authorization header
  const authHeader = this.oauth.toHeader(oauthData);
  
  // CRITICAL FIX: Add realm parameter correctly
  authHeader.Authorization = authHeader.Authorization.replace(
    'OAuth ',
    `OAuth realm="${this.realmAccountId}", `
  );

  console.log('📋 Authorization header created:', {
    authHeaderLength: authHeader.Authorization?.length,
    hasRealm: authHeader.Authorization?.includes('realm='),
    realmValue: this.realmAccountId
  });

  // Step 4: Prepare request headers (merge custom headers)
  const headers = {
    ...authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'Custom-NetSuite-Client/1.0',
    ...customHeaders  // Add custom headers like Prefer: transient
  };

  // Step 5: Prepare request options
  const options = { 
    method: method.toUpperCase(), 
    headers 
  };
  
  if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PATCH' || method.toUpperCase() === 'PUT')) {
    options.body = JSON.stringify(body);
    console.log('📤 Request body:', JSON.stringify(body, null, 2));
  }

  console.log('📋 Final request details:', {
    url,
    method: options.method,
    headerCount: Object.keys(headers).length,
    hasContentType: !!headers['Content-Type'],
    hasAuthorization: !!headers.Authorization
  });

  // Step 6: Make the request
  try {
    const response = await fetch(url, options);
    
    console.log('📥 Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ NetSuite API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url,
        method,
        error: errorText,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        requestHeaders: headers
      });
      
      // Log OAuth debugging info for 401 errors
      if (response.status === 401) {
        console.error('🔐 OAuth Debug Info for 401 error:', {
          realmAccountId: this.realmAccountId,
          consumerKey: this.credentials.consumerKey,
          tokenId: this.credentials.tokenId,
          baseUrl: this.baseUrl,
          oauthSignature: oauthData.oauth_signature,
          oauthTimestamp: oauthData.oauth_timestamp,
          oauthNonce: oauthData.oauth_nonce
        });
      }
      
      throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
    }

    let responseData;
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      // 204 No Content or empty response - extract ID from location header
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        // Extract ID from location URL like: .../assemblybuild/403779
        const idMatch = locationHeader.match(/\/([^\/]+)$/);
        if (idMatch) {
          responseData = { id: idMatch[1] };
          console.log('✅ Extracted ID from location header:', responseData.id);
        } else {
          responseData = { success: true, location: locationHeader };
        }
      } else {
        responseData = { success: true };
      }
    } else {
      // Normal response with content
      responseData = await response.json();
    }
        console.log('✅ Request successful:', {
      dataType: typeof responseData,
      isArray: Array.isArray(responseData),
      hasItems: responseData.items ? responseData.items.length : 'N/A'
    });

    return responseData;
    
  } catch (fetchError) {
    console.error('💥 Fetch error:', {
      message: fetchError.message,
      name: fetchError.name,
      url,
      method
    });
    throw fetchError;
  }
}


  /**
   * Test the connection to NetSuite with detailed logging
   */
  async testConnection() {
    console.log('🧪 Testing NetSuite connection...');
    
    try {
      // Try a simple endpoint that usually works
      const result = await this.makeRequest('/currency?limit=1');
      console.log('✅ NetSuite connection test successful!');
      return { 
        success: true, 
        message: 'Connection successful',
        testEndpoint: '/currency?limit=1',
        resultType: typeof result
      };
    } catch (error) {
      console.error('❌ NetSuite connection test failed:', error.message);
      return { 
        success: false, 
        message: error.message,
        testEndpoint: '/currency?limit=1'
      };
    }
  }

  /**
   * Get local item by NetSuite ID
   */
  async getLocalItemByNetSuiteId(netsuiteId) {
    await this.connect();
    return this.models.Item.findOne({ netsuiteInternalId: netsuiteId }).lean();
  }

  /**
   * Search local items by name or SKU
   */
  async searchLocalItems(query) {
    await this.connect();
    return this.services.itemService.find({
      filter: { $or: [
        { displayName: { $regex: query, $options: 'i' } },
        { sku: { $regex: query, $options: 'i' } },
        { netsuiteInternalId: query }
      ]},
      limit: 10
    });
  }

  /**
   * Log NetSuite API activity
   */
  async logApiActivity(endpoint, method, success, error = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      success,
      error: error?.message,
      accountId: this.realmAccountId
    };
    
    console.log('📊 NetSuite API Activity:', logEntry);
    
    // Could extend this to save to database
    try {
      await this.connect();
      // await this.models.NetSuiteLog.create(logEntry);
    } catch (dbError) {
      console.warn('Failed to save API log to database:', dbError.message);
    }
  }

  /**
   * Debug OAuth signature generation
   */
  debugOAuthSignature(url, method = 'GET') {
    const requestData = { url, method: method.toUpperCase() };
    const oauthData = this.oauth.authorize(requestData, this.token);
    
    console.log('🔍 OAuth Debug Information:', {
      url,
      method,
      consumer_key: oauthData.oauth_consumer_key,
      token: oauthData.oauth_token,
      signature_method: oauthData.oauth_signature_method,
      timestamp: oauthData.oauth_timestamp,
      nonce: oauthData.oauth_nonce,
      version: oauthData.oauth_version,
      signature: oauthData.oauth_signature,
      realm: this.realmAccountId
    });
    
    return oauthData;
  }
}

/**
 * FIXED: Factory to create NetSuiteAuth using user credentials or env
 */
export const createNetSuiteAuth = async (user) => {
  let credentials;
  
  console.log('🏭 Creating NetSuite Auth for:', user ? 'authenticated user' : 'environment variables');
  
  // Try to get credentials from user first
  if (user && typeof user.getNetSuiteCredentials === 'function') {
    console.log('📋 Using user method to get credentials');
    credentials = user.getNetSuiteCredentials();
  } else if (user?._id) {
    console.log('🔍 Fetching user from database to get credentials');
    await db.connect();
    const fullUser = await db.models.User.findById(user._id);
    if (fullUser && typeof fullUser.getNetSuiteCredentials === 'function') {
      console.log('✅ Found user method for credentials');
      credentials = fullUser.getNetSuiteCredentials();
    } else if (fullUser?.netsuiteCredentials?.isConfigured) {
      console.log('📝 Using direct credential access from user');
      credentials = {
        accountId: fullUser.netsuiteCredentials.accountId,
        consumerKey: fullUser.netsuiteCredentials.consumerKey,
        consumerSecret: fullUser.netsuiteCredentials.consumerSecret,
        tokenId: fullUser.netsuiteCredentials.tokenId,
        tokenSecret: fullUser.netsuiteCredentials.tokenSecret
      };
    }
  }
  
  // Fallback to environment variables
  if (!credentials || !credentials.accountId) {
    console.log('🌍 Using environment variable credentials');
    credentials = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET
    };
  }
  
  // Validate credentials
  const missingCredentials = [];
  if (!credentials.accountId) missingCredentials.push('accountId');
  if (!credentials.consumerKey) missingCredentials.push('consumerKey');
  if (!credentials.consumerSecret) missingCredentials.push('consumerSecret');
  if (!credentials.tokenId) missingCredentials.push('tokenId');
  if (!credentials.tokenSecret) missingCredentials.push('tokenSecret');
  
  if (missingCredentials.length > 0) {
    throw new Error(`Missing NetSuite credentials: ${missingCredentials.join(', ')}`);
  }
  
  console.log('✅ NetSuite credentials validated:', {
    accountId: credentials.accountId,
    consumerKeyLength: credentials.consumerKey?.length,
    consumerSecretLength: credentials.consumerSecret?.length,
    tokenIdLength: credentials.tokenId?.length,
    tokenSecretLength: credentials.tokenSecret?.length
  });
  
  return new NetSuiteAuth(credentials);
};

/**
 * Factory to create NetSuiteAuth by user ID
 */
export const createNetSuiteAuthById = async (userId) => {
  if (!userId) return createNetSuiteAuth(null);
  await db.connect();
  const user = await db.models.User.findById(userId);
  return createNetSuiteAuth(user);
};