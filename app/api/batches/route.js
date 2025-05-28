import { NextRequest, NextResponse } from 'next/server';
import { createBatch, listBatches } from '@/services/batch.service';

export async function POST(request) {
  try {
    const payload = await request.json();
    console.log('POST /api/batches - payload:', JSON.stringify(payload, null, 2));

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

    // Handle different types of batch creation
    if (payload.originalFileId && payload.editorData) {
      // This is a save from the editor with confirmation data
      const { originalFileId, editorData, action, confirmationData } = payload;
      
      const batchPayload = {
        originalFileId,
        editorData,
        action,
        confirmationData,
        status: getStatusFromAction(action),
        // Set flags based on action
        chemicalsTransacted: shouldTransactChemicals(action),
        solutionCreated: shouldCreateSolution(action),
        workOrderCreated: shouldCreateWorkOrder(action)
      };

      console.log('Creating batch with payload:', batchPayload);
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
    console.error('POST /api/batches error:', error);
    
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

    console.log('GET /api/batches - params:', { status, fileId });

    const filter = {};
    if (status) filter.status = status;
    if (fileId) filter.fileId = fileId;

    const batches = await listBatches({ filter });

    return NextResponse.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('GET /api/batches error:', error);
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