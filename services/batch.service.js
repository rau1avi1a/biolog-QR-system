import mongoose from 'mongoose';
import Batch    from '@/models/Batch.js';
import { getFileById }       from './file.service.js';
import { createArchiveCopy } from './archive.service.js';

const asId = (id) => new mongoose.Types.ObjectId(id);

/** CREATE a new Batch from a File template */
export async function createBatch({ fileId, overlayPng, status = 'In Progress' }) {
  const file = await getFileById(fileId);
  if (!file) throw new Error('File not found');

  const snapshot = {
    enabled     : true,
    productRef  : file.productRef?._id,
    solutionRef : file.solutionRef?._id,
    recipeQty   : file.recipeQty,
    recipeUnit  : file.recipeUnit,
    components  : file.components
  };

  return Batch.create({
    fileId     : asId(fileId),
    overlayPng,
    status,
    snapshot
  });
}

/** GET one */
export const getBatch = (id) =>
  Batch.findById(id).lean();

/** DELETE one */
export const deleteBatch = (id) =>
  Batch.findByIdAndDelete(id).lean();

/** LIST all (optionally by fileId / status) */
export async function listBatches({ fileId, status } = {}) {
  const q = {};
  if (fileId) q.fileId = asId(fileId);
  if (status) q.status = status;

  return Batch.find(q)
    .sort({ runNumber: -1 })
    .populate('fileId','fileName')    // bring in the mother file’s name
    .lean();
}

/** UPDATE a batch (and when flipping to Completed, archive) */
export async function updateBatch(id, payload) {
  const prev = await Batch.findById(id).lean();
  const next = await Batch.findByIdAndUpdate(id, payload, { new: true }).lean();

  if (prev && next && prev.status !== 'Completed' && next.status === 'Completed') {
    await createArchiveCopy(next);
  }

  return next;
}
