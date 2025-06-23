// app/api/netsuite/workorder/route.js - NetSuite Work Order API
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/lib/index';
import User from '@/models/User';
import Batch from '@/models/Batch';
import { createWorkOrderService } from '@/services/netsuite/workorder.service.js';

export const dynamic = 'force-dynamic';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    await connectMongoDB();
    const user = await User.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.hasNetSuiteAccess()) {
      throw new Error('NetSuite access not configured');
    }

    return user;

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Create a new work order
 * POST /api/netsuite/workorder
 */
export async function POST(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    const body = await request.json();
    const { 
      batchId, 
      assemblyItemId, 
      quantity, 
      startDate, 
      endDate,
      location,
      subsidiary 
    } = body;

    // Validate required fields
    if (!quantity || quantity <= 0) {
      return NextResponse.json({
        success: false,
        message: 'Quantity is required and must be greater than 0'
      }, { status: 400 });
    }

    const workOrderService = createWorkOrderService(user);
    let result;

    if (batchId) {
      // Create work order from batch (most common use case)
      await connectMongoDB();
      
      const batch = await Batch.findById(batchId)
        .populate('fileId', 'fileName')
        .populate('snapshot.solutionRef', 'displayName sku netsuiteInternalId')
        .lean();
        
      if (!batch) {
        return NextResponse.json({
          success: false,
          message: 'Batch not found'
        }, { status: 404 });
      }

      result = await workOrderService.createWorkOrderFromBatch(batch, quantity, {
        startDate,
        endDate,
        location,
        subsidiary
      });

      // Update the batch with work order information
      await Batch.findByIdAndUpdate(batchId, {
        workOrderId: result.workOrder.tranId || result.workOrder.id,
        workOrderCreated: true,
        workOrderCreatedAt: new Date(),
        netsuiteWorkOrderData: {
          workOrderId: result.workOrder.id,
          tranId: result.workOrder.tranId,
          bomId: result.workOrder.bomId,
          revisionId: result.workOrder.revisionId,
          quantity: quantity,
          status: result.workOrder.status,
          createdAt: new Date()
        }
      });

    } else if (assemblyItemId) {
      // Create work order directly from assembly item ID
      result = await workOrderService.createWorkOrder({
        assemblyItemId,
        quantity,
        startDate,
        endDate,
        location,
        subsidiary
      });

    } else {
      return NextResponse.json({
        success: false,
        message: 'Either batchId or assemblyItemId is required'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Work order created successfully',
      data: result
    });

  } catch (error) {
    console.error('NetSuite work order creation error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to create work order'
    }, { status: 500 });
  }
}

/**
 * Get work order status or list work orders
 * GET /api/netsuite/workorder?id=123 (get specific)
 * GET /api/netsuite/workorder?status=inprogress (list with filter)
 */
export async function GET(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('id');
    const status = searchParams.get('status');
    const assemblyItem = searchParams.get('assemblyItem');
    const limit = searchParams.get('limit');
    
    const workOrderService = createWorkOrderService(user);

    if (workOrderId) {
      // Get specific work order
      const workOrder = await workOrderService.getWorkOrderStatus(workOrderId);
      
      return NextResponse.json({
        success: true,
        data: workOrder
      });
      
    } else {
      // List work orders with filters
      const filters = {};
      if (status) filters.status = status;
      if (assemblyItem) filters.assemblyItem = assemblyItem;
      if (limit) filters.limit = parseInt(limit);
      
      const workOrders = await workOrderService.listWorkOrders(filters);
      
      return NextResponse.json({
        success: true,
        data: workOrders
      });
    }

  } catch (error) {
    console.error('NetSuite work order fetch error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch work order(s)'
    }, { status: 500 });
  }
}

/**
 * Update work order (complete, cancel, etc.)
 * PATCH /api/netsuite/workorder
 */
export async function PATCH(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    const body = await request.json();
    const { workOrderId, action, quantityCompleted } = body;

    if (!workOrderId) {
      return NextResponse.json({
        success: false,
        message: 'Work order ID is required'
      }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({
        success: false,
        message: 'Action is required (complete, cancel)'
      }, { status: 400 });
    }

    const workOrderService = createWorkOrderService(user);
    let result;

    switch (action) {
      case 'complete':
        result = await workOrderService.completeWorkOrder(workOrderId, quantityCompleted);
        
        // Update any associated batches
        await connectMongoDB();
        await Batch.updateMany(
          { 'netsuiteWorkOrderData.workOrderId': workOrderId },
          { 
            'netsuiteWorkOrderData.status': 'built',
            'netsuiteWorkOrderData.completedAt': new Date(),
            workOrderStatus: 'completed'
          }
        );
        break;
        
      case 'cancel':
        result = await workOrderService.cancelWorkOrder(workOrderId);
        
        // Update any associated batches
        await connectMongoDB();
        await Batch.updateMany(
          { 'netsuiteWorkOrderData.workOrderId': workOrderId },
          { 
            'netsuiteWorkOrderData.status': 'cancelled',
            'netsuiteWorkOrderData.cancelledAt': new Date(),
            workOrderStatus: 'cancelled'
          }
        );
        break;
        
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Supported actions: complete, cancel'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Work order ${action}d successfully`,
      data: result
    });

  } catch (error) {
    console.error('NetSuite work order update error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to update work order'
    }, { status: 500 });
  }
}