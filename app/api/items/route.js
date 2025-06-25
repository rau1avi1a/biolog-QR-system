// =============================================================================
// app/api/items/route.js - Complete item operations
// =============================================================================
import { NextResponse } from 'next/server';
import db from '@/db';
import { jwtVerify } from 'jose';

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
  const lotId = searchParams.get('lotId');

  if (id) {
    if (action === 'lots') {
      // GET /api/items?id=123&action=lots&lotId=456 (optional)
      const lots = await db.items.getLots(id, lotId);
      return NextResponse.json({ success: true, lots });
    }
    
    if (action === 'transactions') {
      // GET /api/items?id=123&action=transactions
      const options = {
        txnType: searchParams.get('type'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
        limit: parseInt(searchParams.get('limit')) || 100,
        page: parseInt(searchParams.get('page')) || 1
      };
      
      const transactions = await db.transactions.listByItem(id, options);
      return NextResponse.json({ success: true, transactions });
    }
    
    if (action === 'stats') {
      // GET /api/items?id=123&action=stats
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const stats = await db.transactions.getItemStats(id, startDate, endDate);
      return NextResponse.json({ stats });
    }
    
    // GET /api/items?id=123
    const item = await db.items.getById(id);
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, item });
  }

  // GET /api/items?type=chemical&search=water
  const query = {
    type: searchParams.get('type'),
    search: searchParams.get('search') || '',
    netsuiteId: searchParams.get('netsuiteId')
  };

  const items = await db.items.search(query);
  return NextResponse.json({ items });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const action = searchParams.get('action');
  const lotId = searchParams.get('lotId');
  
  if (id && action === 'transactions') {
    // POST /api/items?id=123&action=transactions&lotId=456
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { qty, memo, project, department, batchId, workOrderId } = await request.json();
    const delta = Number(qty);
    
    if (!delta || isNaN(delta)) {
      return NextResponse.json({ error: 'qty must be a non-zero number' }, { status: 400 });
    }
    
    const txnData = {
      txnType: delta > 0 ? 'adjustment' : 'issue',
      lines: [{ item: id, lot: lotId, qty: delta }],
      actor: { _id: user._id, name: user.name, email: user.email },
      memo,
      project,
      department: department || user.department || 'Production',
      batchId,
      workOrderId
    };
    
    const txn = await db.transactions.post(txnData);
    const fresh = await db.items.getById(id);
    return NextResponse.json({ item: fresh, transaction: txn });
  }
  
  // POST /api/items
  const body = await request.json();
  const item = await db.items.create(body);
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  
  const data = await request.json();
  const updated = await db.items.update(id, data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, item: updated });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const lotId = searchParams.get('lotId');
  const action = searchParams.get('action');
  
  const user = await getAuthUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (id && lotId && action === 'lot') {
    // DELETE /api/items?id=123&lotId=456&action=lot
    const deleted = await db.items.deleteLot(id, lotId);
    return NextResponse.json({
      success: true,
      message: `Lot ${deleted.lotNumber} deleted successfully`
    });
  }

  if (id) {
    // DELETE /api/items?id=123
    const body = await request.json().catch(() => ({}));
    const forceDelete = body.force === true;

    await db.items.delete(id, forceDelete);
    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  }

  return NextResponse.json({ error: 'Invalid delete request' }, { status: 400 });
}