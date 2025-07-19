// services/netsuite/auth.service.js - OAuth2 Authentication with Transparent Auth Handling
import db from '../../index.js';

/**
 * Custom error class for authentication failures
 */
export class NetSuiteAuthenticationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'NetSuiteAuthenticationError';
    this.needsOAuth2 = details.needsOAuth2 || false;
    this.redirectUrl = details.redirectUrl;
    this.context = details.context || {};
    this.originalError = details.originalError;
  }
}

/**
 * NetSuite OAuth 2.0 Authentication Service
 * Complete replacement for OAuth1 TBA authentication with transparent auth handling
 */
export class NetSuiteAuth {
  constructor(credentials) {
    this.credentials = credentials;
    
    console.log('🔐 Initializing NetSuite OAuth2 Auth with credentials:', {
      accountId: credentials.accountId,
      clientIdLength: credentials.clientId?.length,
      hasAccessToken: !!credentials.accessToken,
      hasRefreshToken: !!credentials.refreshToken,
      tokenExpiry: credentials.tokenExpiry
    });
    
    // ✅ FIX: Convert account ID to the right format for URLs
    // NetSuite URLs use hyphens: 4511488-sb1
    // But tokens might use underscores: 4511488_SB1
    const urlAccountId = credentials.accountId.toLowerCase().replace('_', '-');
    this.accountId = credentials.accountId; // Keep original for API calls
    this.baseUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
    
    console.log('🌐 NetSuite URLs configured:', {
      accountId: this.accountId,
      urlAccountId,
      baseUrl: this.baseUrl
    });
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
   * Check if access token is expired or will expire soon
   */
  isTokenExpired() {
    if (!this.credentials.tokenExpiry) return true;
    
    const now = new Date();
    const expiry = new Date(this.credentials.tokenExpiry);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    return expiry <= fiveMinutesFromNow;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken() {
    if (!this.credentials.refreshToken) {
      throw new NetSuiteAuthenticationError(
        'No refresh token available. User needs to re-authenticate.',
        {
          needsOAuth2: true,
          redirectUrl: '/api/netsuite?action=oauth2-login'
        }
      );
    }

    console.log('🔄 Refreshing NetSuite access token...');

    const urlAccountId = this.accountId.toLowerCase().replace('_', '-');
    const tokenUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refreshToken,
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Custom-NetSuite-OAuth2-Client/1.0'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token refresh failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        throw new NetSuiteAuthenticationError(
          'Token refresh failed. User needs to re-authenticate.',
          {
            needsOAuth2: true,
            redirectUrl: '/api/netsuite?action=oauth2-login',
            originalError: `${response.status} - ${errorText}`
          }
        );
      }

      const tokenData = await response.json();
      
      console.log('✅ Token refreshed successfully:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      });

      // Update credentials with new tokens
      this.credentials.accessToken = tokenData.access_token;
      this.credentials.refreshToken = tokenData.refresh_token || this.credentials.refreshToken;
      this.credentials.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Save updated tokens to database if we have a user
      if (this.credentials.userId) {
        await this.saveTokensToDatabase(this.credentials.userId, {
          accessToken: this.credentials.accessToken,
          refreshToken: this.credentials.refreshToken,
          tokenExpiry: this.credentials.tokenExpiry
        });
      }

      return tokenData;
    } catch (error) {
      console.error('💥 Token refresh error:', error);
      
      if (error instanceof NetSuiteAuthenticationError) {
        throw error;
      }
      
      throw new NetSuiteAuthenticationError(
        'Token refresh failed due to network or server error.',
        {
          needsOAuth2: true,
          redirectUrl: '/api/netsuite?action=oauth2-login',
          originalError: error.message
        }
      );
    }
  }

