// db/services/app/core.service.js - Enhanced with single db import pattern
import db from '@/db/index.js';

/**
 * CoreService - Base class providing common CRUD operations
 * Uses single db import for all database operations
 */
export class CoreService {
  constructor(model, options = {}) {
    this._model = model; // Store the passed model (could be null for lazy loading)
    this.options = {
      defaultPopulate: [],
      defaultSort: { createdAt: -1 },
      defaultLimit: 50,
      selectFields: null,
      excludeFields: [],
      ...options
    };
  }

  /**
   * Smart model getter - handles both direct models and lazy resolution
   */
  get model() {
    // If model was passed to constructor, use it
    if (this._model) {
      return this._model;
    }
    
    // Check if subclass defines a lazy model getter
    const prototype = Object.getPrototypeOf(this);
    const descriptor = Object.getOwnPropertyDescriptor(prototype.constructor.prototype, 'model');
    
    if (descriptor && descriptor.get && descriptor.get !== this.constructor.prototype.model) {
      return descriptor.get.call(this);
    }
    
    throw new Error(`No model defined for ${this.constructor.name}. Either pass a model to constructor or define a lazy getter.`);
  }

  /**
   * Get model name for error messages
   */
  get modelName() {
    try {
      return this.model?.modelName || this.constructor.name.replace('Service', '') || 'Unknown';
    } catch {
      return this.constructor.name.replace('Service', '') || 'Unknown';
    }
  }

  /**
   * Ensure database connection using single db import
   */
  async connect() {
    await db.connect();
  }

  /**
   * Access other services through db.services
   */
  get services() {
    return db.services;
  }

  /**
   * Access models through db.models
   */
  get models() {
    return db.models;
  }

  /**
   * Build select string excluding sensitive fields
   */
  buildSelect(includeFields = [], excludeFields = []) {
    const exclude = [...this.options.excludeFields, ...excludeFields];
    if (exclude.length > 0) {
      return exclude.map(field => `-${field}`).join(' ');
    }
    if (includeFields.length > 0) {
      return includeFields.join(' ');
    }
    return this.options.selectFields;
  }

  /**
   * Build population array
   */
  buildPopulate(populate = []) {
    const defaultPop = this.options.defaultPopulate;
    return [...defaultPop, ...populate].filter((pop, index, self) => 
      index === self.findIndex(p => 
        (typeof p === 'string' ? p : p.path) === (typeof pop === 'string' ? pop : pop.path)
      )
    );
  }

  /**
   * Create a new document
   */
  async create(data, options = {}) {
    await this.connect();
    
    const { populate = [], session = null } = options;
    
    try {
      const doc = await this.model.create(data, session ? { session } : {});
      
      if (populate.length > 0) {
        return this.findById(doc._id, { populate });
      }
      
      return doc.toObject();
    } catch (error) {
      throw new Error(`Error creating ${this.modelName}: ${error.message}`);
    }
  }

  /**
   * Find document by ID
   */
  async findById(id, options = {}) {
    await this.connect();
    
    const { 
      populate = [], 
      includeFields = [], 
      excludeFields = [],
      lean = true 
    } = options;
    
    try {
      let query = this.model.findById(id);
      
      const selectStr = this.buildSelect(includeFields, excludeFields);
      if (selectStr) query = query.select(selectStr);
      
      const populateFields = this.buildPopulate(populate);
      populateFields.forEach(pop => {
        query = query.populate(pop);
      });
      
      if (lean) query = query.lean();
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Error finding ${this.modelName} by ID: ${error.message}`);
    }
  }

  /**
   * Find multiple documents with filtering and pagination
   */
  async find(options = {}) {
    await this.connect();
    
    const {
      filter = {},
      populate = [],
      includeFields = [],
      excludeFields = [],
      sort = this.options.defaultSort,
      limit = this.options.defaultLimit,
      skip = 0,
      lean = true
    } = options;
    
    try {
      let query = this.model.find(filter);
      
      const selectStr = this.buildSelect(includeFields, excludeFields);
      if (selectStr) query = query.select(selectStr);
      
      const populateFields = this.buildPopulate(populate);
      populateFields.forEach(pop => {
        query = query.populate(pop);
      });
      
      if (sort) query = query.sort(sort);
      if (limit) query = query.limit(limit);
      if (skip) query = query.skip(skip);
      if (lean) query = query.lean();
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Error finding ${this.modelName} documents: ${error.message}`);
    }
  }

