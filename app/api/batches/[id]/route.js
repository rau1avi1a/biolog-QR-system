// api/batches/[id]/route.js
import { NextResponse } from 'next/server';
import { getBatchById, updateBatch, deleteBatch } from '@/services/batch.service';

export async function GET(request, { params }) {
  try {
    const { id } = await params; // FIXED: await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID required' },
        { status: 400 }
      );
    }
    
    const batch = await getBatchById(id);
    
    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: batch
    });
    
  } catch (error) {
    console.error('GET batch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch batch',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params; // FIXED: await params
    const payload = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID required' },
        { status: 400 }
      );
    }
    
    const batch = await updateBatch(id, payload);
    
    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: batch
    });
    
  } catch (error) {
    console.error('PUT batch error:', error);
    
    if (error.message === 'Batch not found') {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update batch',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params; // FIXED: await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID required' },
        { status: 400 }
      );
    }
    
    const batch = await deleteBatch(id);
    
    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: batch
    });
    
  } catch (error) {
    console.error('DELETE batch error:', error);
    
    if (error.message === 'Batch not found') {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete batch',
        message: error.message 
      },
      { status: 500 }
    );
  }
}