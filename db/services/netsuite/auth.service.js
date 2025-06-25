// services/netsuite/auth.service.js - FIXED VERSION
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import db from '../../index.js';

/**
 * NetSuite OAuth 1.0 (TBA) Authentication Service
 * Uses single db import for database operations
 */
export class NetSuiteAuth {
  constructor(credentials) {
    this.credentials = credentials;
    
    // CRITICAL: Store original account ID for OAuth realm (needs SB1 for sandbox)
    this.realmAccountId = credentials.accountId; // "4511488_SB1"
    
    // Convert account ID format for URL: 4511488_SB1 -> 4511488-sb1
    const urlAccountId = credentials.accountId.toLowerCase().replace('_', '-');
    this.baseUrl = `https://${urlAccountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;

    // Set up OAuth 1.0
    this.oauth = OAuth({
      consumer: {
        key: credentials.consumerKey,
        secret: credentials.consumerSecret,
      },
      signature_method: 'HMAC-SHA256',
      hash_function(base_string, key) {
        return crypto.createHmac('sha256', key).update(base_string).digest('base64');
      },
    });

    this.token = {
      key: credentials.tokenId,
      secret: credentials.tokenSecret,
    };
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
   * Make authenticated requests to NetSuite REST API
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const requestData = { url, method };
    const oauthData = this.oauth.authorize(requestData, this.token);

    // CRITICAL FIX: Use original account ID format for realm (with SB1)
    const authHeader = this.oauth.toHeader(oauthData);
    authHeader.Authorization = authHeader.Authorization.replace(
      'OAuth ',
      `OAuth realm="${this.realmAccountId}", ` // Use "4511488_SB1" for sandbox
    );

    const headers = {
      ...authHeader,
      'Content-Type': 'application/json',
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    console.log('NetSuite API Request Debug:', {
      url,
      method,
      accountId: this.realmAccountId,
      urlAccountId: this.baseUrl.split('.')[0].replace('https://', ''),
      endpoint
    });

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('NetSuite API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url,
        error: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  /**
   * Test the connection to NetSuite
   */
  async testConnection() {
    try {
      console.log('Testing NetSuite connection...');
      const result = await this.makeRequest('/assemblyItem?limit=1');
      console.log('NetSuite connection test successful:', result);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      console.error('NetSuite connection test failed:', error);
      return { success: false, message: error.message };
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
   * Log NetSuite API activity (console or DB)
   */
  async logApiActivity(endpoint, method, success, error = null) {
    console.log('NetSuite API Activity:', {
      timestamp: new Date(), endpoint, method,
      success, error: error?.message,
      accountId: this.realmAccountId
    });
    // Extend to save into a log collection if desired
  }
}

/**
 * Factory to create NetSuiteAuth using user credentials or env
 */
export const createNetSuiteAuth = async (user) => {
  let credentials;
  
  console.log('Creating NetSuite Auth for user:', user ? 'authenticated user' : 'environment variables');
  
  if (user && typeof user.getNetSuiteCredentials === 'function') {
    console.log('Using user method to get credentials');
    credentials = user.getNetSuiteCredentials();
  } else if (user?._id) {
    console.log('Fetching user from database to get credentials');
    await db.connect();
    const fullUser = await db.models.User.findById(user._id); // This returns a Mongoose document
    if (fullUser && typeof fullUser.getNetSuiteCredentials === 'function') {
      console.log('Found user method for credentials');
      credentials = fullUser.getNetSuiteCredentials();
    } else if (fullUser?.netsuiteCredentials?.isConfigured) {
      console.log('Using direct credential access');
      credentials = {
        accountId: fullUser.netsuiteCredentials.accountId,
        consumerKey: fullUser.netsuiteCredentials.consumerKey,
        consumerSecret: fullUser.netsuiteCredentials.consumerSecret,
        tokenId: fullUser.netsuiteCredentials.tokenId,
        tokenSecret: fullUser.netsuiteCredentials.tokenSecret
      };
    }
  }
  
  if (!credentials) {
    console.log('Using environment variable credentials');
    credentials = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET
    };
  }
  
  console.log('NetSuite credentials loaded:', {
    accountId: credentials.accountId,
    hasConsumerKey: !!credentials.consumerKey,
    hasConsumerSecret: !!credentials.consumerSecret,
    hasTokenId: !!credentials.tokenId,
    hasTokenSecret: !!credentials.tokenSecret
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