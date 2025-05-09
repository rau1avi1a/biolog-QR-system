// app/api/items/[id]/lots/[lotId]/route.js
import { NextResponse } from "next/server";
import connectMongoDB  from "@/lib/index";
import { Item }        from "@/models/Item";
import { basicAuth }   from "@/lib/auth";

export const dynamic = "force-dynamic";

/* DELETE  /api/items/:id/lots/:lotId */
export async function DELETE(_, { params }) {
    const { id, lotId } = await params;     // matches your folder
    const item = await Item.findById(id);
    if (!item) return NextResponse.json({ error:"Not found" }, { status:404 });
  
    item.Lots = (item.Lots||[]).filter(l => l.LotNumber !== lotId);
    if (item.lotTracked) {
      item.qtyOnHand = item.Lots.reduce((s,l) => s + l.Quantity, 0);
    }
    await item.save();
  
    return NextResponse.json({ item: {
      id:          item._id.toString(),
      sku:         item.sku,
      displayName: item.displayName,
      casNumber:   item.casNumber,
      location:    item.location,
      qtyOnHand:   item.qtyOnHand,
      lots:        item.Lots.map(l => ({
                     LotNumber: l.LotNumber, Quantity: l.Quantity
                   }))
    }});
  }
  