  /**
   * Save OAuth2 tokens to database
   */
  async saveTokensToDatabase(userId, tokens) {
    try {
      await this.connect();
      
      const updateData = {
        'netsuiteCredentials.accessToken': tokens.accessToken,
        'netsuiteCredentials.refreshToken': tokens.refreshToken,
        'netsuiteCredentials.tokenExpiry': tokens.tokenExpiry,
        'netsuiteCredentials.lastTokenRefresh': new Date()
      };

      await this.models.User.findByIdAndUpdate(userId, updateData);
      console.log('💾 Saved updated tokens to database for user:', userId);
    } catch (error) {
      console.error('💥 Failed to save tokens to database:', error);
      // Don't throw - token refresh succeeded, DB save is secondary
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken() {
    if (this.isTokenExpired()) {
      console.log('🔄 Access token expired, refreshing...');
      await this.refreshAccessToken();
    }
    
    return this.credentials.accessToken;
  }

  /**
   * Handle authentication failures at the service level
   */
  async handleAuthenticationFailure(error, context = {}) {
    console.log('🔐 Handling authentication failure:', error.message);
    
    // Check if this is an authentication error that can be resolved
    const isAuthError = (
      error.message.includes('No OAuth2 access token found') ||
      error.message.includes('Token refresh failed') ||
      error.message.includes('Authentication failed') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized') ||
      error instanceof NetSuiteAuthenticationError
    );

    if (!isAuthError) {
      // Not an auth error, just throw it
      throw error;
    }

    // This is an authentication error - throw NetSuiteAuthenticationError
    throw new NetSuiteAuthenticationError(
      'NetSuite authentication required',
      {
        originalError: error.message,
        needsOAuth2: true,
        redirectUrl: '/api/netsuite?action=oauth2-login',
        context
      }
    );
  }

  /**
   * Make authenticated requests to NetSuite REST API using OAuth2
   * Enhanced with automatic auth failure handling
   */
  async makeRequest(endpoint, method = 'GET', body = null, customHeaders = {}) {
    try {
      // Try the normal request flow
      return await this._makeRequestInternal(endpoint, method, body, customHeaders);
      
    } catch (error) {
      // Handle authentication failures
      await this.handleAuthenticationFailure(error, {
        endpoint,
        method,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Internal request method with OAuth2 logic
   */
  async _makeRequestInternal(endpoint, method = 'GET', body = null, customHeaders = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('🚀 Making NetSuite OAuth2 API request:', {
      method,
      endpoint,
      url,
      hasBody: !!body
    });

    // Get valid access token (will refresh if needed)
    const accessToken = await this.getValidAccessToken();

    // Prepare request headers
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Custom-NetSuite-OAuth2-Client/1.0',
      ...customHeaders
    };

    // Prepare request options
    const options = { 
      method: method.toUpperCase(), 
      headers 
    };
    
    if (body && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
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

    // Make the request
    try {
      const response = await fetch(url, options);
      
      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ NetSuite API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          url,
          method,
          error: errorText
        });
        
        // Handle token expiration
        if (response.status === 401) {
          console.log('🔑 401 Unauthorized - attempting token refresh...');
          try {
            await this.refreshAccessToken();
            // Retry the request with new token
            headers.Authorization = `Bearer ${this.credentials.accessToken}`;
            const retryResponse = await fetch(url, { ...options, headers });
            
            if (retryResponse.ok) {
              console.log('✅ Retry after token refresh succeeded');
              return await this.handleResponse(retryResponse);
            } else {
              const retryErrorText = await retryResponse.text();
              throw new NetSuiteAuthenticationError(
                'Authentication failed after token refresh',
                {
                  needsOAuth2: true,
                  redirectUrl: '/api/netsuite?action=oauth2-login',
                  originalError: `${retryResponse.status} - ${retryErrorText}`
                }
              );
            }
          } catch (refreshError) {
            console.error('💥 Token refresh failed during retry:', refreshError);
            
            if (refreshError instanceof NetSuiteAuthenticationError) {
              throw refreshError;
            }
            
            throw new NetSuiteAuthenticationError(
              'Token refresh failed during request retry',
              {
                needsOAuth2: true,
                redirectUrl: '/api/netsuite?action=oauth2-login',
                originalError: refreshError.message
              }
            );
          }
        }
        
        throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
      }

      return await this.handleResponse(response);
      
    } catch (fetchError) {
      console.error('💥 Fetch error:', {
        message: fetchError.message,
        name: fetchError.name,
        url,
        method
      });
      
      if (fetchError instanceof NetSuiteAuthenticationError) {
        throw fetchError;
      }
      
      throw fetchError;
    }
  }

  /**
   * Handle API response (extract data or handle empty responses)
   */
  async handleResponse(response) {
    let responseData;
    
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      // 204 No Content or empty response - extract ID from location header
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
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
  }

  /**
   * Test the connection to NetSuite with detailed logging
   */
  async testConnection() {
    console.log('🧪 Testing NetSuite OAuth2 connection...');
    
    try {
      // Try multiple endpoints to find one that works
      const testEndpoints = [
        '/item?limit=1',
        '/inventoryItem?limit=1',
        '/employee?limit=1',
        '/subsidiary?limit=1'
      ];
      
      let lastError = null;
      
      for (const endpoint of testEndpoints) {
        try {
          console.log(`🔍 Testing endpoint: ${endpoint}`);
          const result = await this.makeRequest(endpoint);
          console.log('✅ NetSuite OAuth2 connection test successful!');
          return { 
            success: true, 
            message: 'OAuth2 connection successful',
            testEndpoint: endpoint,
            resultType: typeof result
          };
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} failed:`, error.message);
          lastError = error;
          
          // If it's an authentication error, throw it immediately
          if (error instanceof NetSuiteAuthenticationError) {
            throw error;
          }
          
          // If it's a permissions error, that's actually a successful connection
          if (error.message.includes('permission') || 
              error.message.includes('access') || 
              error.message.includes('INSUFFICIENT_PERMISSION')) {
            console.log('✅ NetSuite OAuth2 connection successful (permissions limited)');
            return { 
              success: true, 
              message: 'OAuth2 connection successful (limited permissions)',
              testEndpoint: endpoint,
              resultType: 'permission_limited'
            };
          }
          
          continue;
        }
      }
      
      console.error('❌ All NetSuite OAuth2 connection tests failed');
      return { 
        success: false, 
        message: lastError?.message || 'All connection tests failed',
        testEndpoint: 'multiple_tested'
      };
      
    } catch (error) {
      console.error('❌ NetSuite OAuth2 connection test failed:', error.message);
      
      if (error instanceof NetSuiteAuthenticationError) {
        throw error;
      }
      
      return { 
        success: false, 
        message: error.message,
        testEndpoint: 'connection_error'
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
      accountId: this.accountId,
      authType: 'OAuth2'
    };
    
    console.log('📊 NetSuite API Activity:', logEntry);
  }
}

/**
 * OAuth2 Helper Functions
 */
export class NetSuiteOAuth2 {
  static get CLIENT_ID() {
    const clientId = process.env.NETSUITE_CLIENT_ID;
    if (!clientId) {
      throw new Error('NETSUITE_CLIENT_ID environment variable is required');
    }
    return clientId;
  }

  static get CLIENT_SECRET() {
    const clientSecret = process.env.NETSUITE_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('NETSUITE_CLIENT_SECRET environment variable is required');
    }
    return clientSecret;
  }

  static get ACCOUNT_ID() {
    const accountId = process.env.NETSUITE_ACCOUNT_ID;
    if (!accountId) {
      throw new Error('NETSUITE_ACCOUNT_ID environment variable is required');
    }
    return accountId;
  }

  static validateConfig() {
    // This will throw errors if any are missing
    this.CLIENT_ID;
    this.CLIENT_SECRET;
    this.ACCOUNT_ID;
    console.log('✅ OAuth2 configuration validated');
  }

  /**
   * Generate authorization URL for user to login
   */
static getAuthorizationUrl(redirectUri, state = null) {
  this.validateConfig();
  
  // ✅ FIX: Use the correct URL format
  const urlAccountId = this.ACCOUNT_ID.toLowerCase().replace('_', '-');
  const authUrl = `https://${urlAccountId}.app.netsuite.com/app/login/oauth2/authorize.nl`;
  
  // ✅ FIX: Generate a proper state parameter with at least 22 characters
  const generatedState = state || Array.from({length: 8}, () => 
    Math.random().toString(36).substring(2, 5)  // Gets 3 chars each time
  ).join('');  // 8 * 3 = 24 characters

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: this.CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'rest_webservices',
    state: generatedState
  });

  const fullUrl = `${authUrl}?${params.toString()}`;
  
  console.log('🔗 Generated OAuth2 authorization URL:', {
    authUrl,
    redirectUri,
    state: params.get('state'),
    stateLength: params.get('state').length, // Add this to verify length
    accountId: this.ACCOUNT_ID,
    urlAccountId
  });

  return fullUrl;
}

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code, redirectUri) {
    this.validateConfig();
    
    // ✅ FIX: Use the underscore format for token URL too
    const urlAccountId = this.ACCOUNT_ID.toLowerCase().replace('_', '-');
    const tokenUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.CLIENT_ID,
      client_secret: this.CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code
    });

    console.log('🔄 Exchanging authorization code for token...', {
      tokenUrl,
      clientId: this.CLIENT_ID.substring(0, 8) + '...',
      redirectUri
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Custom-NetSuite-OAuth2-Client/1.0'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token exchange failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      console.log('✅ Token exchange successful:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      });

      // Calculate expiry time
      const tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: tokenExpiry,
        scope: tokenData.scope
      };

    } catch (error) {
      console.error('💥 Token exchange error:', error);
      throw error;
    }
  }
}

