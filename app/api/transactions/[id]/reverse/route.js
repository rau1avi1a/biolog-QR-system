// api/transactions/[id]/reverse/route.js - Reverse a transaction
import { NextResponse } from "next/server";
import { txnService } from "@/services/txn.service";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { reason } = await request.json();
    
    // Get current user (you'll need to implement this based on your auth)
    const actor = { _id: "current_user_id", name: "Current User", email: "user@example.com" };
    
    const reversalTxn = await txnService.reverse(id, actor, reason);
    
    return NextResponse.json({ 
      success: true, 
      message: "Transaction reversed successfully",
      reversalTransaction: reversalTxn
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}