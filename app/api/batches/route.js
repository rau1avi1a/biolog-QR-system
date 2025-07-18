// app/api/batches/route.js - FIXED: Consistent wrapped list responses with metadata
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to get authenticated user
async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    
      const { default: db } = await import('@/db');
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
      const { default: db } = await import('@/db');
  await db.connect();

    if (id) {
    if (id && action === 'assemblybuild-status') {
      try {
        console.log('🔍 Assembly build status check for batch:', id);
        
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Batch ID is required' },
            { status: 400 }
          );
        }

        // FIXED: Use the batch service method instead of async service
        const statusResult = await db.services.batchService.getAssemblyBuildStatus(id);
        
        if (statusResult.error) {
          console.error('❌ Assembly build status error:', statusResult.error);
          return NextResponse.json(
            { success: false, error: statusResult.error },
            { status: 404 }
          );
        }

        console.log('📊 Assembly build status result:', statusResult);

        const response = NextResponse.json({
          success: true,
          data: statusResult
        });

        // Prevent caching
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');

        return response;

      } catch (error) {
        console.error('💥 Assembly build status check failed:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

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
          },
          error: null
        }, {
          headers: { 'Cache-Control': 'no-cache' }
        });
      }
      
      // GET /api/batches?id=123
      const batch = await db.services.batchService.getBatchById(id);
      if (!batch) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'Batch not found'
        }, { status: 404 });
      }
      
      // Ensure fileName is available for display
      const enrichedBatch = {
        ...batch,
        fileName: batch.fileName || 
                 (batch.fileId?.fileName ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : null) ||
                 `Batch Run ${batch.runNumber}`
      };
      
      return NextResponse.json({ 
        success: true, 
        data: enrichedBatch,
        error: null
      });
    }

    // List batches with various filters: GET /api/batches?status=Review&fileId=123
    const filter = {};
    const status = searchParams.get('status');
    const fileId = searchParams.get('fileId');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const skip = parseInt(searchParams.get('skip')) || 0;
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;
    
    // Build filter object
    if (status) filter.status = status;
    if (fileId) filter.fileId = fileId;

    // Query options
    const queryOptions = {
      filter,
      limit,
      skip,
      sort: { [sort]: order }
    };

    const batches = await db.services.batchService.listBatches(queryOptions);
    
    // Enrich batches with fileName for display
    const enrichedBatches = batches.map(batch => ({
      ...batch,
      fileName: batch.fileName || 
               (batch.fileId?.fileName ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : null) ||
               `Batch Run ${batch.runNumber}`
    }));
    
    // Build query info for transparency
    const query = {
      filter: {
        status: status || null,
        fileId: fileId || null
      },
      pagination: {
        limit,
        skip,
        sort,
        order: order === 1 ? 'asc' : 'desc'
      }
    };

    // Get total count for this filter (if needed for pagination)
    let totalCount = enrichedBatches.length;
    if (skip > 0 || enrichedBatches.length === limit) {
      // If we're paginating or hit the limit, get actual total count
      try {
        totalCount = await db.services.batchService.countBatches?.(filter) || enrichedBatches.length;
      } catch (error) {
        // Fallback if countBatches doesn't exist
        console.warn('countBatches method not available, using returned count');
        totalCount = enrichedBatches.length;
      }
    }

    // Build response with metadata
    const responseData = {
      batches: enrichedBatches,
      count: enrichedBatches.length,
      totalCount: totalCount,
      query,
      pagination: {
        limit,
        skip,
        hasMore: enrichedBatches.length === limit,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      }
    };

    // Add context info based on filters
    if (status) {
      responseData.statusFilter = {
        status,
        description: `Batches with status: ${status}`
      };
    }

    if (fileId) {
      // Try to get file info for context
      try {
        const file = await db.services.fileService.getFileById(fileId);
        responseData.fileContext = {
          fileId,
          fileName: file?.fileName || 'Unknown File',
          description: `Batches for file: ${file?.fileName || fileId}`
        };
      } catch (error) {
        responseData.fileContext = {
          fileId,
          fileName: 'Unknown File',
          description: `Batches for file: ${fileId}`
        };
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: responseData,
      error: null
    });
    
  } catch (error) {
    console.error('GET batches error:', error);
    
    // Return consistent error structure
    return NextResponse.json({ 
      success: false, 
      data: {
        batches: [],
        count: 0,
        totalCount: 0,
        query: {
          filter: {
            status: searchParams.get('status') || null,
            fileId: searchParams.get('fileId') || null
          },
          pagination: {
            limit: parseInt(searchParams.get('limit')) || 50,
            skip: parseInt(searchParams.get('skip')) || 0
          }
        }
      },
      error: 'Internal server error: ' + error.message
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
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

      const { default: db } = await import('@/db');
  await db.connect();

    if (id && action === 'workorder-retry') {
      // POST /api/batches?id=123&action=workorder-retry
      const { quantity } = await request.json();
      
      if (!quantity || quantity <= 0) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: 'Valid quantity required'
        }, { status: 400 });
      }

      const result = await db.services.batchService.retryWorkOrderCreation(id, quantity, user._id);
      
      return NextResponse.json({
        success: true,
        data: result,
        error: null,
        message: 'Work order creation retry initiated'
      });
    }

    // POST /api/batches - Create new batch
    const payload = await request.json();
    
    console.log('📥 Received batch creation payload:', {
      hasOriginalFileId: !!payload.originalFileId,
      hasFileId: !!payload.fileId,
      originalFileId: payload.originalFileId,
      fileId: payload.fileId,
      status: payload.status,
      workOrderStatus: payload.workOrderStatus
    });
    
    payload.user = user;

    // FIXED: Extract fileId and ensure it's set in the payload
    const fileId = payload.originalFileId || payload.fileId;
    if (!fileId) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'Missing fileId or originalFileId'
      }, { status: 400 });
    }

    // Validate that the file exists
    const file = await db.services.fileService.getFileById(fileId);
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'File not found'
      }, { status: 404 });
    }

    // FIXED: Ensure fileId is set in the payload for the batch service
    payload.fileId = fileId;
    
    // Remove originalFileId to avoid confusion
    delete payload.originalFileId;
    
    console.log('📤 Sending to batch service:', {
      fileId: payload.fileId,
      hasFileId: !!payload.fileId,
      status: payload.status,
      workOrderStatus: payload.workOrderStatus
    });

    const batch = await db.services.batchService.createBatch(payload);
    
    // Enrich with fileName for display
    const enrichedBatch = {
      ...batch,
      fileName: batch.fileName || 
               (file.fileName ? `${file.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : null) ||
               `Batch Run ${batch.runNumber}`
    };
    
    return NextResponse.json({ 
      success: true, 
      data: enrichedBatch,
      error: null,
      message: 'Batch created successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('POST batches error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Batch ID required'
      }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

      const { default: db } = await import('@/db');
  await db.connect();

    // Check if batch exists
    const existingBatch = await db.services.batchService.getBatchById(id);
    if (!existingBatch) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'Batch not found'
      }, { status: 404 });
    }

    const payload = await request.json();
    payload.user = user;

    const batch = await db.services.batchService.updateBatch(id, payload);
    
    // Enrich with fileName for display
    const enrichedBatch = {
      ...batch,
      fileName: batch.fileName || 
               (batch.fileId?.fileName ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : null) ||
               `Batch Run ${batch.runNumber}`
    };
    
    return NextResponse.json({ 
      success: true, 
      data: enrichedBatch,
      error: null,
      message: 'Batch updated successfully'
    });
    
  } catch (error) {
    console.error('PATCH batches error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Batch ID required'
      }, { status: 400 });
    }

    // Get authenticated user and check permissions
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // Only allow admins or the creator to delete batches
    if (user.role !== 'admin') {
        const { default: db } = await import('@/db');
  await db.connect();
      const existingBatch = await db.services.batchService.getBatchById(id);
      if (!existingBatch) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'Batch not found'
        }, { status: 404 });
      }
      
      if (existingBatch.createdBy?.toString() !== user._id.toString()) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: 'Permission denied - you can only delete your own batches'
        }, { status: 403 });
      }
    }

    const batch = await db.services.batchService.deleteBatch(id);
    
    return NextResponse.json({ 
      success: true, 
      data: batch,
      error: null,
      message: 'Batch deleted successfully'
    });
    
  } catch (error) {
    console.error('DELETE batches error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}