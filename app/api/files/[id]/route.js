// app/api/files/[id]/route.js
import { NextResponse } from 'next/server';
import {
  getFileById,
  updateFileMeta,
  updateFileStatus,
  deleteFile,          // if you expose DELETE
} from '@/services/file.service';

/* ---------- GET (single file) ---------- */
export async function GET(_req, { params }) {
  // ✅ first await is already implicit (we’re async), so warning is gone
  const { id } = params;

  const file = await getFileById(id, { includePdf: true });
  if (!file) {
    // status ≠ 500 because “id” might simply be “status” or “favicon.ico”
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ file });
}

/* ---------- PATCH (meta OR status) ------ */
export async function PATCH(req, { params }) {
  const { id } = params;
  const body   = await req.json();

  /* status change ? */
  if ('status' in body) {
    const f = await updateFileStatus(id, body.status);
    return NextResponse.json({ file: f });
  }

  /* metadata update */
  const f = await updateFileMeta(id, body);
  return NextResponse.json({ file: f });
}

/* (optional) DELETE */
export async function DELETE(_req, { params }) {
  const { id } = params;
  await deleteFile(id);
  return NextResponse.json({ ok: true });
}
