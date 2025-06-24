// app/api/files/[id]/batches/route.js     (proxy)
import { NextResponse } from 'next/server';
import { createBatch, listBatches } from '@/db/services/app/batch.service';

export async function GET(_, { params }) {
  // Next.js 15 requires awaiting params
  const { id: fileId } = await params;
  const batches = await listBatches({ fileId });
  return NextResponse.json({ batches });
}

export async function POST(req, { params }) {
  // Next.js 15 requires awaiting params
  const { id: fileId } = await params;
  const body = await req.json();
  const batch = await createBatch({ ...body, fileId });
  return NextResponse.json({ batch });
}