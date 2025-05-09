// app/api/items/[id]/lots/[lotId]/transactions/route.js
import { NextResponse }    from "next/server";
import connectMongoDB      from "@/lib/index";
import { txnService }      from "@/services/txn.service";
import { Item }            from "@/models/Item";
import { basicAuth }       from "@/lib/auth";

export const dynamic = "force-dynamic";

/* POST  /api/items/:id/lots/:lotId/transactions */
export async function POST(req, { params }) {
  await connectMongoDB();

  // ⚠️ await the async params before destructuring
  const { id, lotId } = await params;
  const { qty, memo, project, department } = await req.json();

  const delta = Number(qty);
  if (!delta || isNaN(delta)) {
    return NextResponse.json({ error: "qty must be a non-zero number" }, { status: 400 });
  }

  const item = await Item.findById(id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Authenticate
  const user = await basicAuth("/login");
  const actor = { _id: user._id, name: user.name, email: user.email };

  const txnType = delta > 0 ? "adjustment" : "issue";

  // Write the inventory transaction
  const txn = await txnService.post({
    txnType,
    lines     : [{ item: id, lot: lotId, qty: delta }],
    actor,
    memo,
    project,
    department
  });

  // Return fresh item record so front-end can update lots & qtyOnHand
  const fresh = await Item.findById(id).lean();
  return NextResponse.json({ item: fresh, transaction: txn });
}
