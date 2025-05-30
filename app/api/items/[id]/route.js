// app/api/items/[id]/route.js - Updated DELETE method for custom auth
import { NextResponse } from "next/server";
import { jwtVerify } from 'jose';
import connectMongoDB  from "@/lib/index";
import { Item }        from "@/models/Item";
import User from "@/models/User";
import { basicAuth }   from "@/lib/auth";

export const dynamic = "force-dynamic";

/* GET /api/items/:id */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const txn = await txnService.getById(id);
    
    if (!txn) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, transaction: txn });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/* PATCH /api/items/:id */
export async function PATCH(req, { params }) {
  await connectMongoDB();

  // optional auth
  await basicAuth("/login");

  const { id } = await params;
  const data  = await req.json();

  // pick only the fields you allow editing
  const allowed = ["displayName", "casNumber", "location"];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }

  const updated = await Item.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, lean: true }
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item: updated });
}

/* DELETE /api/items/:id */
export async function DELETE(request, { params }) {
  try {
    await connectMongoDB();

    // Get and verify JWT token from cookies
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    let userPayload;
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.JWT_SECRET)
      );
      userPayload = payload;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Get fresh user data to verify current role
    const user = await User.findById(userPayload.userId);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not found' }, { status: 401 });
    }

    // Check if user is admin - ALWAYS verify server-side
    if (user.role !== 'admin') {
      // Log potential security attempt
      console.warn(`Non-admin user attempted to delete item:`, {
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        itemId: params.id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Parse request body to check for force delete
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body is optional for backwards compatibility
    }

    const forceDelete = body.force === true;

    // Find the item first to get details for logging
    const item = await Item.findById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if item has any active stock or lots
    if (item.qtyOnHand > 0 && !forceDelete) {
      return NextResponse.json({ 
        error: 'Cannot delete item with active stock. Please adjust quantity to zero first or use force delete.' 
      }, { status: 400 });
    }

    // If force delete, log the stock that will be removed
    if (forceDelete && item.qtyOnHand > 0) {
      console.log(`Force deleting item with stock:`, {
        itemId: item._id,
        sku: item.sku,
        displayName: item.displayName,
        qtyOnHand: item.qtyOnHand,
        totalLots: item.Lots ? item.Lots.length : 0,
        deletedBy: user.email,
        timestamp: new Date().toISOString()
      });
    }

    // Delete the item (this will also remove all embedded lots)
    await Item.findByIdAndDelete(id);

    const successMessage = forceDelete && item.qtyOnHand > 0 
      ? `Item and all stock (${item.qtyOnHand} ${item.uom}) deleted successfully`
      : 'Item deleted successfully';

    console.log(`Item deleted by admin ${user.email}:`, {
      id: item._id,
      sku: item.sku,
      displayName: item.displayName,
      itemType: item.itemType,
      qtyRemoved: item.qtyOnHand,
      forceDelete: forceDelete,
      deletedBy: user.email,
      deletedAt: new Date().toISOString()
    });

    return NextResponse.json({ 
      message: successMessage,
      deletedItem: {
        id: item._id,
        sku: item.sku,
        displayName: item.displayName,
        qtyRemoved: item.qtyOnHand
      }
    });

  } catch (error) {
    console.error('Delete item error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete item: ' + error.message 
    }, { status: 500 });
  }
}
