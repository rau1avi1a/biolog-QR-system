// =============================================================================
// app/api/batches/route.js - Complete batches operations (FIXED)
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
    
    await db.connect();
    const user = await db.models.User.findById(payload.userId).select('-password');
    
    return user ? { 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    } : null;
  } catch (error) {
    console.error('Auth error in batches route:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    // Ensure connection
    await db.connect();

    if (id) {
      if (action === 'workorder-status') {
        // GET /api/batches?id=123&action=workorder-status
        const status = await db.services.batchService.getWorkOrderStatus(id);
        
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
      
      // GET /api/batches?id=123
      const batch = await db.services.batchService.getBatchById(id);
      if (!batch) {
        return NextResponse.json({ 
          success: false, 
          error: 'Batch not found' 
        }, { status: 404 });
      }
      
      return NextResponse.json({ success: true, data: batch });
    }

    // GET /api/batches?status=Review&fileId=123
    const filter = {};
    const status = searchParams.get('status');
    const fileId = searchParams.get('fileId');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const skip = parseInt(searchParams.get('skip')) || 0;
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;
    
    if (status) filter.status = status;
    if (fileId) filter.fileId = fileId;

    const batches = await db.services.batchService.listBatches({ 
      filter,
      limit,
      skip,
      sort: { [sort]: order }
    });
    
    return NextResponse.json({ success: true, data: batches });
    
  } catch (error) {
    console.error('GET batches error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.connect();

    if (id && action === 'workorder-retry') {
      // POST /api/batches?id=123&action=workorder-retry
      const { quantity } = await request.json();
      
      if (!quantity || quantity <= 0) {
        return NextResponse.json({ 
          error: 'Valid quantity required' 
        }, { status: 400 });
      }

      const result = await db.services.batchService.retryWorkOrderCreation(id, quantity, user._id);
      
      return NextResponse.json({
        success: true,
        data: result,
        message: 'Work order creation retry initiated'
      });
    }

    // POST /api/batches - Create new batch
    const payload = await request.json();
    payload.user = user;

    const fileId = payload.originalFileId || payload.fileId;
    if (!fileId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing fileId or originalFileId' 
      }, { status: 400 });
    }

    // Validate that the file exists
    const file = await db.services.fileService.getFileById(fileId);
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'File not found' 
      }, { status: 404 });
    }

    const batch = await db.services.batchService.createBatch(payload);
    
    return NextResponse.json({ 
      success: true, 
      data: batch,
      message: 'Batch created successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('POST batches error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.connect();

    // Check if batch exists
    const existingBatch = await db.services.batchService.getBatchById(id);
    if (!existingBatch) {
      return NextResponse.json({ 
        success: false, 
        error: 'Batch not found' 
      }, { status: 404 });
    }

    const payload = await request.json();
    payload.user = user;

    const batch = await db.services.batchService.updateBatch(id, payload);
    
    return NextResponse.json({ 
      success: true, 
      data: batch,
      message: 'Batch updated successfully'
    });
    
  } catch (error) {
    console.error('PATCH batches error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
    }

    // Get authenticated user and check permissions
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins or the creator to delete batches
    if (user.role !== 'admin') {
      await db.connect();
      const existingBatch = await db.services.batchService.getBatchById(id);
      if (!existingBatch) {
        return NextResponse.json({ 
          success: false, 
          error: 'Batch not found' 
        }, { status: 404 });
      }
      
      if (existingBatch.createdBy?.toString() !== user._id.toString()) {
        return NextResponse.json({ 
          error: 'Permission denied - you can only delete your own batches' 
        }, { status: 403 });
      }
    }

    const batch = await db.services.batchService.deleteBatch(id);
    
    return NextResponse.json({ 
      success: true, 
      data: batch,
      message: 'Batch deleted successfully'
    });
    
  } catch (error) {
    console.error('DELETE batches error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}