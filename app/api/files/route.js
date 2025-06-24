// app/api/files/route.js
import { NextResponse } from 'next/server';

/*  ✅ ONE canonical import path for the service ------------------- */
import {
  listFiles,
  getFileById,
  createFileFromUpload,
  searchFiles
} from '@/db/services/app/file.service';   // ← singular "service", not "services"

export const dynamic = 'force-dynamic';

/* ----------------------------------------------------------------- */
/* tiny helper – pull the <input type="file"> out of a multipart req */
/* ----------------------------------------------------------------- */
async function parseUpload(req) {
  const form  = await req.formData();
  const blob  = form.get('file');
  if (!blob) throw new Error('file missing');

  const array = await blob.arrayBuffer();
  return {
    buffer       : Buffer.from(array),
    fileName     : form.get('fileName')    || blob.name,
    description  : form.get('description') || '',
    folderId     : form.get('folderId')    || null,
    /* "webkitRelativePath" -> relativePath (drag-n-drop nested folder) */
    relativePath : form.get('relativePath')|| '',
  };
}

/* ----------------------------------------------------------------- */
/* GET → (A) by id ‖ (B) fuzzy search ‖ (C) list in folder           */
/* ----------------------------------------------------------------- */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id      = searchParams.get('id');          // /api/files?id=123
    const search  = searchParams.get('search');      // /api/files?search=eco a1
    const folder  = searchParams.get('folderId');    // /api/files?folderId=abc

    /* A. single ——————————————————————————————— */
    if (id) {
      const file = await getFileById(id, { includePdf: true });
      if (!file) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    /* B. search ——————————————————————————————— */
    if (search) {
      const query = search.trim();
      if (query.length === 0) {
        return NextResponse.json({ files: [] });
      }

      // Call the new searchFiles function
      const files = await searchFiles(query);
      return NextResponse.json({ files });
    }

    /* C. list ——————————————————————————————————— */
    const files = await listFiles({ 
      folderId: folder ?? null,
      onlyOriginals: true
    });
    return NextResponse.json({ files });
  } catch (err) {
    console.error('GET /api/files', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/* ----------------------------------------------------------------- */
/* POST → upload (flat or drag-n-dropped folders)                    */
/* ----------------------------------------------------------------- */
export async function POST(req) {
  try {
    const data = await parseUpload(req);
    
    // Mark this as an original file (not a batch copy)
    const fileData = {
      ...data,
      isOriginal: true,  // Flag to distinguish from batch copies
      status: null       // Original files don't have workflow status
    };
    
    const file = await createFileFromUpload(fileData);
    return NextResponse.json({ file });
  } catch (err) {
    console.error('POST /api/files', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}