/**
 * Update document by ID - FIXED to handle nested Date objects properly
 */
async updateById(id, data) {
  try {
    await this.connect();
    
    // FIXED: Special handling for nested objects with Date fields
    const sanitizedData = this.sanitizeForMongoose(data);
    
    console.log('🔍 CoreService updateById:', {
      id,
      hasSignedPdf: !!sanitizedData.signedPdf,
      signedPdfDataType: sanitizedData.signedPdf?.data ? typeof sanitizedData.signedPdf.data : 'no data',
      isBuffer: sanitizedData.signedPdf?.data ? Buffer.isBuffer(sanitizedData.signedPdf.data) : false,
      hasNetsuiteData: !!sanitizedData.netsuiteWorkOrderData,
      netsuiteDataKeys: sanitizedData.netsuiteWorkOrderData ? Object.keys(sanitizedData.netsuiteWorkOrderData) : 'none'
    });
    
    // CRITICAL FIX: Use dot notation for nested objects instead of $set with the entire object
    let updateOperation;
    
    if (sanitizedData.netsuiteWorkOrderData) {
      // Build update operation using dot notation for nested fields
      updateOperation = {};
      
      // Handle nested netsuiteWorkOrderData fields individually
      Object.entries(sanitizedData.netsuiteWorkOrderData).forEach(([key, value]) => {
        updateOperation[`netsuiteWorkOrderData.${key}`] = value;
      });
      
      // Add all other non-nested fields
      Object.entries(sanitizedData).forEach(([key, value]) => {
        if (key !== 'netsuiteWorkOrderData') {
          updateOperation[key] = value;
        }
      });
      
      console.log('🔧 Using dot notation update for nested fields:', {
        operationKeys: Object.keys(updateOperation),
        nestedFields: Object.keys(updateOperation).filter(k => k.startsWith('netsuiteWorkOrderData.')),
        regularFields: Object.keys(updateOperation).filter(k => !k.startsWith('netsuiteWorkOrderData.'))
      });
      
    } else {
      // No nested fields, use direct update
      updateOperation = sanitizedData;
    }
    
    const result = await this.model.findByIdAndUpdate(
      id,
      updateOperation, // Use the prepared operation instead of $set
      { 
        new: true, 
        runValidators: false, // Keep this false to avoid validation issues with complex nested objects
        lean: false 
      }
    );
    
    if (!result) {
      throw new Error(`${this.modelName} not found`);
    }
    
    return result;
  } catch (error) {
    throw new Error(`Error updating ${this.modelName}: ${error.message}`);
  }
}

