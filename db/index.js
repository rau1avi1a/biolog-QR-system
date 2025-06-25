// db/index.js - Unified Database API
import models from './models/index.js';
import * as appServices from './services/app/index.js';
import * as netsuiteServices from './services/netsuite/index.js';
import { basicAuth, withAuth, withRole } from './lib/auth.js';
import { connectMongo } from './lib/db-connection.js';

/**
 * Unified DB API
 *
 * Available on import:
 *   default export -> the Database instance
 *
 * Methods & properties on `db`:
 *
 *   connect(): Promise<Database>
 *     Initialize or reuse the MongoDB connection via db/lib/db-connection.js.
 *
 *   db.connected: boolean
 *     Whether the MongoDB connection is active.
 *
 *   db.models: {
 *     <ModelName>: mongoose.Model
 *   }
 *     Access any Mongoose model by name. Example:
 *       const user = await db.models.User.findById(id);
 *
 *   db.services: { <serviceName>: Service }
 *     Access application services. Example:
 *       await db.services.batchService.createBatch(data);
 *
 *   db.netsuite: { <fn>: Function, ... }
 *     Direct access to NetSuite services. Example:
 *       await db.netsuite.createAuth(user);
 *
 *   db.auth: { basicAuth, withAuth, withRole }
 *     Authentication utilities for API routes.
 */

class Database {
  constructor() {
    this._connected = false;
  }

  /**
   * Ensure MongoDB connection is initialized.
   * @returns {Promise<Database>} Resolves to this Database instance.
   */
  async connect() {
    if (!this._connected) {
      await connectMongo();
      this._connected = true;
      console.log('🔗 Database connected');
    }
    return this;
  }

  /**
   * Connection status flag.
   * @type {boolean}
   */
  get connected() {
    return this._connected;
  }

  /**
   * Mongoose models registry.
   * @returns {object.<string, mongoose.Model>}
   */
  get models() {
    return models;
  }

  /**
   * Application services.
   * @returns {object}
   */
  get services() {
    return appServices;
  }

  /**
   * NetSuite integration services.
   * @returns {object}
   */
  get netsuite() {
    return netsuiteServices;
  }

  /**
   * Authentication utilities for API routes.
   * @returns {{ basicAuth: Function, withAuth: Function, withRole: Function }}
   */
  get auth() {
    return { basicAuth, withAuth, withRole };
  }
}

const db = new Database();
export default db;
