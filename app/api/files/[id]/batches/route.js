// app/api/files/[id]/batches/route.js     (proxy)
import { NextResponse } from 'next/server';
import { createBatch, listBatches } from '@/services/batch.service';

export async function GET(_, { params:{ id:fileId } }) {
  const batches = await listBatches({ fileId });
  return NextResponse.json({ batches });
}

export async function POST(req, { params:{ id:fileId } }) {
  const body = await req.json();
  const batch = await createBatch({ ...body, fileId });
  return NextResponse.json({ batch });
}
