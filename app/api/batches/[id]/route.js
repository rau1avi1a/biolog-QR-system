// app/api/batches/[id]/route.js

import { NextResponse } from 'next/server';
import { getBatchById, updateBatch, deleteBatch } from '@/services/batch.service';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    const batch = await getBatchById(id, { includePdf: true });
    
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  } catch (err) {
    console.error('GET /api/batches/[id]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const data = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    const batch = await updateBatch(id, data);
    
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  } catch (err) {
    console.error('PATCH /api/batches/[id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    await deleteBatch(id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/batches/[id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}