// services/file.service.js

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

/*───────────────────────────────────────────────────────────────────*/
/* L: List all files (optionally scoped to a folder)               */
/*───────────────────────────────────────────────────────────────────*/
export async function listFiles({ folderId = null } = {}) {
  await connectMongoDB();

  const q = { folderId: folderId ?? null };
  return File.find(q)
    .select('-pdf')
    .sort({ createdAt: -1 })
    .lean();
}

/*───────────────────────────────────────────────────────────────────*/
/* C: Upload & create a new File                                   */
/*───────────────────────────────────────────────────────────────────*/
export async function createFileFromUpload({
  buffer,
  fileName,
  description = '',
  folderId    = null,
  relativePath = ''
}) {
  await connectMongoDB();

  // auto-create any nested folders from `relativePath`
  let finalFolderId = folderId;
  if (relativePath) {
    let parentId = folderId ?? null;
    for (const dir of relativePath.split('/').slice(0, -1)) {
      /* eslint-disable no-await-in-loop */
      const existing = await Folder.findOne({ name: dir, parentId });
      parentId = existing
        ? existing._id
        : (await Folder.create({ name: dir, parentId }))._id;
    }
    finalFolderId = parentId;
  }

  const doc = await File.create({
    fileName,
    description,
    folderId: finalFolderId,
    pdf: { data: buffer, contentType: 'application/pdf' }
  });

  const obj = doc.toObject();
  delete obj.pdf;
  return obj;
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
/* D: Delete a file by ID                                           */
/*───────────────────────────────────────────────────────────────────*/
export async function deleteFile(id) {
  await connectMongoDB();
  await File.findByIdAndDelete(asId(id));
}
