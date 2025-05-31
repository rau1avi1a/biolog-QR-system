// api/batches/[id]/route.js
import { NextResponse } from 'next/server';
import { getBatchById, updateBatch, deleteBatch } from '@/services/batch.service';
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

    // Get user information from the request
    const user = await getUserFromRequest(request);
    
    // Add user to payload for proper transaction attribution
    payload.user = user;
    
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
    console.error('PATCH batch error:', error);
    
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