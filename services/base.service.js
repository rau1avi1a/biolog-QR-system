// services/base.service.js - Dynamic base service for CRUD operations
import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';

/**
 * Dynamic base service that automatically handles model schema changes
 * Provides common CRUD operations that work with any Mongoose model
 */
export class BaseService {
  constructor(model, options = {}) {
    this.model = model;
    this.modelName = model.modelName;
    this.options = {
      // Default options
      defaultPopulate: [], // Fields to populate by default
      searchFields: [], // Fields to search in when doing text search
      defaultSort: { createdAt: -1 }, // Default sort order
      defaultLimit: 50, // Default pagination limit
      selectFields: null, // Fields to select by default (null = all)
      excludeFields: [], // Fields to always exclude
      ...options
    };
  }

  /**
   * Get model schema fields dynamically
   */
  getSchemaFields() {
    const schema = this.model.schema;
    const fields = {};
    
    schema.eachPath((path, schemaType) => {
      if (path === '_id' || path === '__v') return;
      
      fields[path] = {
        type: schemaType.instance,
        required: schemaType.isRequired,
        default: schemaType.defaultValue,
        ref: schemaType.options?.ref,
        enum: schemaType.enumValues,
        min: schemaType.options?.min,
        max: schemaType.options?.max,
        maxlength: schemaType.options?.maxlength,
        minlength: schemaType.options?.minlength
      };
    });
    
    return fields;
  }

  /**
   * Build select string excluding sensitive fields
   */
  buildSelectString(includeFields = [], excludeFields = []) {
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
    const allPopulate = [...defaultPop, ...populate];
    
    // Remove duplicates and return
    return allPopulate.filter((pop, index, self) => 
      index === self.findIndex(p => 
        (typeof p === 'string' ? p : p.path) === (typeof pop === 'string' ? pop : pop.path)
      )
    );
  }

  /**
   * Create a new document
   */
  async create(data, options = {}) {
    await connectMongoDB();
    
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
    await connectMongoDB();
    
    const { 
      populate = [], 
      includeFields = [], 
      excludeFields = [],
      lean = true 
    } = options;
    
    try {
      let query = this.model.findById(id);
      
      // Apply select
      const selectStr = this.buildSelectString(includeFields, excludeFields);
      if (selectStr) query = query.select(selectStr);
      
      // Apply population
      const populateFields = this.buildPopulate(populate);
      populateFields.forEach(pop => {
        query = query.populate(pop);
      });
      
      // Apply lean
      if (lean) query = query.lean();
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Error finding ${this.modelName} by ID: ${error.message}`);
    }
  }

  /**
   * Find multiple documents with filtering, pagination, and search
   */
  async find(options = {}) {
    await connectMongoDB();
    
    const {
      filter = {},
      populate = [],
      includeFields = [],
      excludeFields = [],
      sort = this.options.defaultSort,
      limit = this.options.defaultLimit,
      skip = 0,
      page = null, // If provided, skip will be calculated as (page - 1) * limit
      search = null, // Text search string
      lean = true
    } = options;
    
    try {
      // Build the base filter
      let query = this.model.find(filter);
      
      // Add text search if provided
      if (search && this.options.searchFields.length > 0) {
        const searchRegex = new RegExp(search, 'i');
        const searchQuery = {
          $or: this.options.searchFields.map(field => ({
            [field]: searchRegex
          }))
        };
        query = query.find(searchQuery);
      }
      
      // Apply select
      const selectStr = this.buildSelectString(includeFields, excludeFields);
      if (selectStr) query = query.select(selectStr);
      
      // Apply population
      const populateFields = this.buildPopulate(populate);
      populateFields.forEach(pop => {
        query = query.populate(pop);
      });
      
      // Apply sorting
      if (sort) query = query.sort(sort);
      
      // Apply pagination
      const actualSkip = page ? (page - 1) * limit : skip;
      if (limit) query = query.limit(limit);
      if (actualSkip) query = query.skip(actualSkip);
      
      // Apply lean
      if (lean) query = query.lean();
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Error finding ${this.modelName} documents: ${error.message}`);
    }
  }

  /**
   * Update document by ID
   */
  async updateById(id, updateData, options = {}) {
    await connectMongoDB();
    
    const { 
      populate = [], 
      includeFields = [], 
      excludeFields = [],
      runValidators = true,
      new: returnNew = true,
      session = null 
    } = options;
    
    try {
      // Filter out undefined values and empty objects
      const cleanData = this.cleanUpdateData(updateData);
      
      let query = this.model.findByIdAndUpdate(
        id, 
        cleanData, 
        { 
          new: returnNew, 
          runValidators,
          ...(session && { session })
        }
      );
      
      // Apply select
      const selectStr = this.buildSelectString(includeFields, excludeFields);
      if (selectStr) query = query.select(selectStr);
      
      // Apply population
      const populateFields = this.buildPopulate(populate);
      populateFields.forEach(pop => {
        query = query.populate(pop);
      });
      
      const result = await query.lean().exec();
      
      if (!result) {
        throw new Error(`${this.modelName} not found`);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Error updating ${this.modelName}: ${error.message}`);
    }
  }

  /**
   * Delete document by ID
   */
  async deleteById(id, options = {}) {
    await connectMongoDB();
    
    const { session = null, includeFields = [], excludeFields = [] } = options;
    
    try {
      let query = this.model.findByIdAndDelete(id, session ? { session } : {});
      
      // Apply select to see what was deleted
      const selectStr = this.buildSelectString(includeFields, excludeFields);
      if (selectStr) query = query.select(selectStr);
      
      const result = await query.lean().exec();
      
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
    await connectMongoDB();
    
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
    await connectMongoDB();
    
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
   * Get aggregation pipeline for complex queries
   */
  async aggregate(pipeline, options = {}) {
    await connectMongoDB();
    
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
    await connectMongoDB();
    
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
}

export default BaseService;