// services/archive.service.js - Updated to work with Batch model

import connectMongoDB from '@/lib/index';
import Folder from '@/models/Folder';
import File from '@/models/File';
import Batch from '@/models/Batch';
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

  console.log(`Marked batch ${batch._id} as archived with folder path: ${folderPath}`);
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