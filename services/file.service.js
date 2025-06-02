// services/file.service.js - Fixed folder structure handling

import mongoose       from 'mongoose';
import connectMongoDB from '@/lib/index';

import File   from '@/models/File';
import Folder from '@/models/Folder';
import '@/models/Item';   // registers Item discriminators

/*───────────────────────────────────────────────────────────────────*/
/* Helpers                                                           */
/*───────────────────────────────────────────────────────────────────*/
const toDataURL = (bin, ctype = 'application/pdf') =>
  bin ? `data:${ctype};base64,${bin.toString('base64')}` : null;

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

function asId(id) {
  if (!isId(id)) throw new Error('Invalid ObjectId');
  return new mongoose.Types.ObjectId(id);
}

/*───────────────────────────────────────────────────────────────────*/
/* Enhanced folder creation that reuses existing folders             */
/*───────────────────────────────────────────────────────────────────*/
async function ensureFolderStructure(relativePath, baseFolderId = null) {
  if (!relativePath || typeof relativePath !== 'string') {
    return baseFolderId;
  }

  // Split the path and remove empty parts and the filename
  const pathParts = relativePath.split('/').filter(part => part.trim() !== '');
  
  // If no folders in the path, return the base folder
  if (pathParts.length <= 1) {
    return baseFolderId;
  }

  // Remove the filename (last part) to get only folder parts
  const folderParts = pathParts.slice(0, -1);
  
  let currentParentId = baseFolderId;
  
  // Create or find each folder in the hierarchy
  for (const folderName of folderParts) {
    try {
      // First, try to find existing folder with this name and parent
      let existingFolder = await Folder.findOne({ 
        name: folderName, 
        parentId: currentParentId 
      }).lean();
      
      if (existingFolder) {
        // Use existing folder
        currentParentId = existingFolder._id;
      } else {
        // Create new folder since it doesn't exist
        const newFolder = await Folder.create({
          name: folderName,
          parentId: currentParentId
        });
        currentParentId = newFolder._id;
      }
    } catch (error) {
      // If there's a duplicate key error, try to find the existing folder again
      if (error.code === 11000) {
        const existingFolder = await Folder.findOne({ 
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

/*───────────────────────────────────────────────────────────────────*/
/* R: Get a file by ID (optionally include PDF data)                */
/*───────────────────────────────────────────────────────────────────*/
export async function getFileById(id, { includePdf = false } = {}) {
  if (!isId(id)) return null;

  await connectMongoDB();

  const sel = includePdf ? '+pdf' : '-pdf';
  const doc = await File.findById(asId(id))
    .select(sel)
    .populate('productRef',  'displayName sku')
    .populate('solutionRef', 'displayName sku')
    .populate('components.itemId', 'displayName sku')
    .lean();

  if (!doc) return null;
  if (includePdf) {
    doc.pdf = toDataURL(doc.pdf?.data, doc.pdf?.contentType);
  } else {
    delete doc.pdf;
  }
  return doc;
}

export async function searchFiles(query) {
  await connectMongoDB();

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  // Split the query into individual terms and filter out empty ones
  const searchTerms = trimmedQuery.split(/\s+/).filter(term => term.length > 0);
  
  if (searchTerms.length === 0) {
    return [];
  }

  // Create a MongoDB query that requires ALL terms to be found in the filename
  // This allows "eco a1" to match "EcoPlate A1-A5-A9"
  const searchConditions = searchTerms.map(term => ({
    fileName: { 
      $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // Escape special regex chars
      $options: 'i' // Case insensitive
    }
  }));

  const files = await File.find({
    $and: searchConditions // ALL terms must be found
  })
  .select('-pdf') // Don't include PDF data in search results
  .sort({ fileName: 1 }) // Sort alphabetically
  .limit(50) // Limit results to prevent overwhelming the UI
  .lean();

  return files;
}

/*───────────────────────────────────────────────────────────────────*/
/* L: List all files (optionally scoped to a folder)               */
/*───────────────────────────────────────────────────────────────────*/
export async function listFiles({ 
  folderId = null, 
  onlyOriginals = true  // Default to only show original files
} = {}) {
  await connectMongoDB();

  const q = { folderId: folderId ?? null };
  
  // Add filter to only show original files (files are always originals in this model)
  // This parameter is here for consistency with the API expectations
  // In your model, all File documents are originals, batches are separate
  
  return File.find(q)
    .select('-pdf')
    .sort({ createdAt: -1 })
    .lean();
}

/*───────────────────────────────────────────────────────────────────*/
/* C: Upload & create a new File with proper folder structure       */
/*───────────────────────────────────────────────────────────────────*/
export async function createFileFromUpload({
  buffer,
  fileName,
  description = '',
  folderId = null,
  relativePath = '',
  isOriginal = true
}) {
  await connectMongoDB();

  // Ensure proper folder structure from relativePath
  let finalFolderId = folderId;
  
  if (relativePath && relativePath.trim() !== '') {
    try {
      finalFolderId = await ensureFolderStructure(relativePath, folderId);
    } catch (error) {
      console.error('Error creating folder structure:', error);
      // Fall back to the original folder if there's an error
      finalFolderId = folderId;
    }
  }

  // Create the file
  const doc = await File.create({
    fileName,
    description,
    folderId: finalFolderId,
    pdf: { data: buffer, contentType: 'application/pdf' },
  });

  const obj = doc.toObject();
  delete obj.pdf;
  return obj;
}

/*───────────────────────────────────────────────────────────────────*/
/* Batch upload helper for multiple files with structure            */
/*───────────────────────────────────────────────────────────────────*/
export async function createMultipleFilesFromUpload(files, baseFolderId = null) {
  await connectMongoDB();
  
  const results = [];
  const folderCache = new Map(); // Cache created folders to avoid duplicates
  
  for (const fileData of files) {
    try {
      const { buffer, fileName, relativePath = '', description = '' } = fileData;
      
      let finalFolderId = baseFolderId;
      
      if (relativePath && relativePath.trim() !== '') {
        // Check cache first
        const cacheKey = `${baseFolderId || 'root'}:${relativePath}`;
        
        if (folderCache.has(cacheKey)) {
          finalFolderId = folderCache.get(cacheKey);
        } else {
          // Create folder structure and cache the result
          try {
            finalFolderId = await ensureFolderStructure(relativePath, baseFolderId);
            folderCache.set(cacheKey, finalFolderId);
          } catch (error) {
            console.error(`Error creating folder structure for ${relativePath}:`, error);
            finalFolderId = baseFolderId;
          }
        }
      }

      // Create the file
      const doc = await File.create({
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
      // Continue with other files even if one fails
      results.push({ 
        error: error.message, 
        fileName: fileData.fileName 
      });
    }
  }
  
  return results;
}

/*───────────────────────────────────────────────────────────────────*/
/* U: Update file metadata (description, recipe fields, components) */
/*───────────────────────────────────────────────────────────────────*/
export async function updateFileMeta(id, payload = {}) {
  await connectMongoDB();

  const $set = {
    description : payload.description  ?? '',
    productRef  : payload.productRef   ?? null,
    solutionRef : payload.solutionRef  ?? null,
    recipeQty   : payload.recipeQty    ?? null,
    recipeUnit  : payload.recipeUnit   ?? null,
  };

  if (Array.isArray(payload.components)) {
    $set.components = payload.components.map(c => ({
      itemId : c.itemId,
      amount : Number(c.amount),
      unit   : c.unit || 'g'
    }));
  }

  await File.findByIdAndUpdate(asId(id), $set, { runValidators: true });
  return getFileById(id);
}

/*───────────────────────────────────────────────────────────────────*/
/* U: Update file status (not used for Files, only for Batches)     */
/*───────────────────────────────────────────────────────────────────*/
export async function updateFileStatus(id, status) {
  // Files don't have status in your model - only Batches do
  // This is here for API compatibility but doesn't do anything
  console.warn('updateFileStatus called on File - Files do not have status. Use Batch status instead.');
  return getFileById(id);
}

/*───────────────────────────────────────────────────────────────────*/
/* D: Delete a file by ID                                           */
/*───────────────────────────────────────────────────────────────────*/
export async function deleteFile(id) {
  await connectMongoDB();
  await File.findByIdAndDelete(asId(id));
}