/**
 * Enhanced factory to create NetSuiteAuth using OAuth2 credentials with transparent auth handling
 */
export const createNetSuiteAuth = async (user) => {
  let credentials;
  
  console.log('🏭 Creating NetSuite OAuth2 Auth for:', user ? 'authenticated user' : 'environment variables');
  
  // Try to get OAuth2 credentials from user
  if (user?._id) {
    console.log('🔍 Fetching user from database to get OAuth2 credentials');
    await db.connect();
    const fullUser = await db.models.User.findById(user._id);
    
    if (fullUser?.netsuiteCredentials?.accessToken) {
      console.log('✅ Found OAuth2 credentials for user');
      credentials = {
        accountId: NetSuiteOAuth2.ACCOUNT_ID,
        clientId: NetSuiteOAuth2.CLIENT_ID,
        clientSecret: NetSuiteOAuth2.CLIENT_SECRET,
        accessToken: fullUser.netsuiteCredentials.accessToken,
        refreshToken: fullUser.netsuiteCredentials.refreshToken,
        tokenExpiry: fullUser.netsuiteCredentials.tokenExpiry,
        userId: fullUser._id
      };
    }
  }
  
  // Validate credentials and throw NetSuiteAuthenticationError if not found
  if (!credentials || !credentials.accessToken) {
    throw new NetSuiteAuthenticationError(
      'NetSuite authentication required',
      {
        needsOAuth2: true,
        redirectUrl: '/api/netsuite?action=oauth2-login'
      }
    );
  }
  
  console.log('✅ OAuth2 credentials validated:', {
    accountId: credentials.accountId,
    hasAccessToken: !!credentials.accessToken,
    hasRefreshToken: !!credentials.refreshToken,
    tokenExpiry: credentials.tokenExpiry
  });
  
  return new NetSuiteAuth(credentials);
};

/**
 * Factory to create NetSuiteAuth by user ID
 */
export const createNetSuiteAuthById = async (userId) => {
  if (!userId) {
    throw new NetSuiteAuthenticationError(
      'User ID required for OAuth2 authentication',
      {
        needsOAuth2: true,
        redirectUrl: '/api/netsuite?action=oauth2-login'
      }
    );
  }
  
  await db.connect();
  const user = await db.models.User.findById(userId);
  return createNetSuiteAuth(user);
};