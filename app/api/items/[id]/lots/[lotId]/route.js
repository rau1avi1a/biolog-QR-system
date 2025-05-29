// app/api/items/[id]/lots/[lotId]/route.js
import { NextResponse } from "next/server";
import connectMongoDB  from "@/lib/index";
import { Item }        from "@/models/Item";

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

    await connectMongoDB();
    const item = await Item.findById(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item not found" },
        { status: 404 }
      );
    }

    item.Lots = (item.Lots || []).filter(l => l._id.toString() !== lotId);
    if (item.lotTracked) {
      item.qtyOnHand = item.Lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
    }
    await item.save();

    return NextResponse.json({
      success: true,
      item: {
        id: item._id.toString(),
        sku: item.sku,
        displayName: item.displayName,
        qtyOnHand: item.qtyOnHand,
        lots: item.Lots.map(l => ({
          lotNumber: l.lotNumber,
          quantity:  l.quantity
        }))
      }
    });
  } catch (err) {
    console.error("DELETE /api/items/[id]/lots/[lotId] error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
