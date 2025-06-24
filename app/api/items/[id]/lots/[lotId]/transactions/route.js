// app/api/items/[id]/lots/[lotId]/transactions/route.js
import { NextResponse } from "next/server";
import connectMongoDB   from "@/db/index";
import { txnService }   from "@/db/services/app/txn.service";
import { Item }         from "@/db/schemas/Item";
import { basicAuth }    from "@/db/lib/auth";

export const dynamic = "force-dynamic";

// GET  /api/items/:id/lots/:lotId/transactions
export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id, lotId } = await params;                  // must await before destructuring
    const transactions   = await txnService.getLotHistory(id, lotId);
    return NextResponse.json({ success: true, transactions });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/items/:id/lots/:lotId/transactions
export async function POST(req, { params }) {
  await connectMongoDB();
  const { id, lotId } = await params;

  // authenticate first so we know the user’s department
  const user  = await basicAuth("/login");
  const actor = { _id: user._id, name: user.name, email: user.email };

  // pull everything out of the JSON body
  const {
    qty,
    memo,
    project,
    department: deptFromBody,
    batchId,
    workOrderId
  } = await req.json();

  // default department if none provided
  const department = deptFromBody || user.department || "Production";

  // validate qty
  const delta = Number(qty);
  if (!delta || isNaN(delta)) {
    return NextResponse.json({ error: "qty must be a non-zero number" }, { status: 400 });
  }

  // ensure item exists
  const item = await Item.findById(id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const txnType = delta > 0 ? "adjustment" : "issue";

  // create the transaction, passing along batchId & workOrderId
  const txn = await txnService.post({
    txnType,
    lines:       [{ item: id, lot: lotId, qty: delta }],
    actor,
    memo,
    project,
    department,
    batchId,
    workOrderId
  });

  // return updated item for the UI
  const fresh = await Item.findById(id).lean();
  return NextResponse.json({ item: fresh, transaction: txn });
}