// FIXED: Enhanced sanitization method that properly handles Date objects
sanitizeForMongoose(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle Date objects - keep them as-is
  if (obj instanceof Date) return obj;
  
  // Handle Buffer objects - keep them as-is
  if (Buffer.isBuffer(obj)) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => this.sanitizeForMongoose(item));
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (value instanceof Date) {
      // CRITICAL: Keep Date objects as-is, don't process them further
      sanitized[key] = value;
      console.log(`✅ Preserved Date object for ${key}:`, value);
    } else if (Buffer.isBuffer(value)) {
      // Keep Buffer objects as-is
      sanitized[key] = value;
    } else if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
      // Convert serialized Buffer back to Buffer
      console.log(`🔧 Converting serialized Buffer back to Buffer for ${key}`);
      sanitized[key] = Buffer.from(value.data);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check for empty objects that could cause issues
      if (Object.keys(value).length === 0) {
        console.warn(`⚠️ Found empty object for ${key}, setting to null`);
        sanitized[key] = null;
      } else {
        // Recursively sanitize nested objects, but be careful with Date objects
        sanitized[key] = this.sanitizeForMongoose(value);
      }
    } else {
      // Primitive values - keep as-is
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
  
  // Helper method to sanitize Buffer objects
  sanitizeBuffers(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (Buffer.isBuffer(value)) {
        // Keep Buffer as-is
        sanitized[key] = value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Check for serialized Buffer objects
        if (value.type === 'Buffer' && Array.isArray(value.data)) {
          console.log(`🔧 Converting serialized Buffer back to Buffer for ${key}`);
          sanitized[key] = Buffer.from(value.data);
        } else {
          // Recursively sanitize nested objects
          sanitized[key] = this.sanitizeBuffers(value);
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Delete document by ID
   */
  async deleteById(id, options = {}) {
    await this.connect();
    
    const { session = null } = options;
    
    try {
      const result = await this.model.findByIdAndDelete(id, session ? { session } : {}).lean();
      
      if (!result) {
        throw new Error(`${this.modelName} not found`);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Error deleting ${this.modelName}: ${error.message}`);
    }
  }

  /**
   * Count documents matching filter
   */
  async count(filter = {}) {
    await this.connect();
    
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting ${this.modelName} documents: ${error.message}`);
    }
  }

  /**
   * Check if document exists
   */
  async exists(filter) {
    await this.connect();
    
    try {
      const result = await this.model.exists(filter);
      return !!result;
    } catch (error) {
      throw new Error(`Error checking ${this.modelName} existence: ${error.message}`);
    }
  }

  /**
   * Clean update data by removing undefined values and empty objects
   */
  cleanUpdateData(data) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          const cleanedNested = this.cleanUpdateData(value);
          if (Object.keys(cleanedNested).length > 0) {
            cleaned[key] = cleanedNested;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  /**
   * Aggregate pipeline for complex queries
   */
  async aggregate(pipeline, options = {}) {
    await this.connect();
    
    const { session = null } = options;
    
    try {
      const aggregation = this.model.aggregate(pipeline);
      if (session) aggregation.session(session);
      
      return await aggregation.exec();
    } catch (error) {
      throw new Error(`Error in ${this.modelName} aggregation: ${error.message}`);
    }
  }

  /**
   * Bulk operations
   */
  async bulkWrite(operations, options = {}) {
    await this.connect();
    
    const { session = null, ordered = false } = options;
    
    try {
      return await this.model.bulkWrite(
        operations, 
        { 
          ordered,
          ...(session && { session })
        }
      );
    } catch (error) {
      throw new Error(`Error in ${this.modelName} bulk write: ${error.message}`);
    }
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Convenience methods that map to the base CRUD operations
   */
  async update(id, data, options = {}) {
    return this.updateById(id, data, options);
  }

  async delete(id, options = {}) {
    return this.deleteById(id, options);
  }

  async list(options = {}) {
    return this.find(options);
  }

  async get(id, options = {}) {
    return this.findById(id, options);
  }

  // =============================================================================
  // HELPER METHODS FOR ACCESSING OTHER SERVICES
  // =============================================================================

  /**
   * Quick access to transaction service
   */
  get txnService() {
    return this.services.txnService;
  }

  /**
   * Quick access to item service
   */
  get itemService() {
    return this.services.itemService;
  }

  /**
   * Quick access to file service
   */
  get fileService() {
    return this.services.fileService;
  }

  /**
   * Quick access to async work order service
   */
  get asyncWorkOrderService() {
    return this.services.AsyncWorkOrderService;
  }

  /**
   * Quick access to workflow services
   */
  get workflowServices() {
    return {
      createArchiveCopy: this.services.createArchiveCopy,
      archiveService: this.services.archiveService,
      poService: this.services.poService,
      vendorService: this.services.vendorService,
      cycleCountService: this.services.cycleCountService
    };
  }
}

export default CoreService;