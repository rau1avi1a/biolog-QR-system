// =============================================================================
// app/api/batches/route.js - FIXED Clean batches operations
// =============================================================================
import { NextResponse } from 'next/server';
import db from '@/db';
import { jwtVerify } from 'jose';

// Helper to get authenticated user
async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const user = await db.auth.findById(payload.userId);
    return user ? { _id: user._id, name: user.name, email: user.email, role: user.role } : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');

  if (id) {
    if (action === 'workorder-status') {
      // GET /api/batches?id=123&action=workorder-status
      const status = await db.batches.getWorkOrderStatus(id);
      
      return NextResponse.json({
        success: true,
        data: {
          ...status,
          displayId: status.workOrderNumber || status.workOrderId,
          description: status.workOrderNumber ? 
            `NetSuite Work Order ${status.workOrderNumber}` : 
            'Work Order'
        }
      }, {
        headers: { 'Cache-Control': 'no-cache' }
      });
    }
    
    // GET /api/batches?id=123 - FIXED METHOD NAME
    const batch = await db.batches.getBatchById(id);
    if (!batch) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: batch });
  }

  // GET /api/batches?status=Review&fileId=123 - FIXED METHOD NAME
  const filter = {};
  const status = searchParams.get('status');
  const fileId = searchParams.get('fileId');
  if (status) filter.status = status;
  if (fileId) filter.fileId = fileId;

  const batches = await db.batches.listBatches({ filter });
  return NextResponse.json({ success: true, data: batches });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');

  if (id && action === 'workorder-retry') {
    // POST /api/batches?id=123&action=workorder-retry - FIXED METHOD NAME
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { quantity } = await request.json();
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Valid quantity required' }, { status: 400 });
    }

    const result = await db.batches.retryWorkOrderCreation(id, quantity, user._id);
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Work order creation retry initiated'
    });
  }

  // POST /api/batches - FIXED METHOD NAME
  const payload = await request.json();
  const user = await getAuthUser(request);
  payload.user = user;

  const fileId = payload.originalFileId || payload.fileId;
  if (!fileId) {
    return NextResponse.json({ success: false, error: 'Missing fileId' }, { status: 400 });
  }

  const batch = await db.batches.createBatch(payload);
  return NextResponse.json({ success: true, data: batch }, { status: 201 });
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const payload = await request.json();
  const user = await getAuthUser(request);
  payload.user = user;

  // FIXED METHOD NAME
  const batch = await db.batches.updateBatch(id, payload);
  if (!batch) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: batch });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  // FIXED METHOD NAME
  const batch = await db.batches.deleteBatch(id);
  if (!batch) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: batch });
}