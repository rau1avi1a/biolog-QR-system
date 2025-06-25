// services/netsuite/auth.service.js
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import db from '@/db/index.js';

/**
 * NetSuite OAuth 1.0 (TBA) Authentication Service
 * Uses single db import for database operations
 */
export class NetSuiteAuth {
  constructor(credentials) {
    this.credentials = credentials;
    // Convert account ID format: 4511488_SB1 -> 4511488-sb1 for URL
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
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NetSuite API Error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  /**
   * Test the connection to NetSuite
   */
  async testConnection() {
    try {
      await this.makeRequest('/assemblyItem?limit=1');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
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
      accountId: this.credentials.accountId
    });
    // Extend to save into a log collection if desired
  }
}

/**
 * Factory to create NetSuiteAuth using user credentials or env
 */
export const createNetSuiteAuth = async (user) => {
  let credentials;
  if (user && typeof user.getNetSuiteCredentials === 'function') {
    credentials = user.getNetSuiteCredentials();
  } else if (user?._id) {
    await db.connect();
    const fullUser = await db.models.User.findById(user._id);
    credentials = fullUser?.getNetSuiteCredentials();
  }
  if (!credentials) {
    credentials = {
      accountId: process.env.NETSUITE_ACCOUNT_ID,
      consumerKey: process.env.NETSUITE_CONSUMER_KEY,
      consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
      tokenId: process.env.NETSUITE_TOKEN_ID,
      tokenSecret: process.env.NETSUITE_TOKEN_SECRET
    };
  }
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
