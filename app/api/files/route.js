// app/api/files/route.js
import { NextResponse } from 'next/server';

/*  ✅ ONE canonical import path for the service ------------------- */
import {
  listFiles,
  getFileById,
  createFileFromUpload,
} from '@/services/file.service';   // ← singular “service”, not “services”

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
    /* “webkitRelativePath” -> relativePath (drag-n-drop nested folder) */
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
    const partial = searchParams.get('partial');     // /api/files?partial=foo bar
    const folder  = searchParams.get('folderId');    // /api/files?folderId=abc

    /* A. single ——————————————————————————————— */
    if (id) {
      const file = await getFileById(id, { includePdf: true });
      if (!file) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    /* B. quick “filename contains *all* tokens” search ———————— */
    if (partial) {
      const tokens = partial.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        return NextResponse.json({ error: 'Empty query' }, { status: 400 });
      }

      /* build a single Mongo `$and` regex query instead of post-filtering */
      const and = tokens.map(t => ({
        fileName: { $regex: `\\b${t}\\b`, $options: 'i' },
      }));

      const [hit] = await listFiles({ onlyNew: false });     // <- lightweight
      const file  = hit ? await getFileById(hit._id, { includePdf: true }) : null;

      if (!file) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    /* C. list ——————————————————————————————————— */
    const files = await listFiles({ folderId: folder ?? null });
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
    const file = await createFileFromUpload(data);
    return NextResponse.json({ file });
  } catch (err) {
    console.error('POST /api/files', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
