// app/api/items/[id]/lots/route.js
import { NextResponse } from "next/server";
import connectMongoDB  from "@/lib/index";
import { Item }        from "@/models/Item";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Item ID is required" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const item = await Item.findById(id)
      .select("itemType uom Lots")
      .lean();

    // not a chemical or not found → return empty array (200)
    if (!item || item.itemType !== "chemical") {
      return NextResponse.json({ success: true, lots: [] });
    }

    // only lots with quantity > 0
    const lots = (item.Lots || [])
      .filter(l => (l.quantity || 0) > 0)
      .map(l => ({
        id:           l._id.toString(),
        lotNumber:    l.lotNumber,
        availableQty: l.quantity,
        unit:         item.uom || "ea",
        expiryDate:   l.expiryDate?.toISOString().slice(0,10) || null
      }));

    return NextResponse.json({ success: true, lots });

  } catch (err) {
    console.error("GET /api/items/[id]/lots error:", err);
    // always return 200 with empty lots so front-end never sees a non-OK
    return NextResponse.json({ success: true, lots: [] });
  }
}
