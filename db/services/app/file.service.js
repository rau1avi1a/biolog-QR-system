// db/services/app/file.service.js - Consolidated file operations
import mongoose from 'mongoose';
import { CoreService } from './core.service.js';
import db from '@/db/index.js';

/**
 * File Service - Handles all file operations with proper folder structure
 * Uses single db import for all dependencies
 */
class FileService extends CoreService {
  constructor() {
    super(null); // Pass null for lazy model resolution
  }

  async connect() {
    return db.connect();
  }

  // Lazy model getters
  get model() {
    return db.models.File;
  }

  get File() {
    return db.models.File;
  }

  get Folder() {
    return db.models.Folder;
  }

  // =============================================================================
  // FILE RETRIEVAL
  // =============================================================================

  async getFileById(id, { includePdf = false } = {}) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    await this.connect();

    const sel = includePdf ? '+pdf' : '-pdf';
    const doc = await this.File.findById(id)
      .select(sel)
      .populate('productRef', 'displayName sku netsuiteInternalId')
      .populate('solutionRef', 'displayName sku netsuiteInternalId')
      .populate('components.itemId', 'displayName sku netsuiteInternalId')
      .lean();

    if (!doc) return null;
    
    if (includePdf && doc.pdf?.data) {
      doc.pdf = `data:${doc.pdf.contentType || 'application/pdf'};base64,${doc.pdf.data.toString('base64')}`;
    } else {
      delete doc.pdf;
    }
    
