// services/netsuite/auth.service.js
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';

/**
 * NetSuite OAuth 1.0 (TBA) Authentication Service
 */
export class NetSuiteAuth {
  constructor(credentials) {
    this.credentials = credentials;
    
    // Convert account ID format: 4511488_SB1 -> 4511488-sb1 for URL
    const urlAccountId = credentials.accountId.toLowerCase().replace('_', '-');
    this.baseUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
    
    console.log('NetSuite URL:', this.baseUrl);
    console.log('Original Account ID:', credentials.accountId);
    console.log('URL Account ID:', urlAccountId);
    
    // Set up OAuth 1.0
    this.oauth = OAuth({
      consumer: {
        key: credentials.consumerKey,
        secret: credentials.consumerSecret,
      },
      signature_method: 'HMAC-SHA256',
      hash_function(base_string, key) {
        return crypto
          .createHmac('sha256', key)
          .update(base_string)
          .digest('base64');
      },
    });

    this.token = {
      key: credentials.tokenId,
      secret: credentials.tokenSecret,
    };
  }

  /**
   * Make authenticated requests to NetSuite REST API
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('Making request to:', url);
    console.log('Method:', method);
    console.log('Consumer Key:', this.oauth.consumer.key);
    console.log('Token Key:', this.token.key);
    
    const requestData = { url, method };
    const oauthData = this.oauth.authorize(requestData, this.token);
    
    // Add realm parameter for NetSuite
    const authHeader = this.oauth.toHeader(oauthData);
    authHeader.Authorization = authHeader.Authorization.replace(
      'OAuth ',
      `OAuth realm="${this.credentials.accountId}", `
    );
    
    const headers = {
      ...authHeader,
      'Content-Type': 'application/json',
    };

    console.log('OAuth Authorization Header:', headers.Authorization);
    
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      console.log('Sending request with headers:', JSON.stringify(headers, null, 2));
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response status:', response.status);
        console.error('Response text:', errorText);
        throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('NetSuite API Error:', error);
      throw error;
    }
  }

  /**
   * Test the connection to NetSuite
   */
  async testConnection() {
    try {
      // Try a simple request to test credentials
      await this.makeRequest('/assemblyItem?limit=1');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

/**
 * Factory function to create NetSuite auth service with user credentials
 */
export const createNetSuiteAuth = (user) => {
  let credentials = user.getNetSuiteCredentials();
  
  // Fallback to environment variables if user doesn't have credentials configured
  if (!credentials) {
    console.log('Using environment variables for NetSuite credentials');
    credentials = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET
    };
    
    // Validate environment variables
    if (!credentials.accountId || !credentials.consumerKey || !credentials.consumerSecret || 
        !credentials.tokenId || !credentials.tokenSecret) {
      throw new Error('NetSuite environment variables not configured');
    }
  }
  
  return new NetSuiteAuth(credentials);
};