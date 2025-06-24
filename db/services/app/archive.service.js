// services/archive.service.js - Updated to work with Batch model

import connectMongoDB from '@/db/index';
import Folder from '@/db/schemas/Folder';
import File from '@/db/schemas/File';
import Batch from '@/db/schemas/Batch';
import { ObjectId } from 'mongoose';

/**
 * Build the folder chain from a given folder up to root
 * Returns array from root down to the given folder
 */
async function buildFolderChain(folderId) {
  if (!folderId) return [];
  
  const chain = [];
  let current = await Folder.findById(folderId).lean();
  
  while (current) {
    chain.unshift(current); // Add to beginning
    if (!current.parentId) break;
    current = await Folder.findById(current.parentId).lean();
  }
  
  return chain;
}

/**
 * Mark a batch as archived when it's completed
 * This updates the batch record instead of creating a new file
 */
export async function createArchiveCopy(batch) {
  await connectMongoDB();
  
  const mother = await File.findById(batch.fileId).lean();
  if (!mother) return;

  // Get the folder path for categorization
  let folderPath = 'Root';
  if (mother.folderId) {
    const folderChain = await buildFolderChain(mother.folderId);
    folderPath = folderChain.map(f => f.name).join(' / ');
  }

  // Update the batch to mark it as archived
  await Batch.findByIdAndUpdate(batch._id, {
    isArchived: true,
    archivedAt: new Date(),
    folderPath: folderPath
  });
}

/**
 * Move an archived file to a different folder path
 * Since archived files are batches, we update the folderPath field
 */
export async function moveArchivedFile(fileId, targetFolderId) {
  await connectMongoDB();
  
  // Get the target folder path
  let targetFolderPath = 'Root';
  if (targetFolderId && targetFolderId !== 'root') {
    const folderChain = await buildFolderChain(targetFolderId);
    targetFolderPath = folderChain.map(f => f.name).join(' / ');
  }

  // Update the archived batch's folder path
  const updatedBatch = await Batch.findOneAndUpdate(
    { _id: fileId, isArchived: true },
    { folderPath: targetFolderPath },
    { new: true }
  ).populate('fileId', 'fileName').lean();

  if (!updatedBatch) {
    throw new Error('Archived file not found');
  }

  // Return in the expected format
  return {
    _id: updatedBatch._id,
    fileName: updatedBatch.fileId ? `${updatedBatch.fileId.fileName.replace('.pdf', '')}-Run-${updatedBatch.runNumber}.pdf` : `Batch Run ${updatedBatch.runNumber}`,
    folderPath: updatedBatch.folderPath,
    archivedAt: updatedBatch.archivedAt,
    originalFileId: updatedBatch.fileId?._id,
    batchId: updatedBatch._id,
    runNumber: updatedBatch.runNumber,
    isArchived: true
  };
}

/**
 * Get archived batches grouped by their original folder paths
 */
export async function getArchiveFolders() {
  await connectMongoDB();
  
  // Get all archived batches and group by folderPath
  const archivedBatches = await Batch.find({ 
    isArchived: true,
    archivedAt: { $exists: true }
  })
  .select('folderPath archivedAt')
  .lean();

  // Group by folder path and count batches
  const folderGroups = {};
  
  archivedBatches.forEach(batch => {
    const path = batch.folderPath || 'Root';
    if (!folderGroups[path]) {
      folderGroups[path] = {
        name: path,
        fileCount: 0,
        lastArchived: batch.archivedAt
      };
    }
    folderGroups[path].fileCount++;
    
    // Keep track of most recent archive date
    if (batch.archivedAt > folderGroups[path].lastArchived) {
      folderGroups[path].lastArchived = batch.archivedAt;
    }
  });

  // Convert to array and add IDs
  const folders = Object.entries(folderGroups).map(([path, data], index) => ({
    _id: `archive-folder-${index}`, // Synthetic ID
    name: data.name,
    fileCount: data.fileCount,
    lastArchived: data.lastArchived,
    isArchiveFolder: true
  }));

  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all archived batches
 */
export async function getAllArchivedFiles() {
  await connectMongoDB();
  
  const batches = await Batch.find({ 
    isArchived: true,
    archivedAt: { $exists: true }
  })
  .populate('fileId', 'fileName')
  .select('runNumber folderPath archivedAt fileId')
  .sort({ archivedAt: -1 })
  .lean();

  // Format the response to match the expected structure
  return batches.map(batch => ({
    _id: batch._id,
    fileName: batch.fileId ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : `Batch Run ${batch.runNumber}`,
    folderPath: batch.folderPath,
    archivedAt: batch.archivedAt,
    originalFileId: batch.fileId?._id,
    batchId: batch._id,
    runNumber: batch.runNumber,
    isArchived: true  // Add this flag so openFile knows it's archived
  }));
}

/**
 * Get archived batches by folder path name
 */
export async function getArchivedFilesByPath(folderPath) {
  await connectMongoDB();
  
  const batches = await Batch.find({ 
    isArchived: true,
    archivedAt: { $exists: true },
    folderPath: folderPath
  })
  .populate('fileId', 'fileName')
  .select('runNumber folderPath archivedAt fileId')
  .sort({ archivedAt: -1 })
  .lean();

  // Format the response to match the expected structure
  return batches.map(batch => ({
    _id: batch._id,
    fileName: batch.fileId ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : `Batch Run ${batch.runNumber}`,
    folderPath: batch.folderPath,
    archivedAt: batch.archivedAt,
    originalFileId: batch.fileId?._id,
    batchId: batch._id,
    runNumber: batch.runNumber,
    isArchived: true  // Add this flag so openFile knows it's archived
  }));
}

/**
 * Load an archived batch for viewing
 */
export async function getArchivedFile(id) {
  await connectMongoDB();
  
  const batch = await Batch.findOne({
    _id: id,
    isArchived: true
  })
  .populate('fileId', 'fileName pdf')
  .lean();
  
  if (!batch) return null;

  // Use the signed/baked PDF if available, otherwise use original file PDF
  let pdfData = null;
  if (batch.signedPdf?.data) {
    pdfData = `data:${batch.signedPdf.contentType || 'application/pdf'};base64,${batch.signedPdf.data.toString('base64')}`;
  } else if (batch.fileId?.pdf?.data) {
    pdfData = `data:${batch.fileId.pdf.contentType || 'application/pdf'};base64,${batch.fileId.pdf.data.toString('base64')}`;
  }

  // Return in the format expected by the file viewer
  return {
    _id: batch._id,
    fileName: batch.fileId ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : `Batch Run ${batch.runNumber}`,
    pdf: pdfData,
    folderPath: batch.folderPath,
    archivedAt: batch.archivedAt,
    runNumber: batch.runNumber,
    isBatch: true,
    isArchived: true,
    // Include other batch data that might be useful
    snapshot: batch.snapshot,
    overlayPng: batch.overlayPng,
    status: batch.status
  };
}