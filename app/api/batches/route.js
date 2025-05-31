import { NextRequest, NextResponse } from 'next/server';
import { createBatch, listBatches } from '@/services/batch.service';
import { jwtVerify } from 'jose';
import User from '@/models/User';
import connectMongoDB from '@/lib/index';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return null; // No token, will use system user
    }

    // Verify the JWT token
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    await connectMongoDB();

    // Get fresh user data from database
    const user = await User.findById(payload.userId).select('-password').lean();
    
    if (!user) {
      return null; // User not found, will use system user
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

  } catch (error) {
    console.warn('Failed to get user from token:', error.message);
    return null; // Token invalid, will use system user
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();

    // Get user information from the request
    const user = await getUserFromRequest(request);

    // Basic validation
    const fileId = payload.originalFileId || payload.fileId;
    if (!fileId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing fileId' 
        },
        { status: 400 }
      );
    }

    // Add user to payload
    payload.user = user;

    // Handle different types of batch creation
    if (payload.originalFileId && payload.editorData) {
      // This is a save from the editor with confirmation data
      const { originalFileId, editorData, action, confirmationData } = payload;
      
      const batchPayload = {
        originalFileId,
        editorData,
        action,
        confirmationData,
        user, // Pass user to service
        status: getStatusFromAction(action),
        // Set flags based on action
        chemicalsTransacted: shouldTransactChemicals(action),
        solutionCreated: shouldCreateSolution(action),
        workOrderCreated: shouldCreateWorkOrder(action)
      };

      const batch = await createBatch(batchPayload);
      
      return NextResponse.json({
        success: true,
        data: batch
      }, { status: 201 });
    } else {
      // Regular batch creation
      const batch = await createBatch(payload);
      return NextResponse.json({
        success: true,
        data: batch
      }, { status: 201 });
    }
  } catch (error) {    
    console.error('Batch creation error:', error);
    
    if (error.message === 'File not found') {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create batch',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const fileId = searchParams.get('fileId');

    const filter = {};
    if (status) filter.status = status;
    if (fileId) filter.fileId = fileId;

    const batches = await listBatches({ filter });

    return NextResponse.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Batch list error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch batches' 
      },
      { status: 500 }
    );
  }
}

// Helper functions to determine what should happen based on action
function getStatusFromAction(action) {
  switch (action) {
    case 'save': return 'In Progress';
    case 'create_work_order': return 'In Progress';
    case 'submit_review': return 'Review';
    case 'complete': return 'Completed';
    case 'reject': return 'In Progress';
    default: return 'In Progress';
  }
}

function shouldTransactChemicals(action) {
  return action === 'submit_review'; // Only transact chemicals when submitting for review
}

function shouldCreateSolution(action) {
  return action === 'submit_review'; // Only create solution when submitting for review
}

function shouldCreateWorkOrder(action) {
  return action === 'create_work_order'; // Only create work order when specifically requested
}