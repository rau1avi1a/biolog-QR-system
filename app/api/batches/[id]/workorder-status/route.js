// app/api/batches/[id]/workorder-status/route.js - Work Order Status API
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getWorkOrderStatus, retryWorkOrderCreation } from '@/services/batch.service';

/**
 * GET /api/batches/[id]/workorder-status
 * Get work order status for a batch
 */
async function handleGET(request, context) {
  try {
    const { id } = context.params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    const status = await getWorkOrderStatus(id);
    
    return NextResponse.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting work order status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/batches/[id]/workorder-status
 * Retry work order creation for a failed batch
 */
async function handlePOST(request, context) {
  try {
    const { id } = context.params;
    const body = await request.json();
    const { quantity } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid quantity is required' },
        { status: 400 }
      );
    }

    const result = await retryWorkOrderCreation(id, quantity, context.user._id);
    
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error retrying work order creation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request, context) {
    // withAuth returns a handler you can invoke
    return withAuth(handleGET)(request, context);
  }
  
  export async function POST(request, context) {
    return withAuth(handlePOST)(request, context);
  }
  