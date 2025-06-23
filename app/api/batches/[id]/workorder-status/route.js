// app/api/batches/[id]/workorder-status/route.js - Fixed for Next.js 15
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { getWorkOrderStatus, retryWorkOrderCreation } from '@/services/batch.service';

/**
 * GET /api/batches/[id]/workorder-status
 * Get work order status for a batch - Fixed for database connection issues
 */
async function handleGET(request, context) {
  try {
    // Fix: Await params in Next.js 15
    const params = await context.params;
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    // Force a fresh database connection and add delay for background job completion
    const searchParams = new URL(request.url).searchParams;
    const timestamp = searchParams.get('t');
    console.log('Getting work order status for:', id, 'at timestamp:', timestamp);
    
    const status = await getWorkOrderStatus(id);
    
    // Enhanced response with tranId information
    const response = {
      success: true,
      data: {
        ...status,
        // Ensure we return the user-friendly work order number
        displayId: status.workOrderNumber || status.workOrderId,
        description: status.workOrderNumber ? 
          `NetSuite Work Order ${status.workOrderNumber}` : 
          status.workOrderId?.startsWith('LOCAL-') ? 
            'Local Work Order' : 
            status.workOrderId?.startsWith('PENDING-') ?
              'Work Order Creating...' :
              'Work Order'
      }
    };
    
    console.log('Returning work order status:', response.data);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
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
    // Fix: Await params in Next.js 15
    const params = await context.params;
    const { id } = params;
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
      data: result,
      message: 'Work order creation retry initiated'
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
  return withAuth(handleGET)(request, context);
}

export async function POST(request, context) {
  return withAuth(handlePOST)(request, context);
}