    return doc;
  }

  async searchFiles(query) {
    await this.connect();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const searchTerms = trimmedQuery.split(/\s+/).filter(term => term.length > 0);
    if (searchTerms.length === 0) return [];

    const searchConditions = searchTerms.map(term => ({
      fileName: { 
        $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i'
      }
    }));

    return this.File.find({ $and: searchConditions })
      .select('-pdf')
      .sort({ fileName: 1 })
      .limit(50)
      .lean();
  }

  async listFiles({ folderId = null, onlyOriginals = true } = {}) {
    await this.connect();

    const query = { folderId: folderId ?? null };
    
    return this.File.find(query)
      .select('-pdf')
      .sort({ createdAt: -1 })
      .lean();
  }

  // =============================================================================
  // FILE CREATION
  // =============================================================================

  async createFileFromUpload({
    buffer,
    fileName,
    description = '',
    folderId = null,
    relativePath = '',
    isOriginal = true
  }) {
    await this.connect();

    let finalFolderId = folderId;
    
    if (relativePath && relativePath.trim() !== '') {
      try {
        finalFolderId = await this.ensureFolderStructure(relativePath, folderId);
      } catch (error) {
        console.error('Error creating folder structure:', error);
        finalFolderId = folderId;
      }
    }

    const doc = await this.File.create({
      fileName,
      description,
      folderId: finalFolderId,
      pdf: { data: buffer, contentType: 'application/pdf' },
    });

    const obj = doc.toObject();
    delete obj.pdf;
    return obj;
  }

  async createMultipleFilesFromUpload(files, baseFolderId = null) {
    await this.connect();
    
    const results = [];
    const folderCache = new Map();
    
    for (const fileData of files) {
      try {
        const { buffer, fileName, relativePath = '', description = '' } = fileData;
        
        let finalFolderId = baseFolderId;
        
        if (relativePath && relativePath.trim() !== '') {
          const cacheKey = `${baseFolderId || 'root'}:${relativePath}`;
          
          if (folderCache.has(cacheKey)) {
            finalFolderId = folderCache.get(cacheKey);
          } else {
            try {
              finalFolderId = await this.ensureFolderStructure(relativePath, baseFolderId);
              folderCache.set(cacheKey, finalFolderId);
            } catch (error) {
              console.error(`Error creating folder structure for ${relativePath}:`, error);
              finalFolderId = baseFolderId;
            }
          }
        }

        const doc = await this.File.create({
          fileName,
          description,
          folderId: finalFolderId,
          pdf: { data: buffer, contentType: 'application/pdf' },
        });

        const obj = doc.toObject();
        delete obj.pdf;
        results.push(obj);
        
      } catch (error) {
        console.error(`Error creating file ${fileData.fileName}:`, error);
        results.push({ 
          error: error.message, 
          fileName: fileData.fileName 
        });
      }
    }
    
    return results;
  }

  // =============================================================================
  // FILE UPDATES
  // =============================================================================

  async updateFileMeta(id, payload = {}) {
    await this.connect();
  
    console.log('📝 FileService: Updating file metadata:', id, payload);
  
    const $set = {
      // FIXED: Include fileName in updates
      fileName: payload.fileName ?? undefined,
      description: payload.description ?? '',
      productRef: payload.productRef ?? null,
      recipeQty: payload.recipeQty ?? null,
      recipeUnit: payload.recipeUnit ?? null,
    };
  
    // FIXED: Handle solutionRef properly - convert to ObjectId if needed
    if (payload.solutionRef !== undefined) {
      if (payload.solutionRef === null || payload.solutionRef === '') {
        $set.solutionRef = null;
      } else if (typeof payload.solutionRef === 'string') {
        // Ensure it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(payload.solutionRef)) {
          $set.solutionRef = new mongoose.Types.ObjectId(payload.solutionRef);
        } else {
          console.error('Invalid ObjectId for solutionRef:', payload.solutionRef);
          $set.solutionRef = null;
        }
      } else if (payload.solutionRef && payload.solutionRef._id) {
        // If it's an object with _id, extract the ID
        $set.solutionRef = new mongoose.Types.ObjectId(payload.solutionRef._id);
      }
    }
  
    // Remove undefined values to avoid overwriting with undefined
    Object.keys($set).forEach(key => {
      if ($set[key] === undefined) {
        delete $set[key];
      }
    });
  
    // Handle components with NetSuite data
    if (Array.isArray(payload.components)) {
      $set.components = payload.components.map(c => {
        const component = {
          itemId: c.itemId || c.item, // Handle both itemId and item fields
          amount: Number(c.amount || c.qty || 0),
          unit: c.unit || 'g'
        };
        
        // FIXED: Also handle qty field for amount
        if (c.qty !== undefined) {
          component.amount = Number(c.qty);
        }
        
        if (c.netsuiteData) {
          component.netsuiteData = {
            itemId: c.netsuiteData.itemId,
            itemRefName: c.netsuiteData.itemRefName,
            ingredient: c.netsuiteData.ingredient,
            bomQuantity: c.netsuiteData.bomQuantity,
            componentYield: c.netsuiteData.componentYield,
            units: c.netsuiteData.units,
            lineId: c.netsuiteData.lineId,
            bomComponentId: c.netsuiteData.bomComponentId,
            itemSource: c.netsuiteData.itemSource,
            type: 'netsuite'
          };
        }
        
        return component;
      });
    }
  
    // Handle NetSuite import metadata
    if (payload.netsuiteImportData) {
      $set.netsuiteImportData = {
        bomId: payload.netsuiteImportData.bomId,
        bomName: payload.netsuiteImportData.bomName,
        revisionId: payload.netsuiteImportData.revisionId,
        revisionName: payload.netsuiteImportData.revisionName,
        importedAt: new Date(payload.netsuiteImportData.importedAt),
        solutionNetsuiteId: payload.netsuiteImportData.solutionNetsuiteId,
        lastSyncAt: new Date()
      };
    }
  
    console.log('📝 FileService: Final update object:', $set);
  
    // FIXED: Update and get the populated result in one operation
    const updatedFile = await this.File.findByIdAndUpdate(
      id, 
      $set, 
      { 
        new: true, // Return the updated document
        runValidators: true 
      }
    )
    .populate('productRef', 'displayName sku netsuiteInternalId itemType')
    .populate('solutionRef', 'displayName sku netsuiteInternalId itemType') // FIXED: Populate solutionRef
    .populate('components.itemId', 'displayName sku netsuiteInternalId itemType')
    .lean();
  
    if (!updatedFile) {
      throw new Error('File not found');
    }
  
    console.log('✅ FileService: File updated successfully');
    console.log('🔗 FileService: Solution populated:', !!updatedFile.solutionRef);
  
    // FIXED: Add solution field for frontend compatibility
    const result = { ...updatedFile };
    
    // If solutionRef was populated, also set it as 'solution' field
    if (result.solutionRef && typeof result.solutionRef === 'object' && result.solutionRef._id) {
      result.solution = result.solutionRef;
      console.log('✅ FileService: Added solution field for frontend:', result.solution.displayName);
    }
  
    // Remove PDF data from response (metadata updates shouldn't include PDF)
    delete result.pdf;
  
    return result;
  }

  async updateFileStatus(id, status) {
    // Files don't have status in your model - only Batches do
    console.warn('updateFileStatus called on File - Files do not have status. Use Batch status instead.');
    return this.getFileById(id);
  }

  async deleteFile(id) {
    await this.connect();
    await this.File.findByIdAndDelete(id);
  }

  // =============================================================================
  // FOLDER MANAGEMENT
  // =============================================================================

  async ensureFolderStructure(relativePath, baseFolderId = null) {
    if (!relativePath || typeof relativePath !== 'string') {
      return baseFolderId;
    }

    const pathParts = relativePath.split('/').filter(part => part.trim() !== '');
    
    if (pathParts.length <= 1) {
      return baseFolderId;
    }

    const folderParts = pathParts.slice(0, -1);
    let currentParentId = baseFolderId;
    
    for (const folderName of folderParts) {
      try {
        let existingFolder = await this.Folder.findOne({ 
          name: folderName, 
          parentId: currentParentId 
        }).lean();
        
        if (existingFolder) {
          currentParentId = existingFolder._id;
        } else {
          const newFolder = await this.Folder.create({
            name: folderName,
            parentId: currentParentId
          });
          currentParentId = newFolder._id;
        }
      } catch (error) {
        if (error.code === 11000) {
          const existingFolder = await this.Folder.findOne({ 
            name: folderName, 
            parentId: currentParentId 
          }).lean();
          
          if (existingFolder) {
            currentParentId = existingFolder._id;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }
    
    return currentParentId;
  }

  // =============================================================================
  // ENHANCED METHODS USING DB.SERVICES
  // =============================================================================

  /**
   * Get file with related batches using db.services
   */
  async getFileWithBatches(id) {
    const file = await this.getFileById(id);
    if (!file) return null;

    // Get related batches using db.services
    const batches = await this.services.batchService.listBatches({
      filter: { fileId: id }
    });

    return {
      ...file,
      relatedBatches: batches
    };
  }

  /**
   * Archive file when batch is completed using db.services
   */
  async archiveFile(fileId, batchId) {
    const batch = await this.services.batchService.getBatchById(batchId);
    if (!batch) throw new Error('Batch not found');

    if (batch.status === 'Completed') {
      await this.services.createArchiveCopy(batch);
      return { archived: true, batchId };
    }

    return { archived: false, reason: 'Batch not completed' };
  }

  /**
   * Get file statistics including transaction data using db.services
   */
  async getFileStats(id) {
    const file = await this.getFileById(id);
    if (!file) return null;

    // Get related batches
    const batches = await this.services.batchService.listBatches({
      filter: { fileId: id }
    });

    // Get transaction stats for related items if available
    let transactionStats = null;
    if (file.solutionRef) {
      transactionStats = await this.services.txnService.getItemStats(file.solutionRef);
    }

    return {
      file,
      batchCount: batches.length,
      completedBatches: batches.filter(b => b.status === 'Completed').length,
      transactionStats
    };
  }
}

// Create singleton instance
const fileService = new FileService();

// Export service and methods
export { FileService };

export default fileService;