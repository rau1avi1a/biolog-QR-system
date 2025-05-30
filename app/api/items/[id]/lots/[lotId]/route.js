// app/api/items/[id]/lots/[lotId]/route.js - Updated DELETE method
import { NextResponse } from "next/server";
import { jwtVerify } from 'jose';
import connectMongoDB  from "@/lib/index";
import { Item }        from "@/models/Item";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id, lotId } = params;
    if (!id || !lotId) {
      return NextResponse.json(
        { success: false, error: "Item ID and Lot ID are required" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const item = await Item.findById(id)
      .select("itemType uom Lots")
      .lean();

    if (!item || item.itemType !== "chemical") {
      return NextResponse.json({ success: true, lots: [] });
    }

    const lot = (item.Lots || []).find(l => l._id.toString() === lotId);
    if (!lot || (lot.quantity || 0) <= 0) {
      return NextResponse.json({ success: true, lots: [] });
    }

    return NextResponse.json({
      success: true,
      lots: [{
        id:           lot._id.toString(),
        lotNumber:    lot.lotNumber,
        availableQty: lot.quantity,
        unit:         item.uom || "ea",
        expiryDate:   lot.expiryDate?.toISOString().slice(0,10) || null
      }]
    });

  } catch (err) {
    console.error("GET /api/items/[id]/lots/[lotId] error:", err);
    return NextResponse.json({ success: true, lots: [] });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, lotId } = params;
    if (!id || !lotId) {
      return NextResponse.json(
        { success: false, error: "Item ID and Lot ID are required" },
        { status: 400 }
      );
    }

    // Get and verify JWT token from cookies
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - No token provided' 
      }, { status: 401 });
    }

    let userPayload;
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.JWT_SECRET)
      );
      userPayload = payload;
    } catch (jwtError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - Invalid token' 
      }, { status: 401 });
    }

    await connectMongoDB();

    // Get fresh user data to verify current role
    const user = await User.findById(userPayload.userId);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - User not found' 
      }, { status: 401 });
    }

    // Check if user is admin - ALWAYS verify server-side
    if (user.role !== 'admin') {
      console.warn(`Non-admin user attempted to delete lot:`, {
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        itemId: id,
        lotId: lotId,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        success: false, 
        error: 'Forbidden - Admin access required' 
      }, { status: 403 });
    }

    const item = await Item.findById(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    // Find the lot before deleting for logging
    const lotToDelete = (item.Lots || []).find(l => l._id.toString() === lotId);
    if (!lotToDelete) {
      return NextResponse.json(
        { success: false, error: "Lot not found" },
        { status: 404 }
      );
    }

    // Store lot info for logging
    const lotInfo = {
      lotNumber: lotToDelete.lotNumber,
      quantity: lotToDelete.quantity
    };

    // Remove the lot and recalculate
    item.Lots = (item.Lots || []).filter(l => l._id.toString() !== lotId);
    if (item.lotTracked) {
      item.qtyOnHand = item.Lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
    }
    await item.save();

    // Log the deletion
    console.log(`Lot deleted by admin ${user.email}:`, {
      lotId: lotId,
      lotNumber: lotInfo.lotNumber,
      quantityRemoved: lotInfo.quantity,
      itemId: item._id,
      itemSku: item.sku,
      itemName: item.displayName,
      newItemTotal: item.qtyOnHand,
      deletedBy: user.email,
      deletedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Lot ${lotInfo.lotNumber} deleted successfully`,
      item: {
        id: item._id.toString(),
        sku: item.sku,
        displayName: item.displayName,
        qtyOnHand: item.qtyOnHand,
        lots: item.Lots.map(l => ({
          id: l._id.toString(),
          lotNumber: l.lotNumber,
          quantity: l.quantity
        }))
      },
      deletedLot: {
        lotNumber: lotInfo.lotNumber,
        quantityRemoved: lotInfo.quantity
      }
    });
  } catch (err) {
    console.error("DELETE /api/items/[id]/lots/[lotId] error:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}