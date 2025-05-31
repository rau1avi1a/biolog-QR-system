// api/transactions/[id]/reverse/route.js - Reverse a transaction with proper auth
import { NextResponse } from "next/server";
import { txnService } from "@/services/txn.service";
import { jwtVerify } from 'jose';
import User from '@/models/User';
import connectMongoDB from '@/lib/index';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      throw new Error('No authentication token provided');
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
      throw new Error('User not found');
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { reason } = await request.json();
    
    if (!reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Reason is required for transaction reversal' },
        { status: 400 }
      );
    }
    
    // Get current authenticated user
    let actor;
    try {
      actor = await getUserFromRequest(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 401 }
      );
    }

    // Check if user has permission to reverse transactions (optional - you might want only admins)
    if (actor.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required to reverse transactions' },
        { status: 403 }
      );
    }
    
    const reversalTxn = await txnService.reverse(id, actor, reason.trim());
    
    return NextResponse.json({ 
      success: true, 
      message: "Transaction reversed successfully",
      reversalTransaction: {
        id: reversalTxn._id,
        txnType: reversalTxn.txnType,
        postedAt: reversalTxn.postedAt,
        memo: reversalTxn.memo,
        reversedBy: actor.name
      }
    });
  } catch (error) {
    console.error('Transaction reversal error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to reverse transaction' 
      },
      { status: 500 }
    );
  }
}