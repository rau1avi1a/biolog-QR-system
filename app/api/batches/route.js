// app/api/batches/route.js

import { NextResponse }    from 'next/server';
import { createBatch, listBatches } from '@/services/batch.service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const fileId = searchParams.get('fileId');
  
    const batches = await listBatches({ status, fileId });
    return NextResponse.json({ batches });
  }
  
export async function POST(req) {
  try {
    const data = await req.json();     // { fileId, overlayPng, … }
    const batch = await createBatch(data);
    return NextResponse.json({ batch });
  } catch (err) {
    console.error('POST /api/batches', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
