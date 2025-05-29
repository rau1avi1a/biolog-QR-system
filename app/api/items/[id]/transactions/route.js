// api/items/[id]/transactions/route.js
import { NextResponse } from "next/server";
import { txnService }   from "@/services/txn.service";

export const dynamic = "force-dynamic";

/* GET  /api/items/:id/transactions */
export async function GET(_, { params }) {
  const { id } = await params;
  const txns = await txnService.listByItem(id);

  return NextResponse.json({
    transactions: txns.map((t) => ({
      id:       t._id.toString(),
      txnType:  t.txnType,
      postedAt: t.postedAt,
      memo:     t.memo,
      project:  t.project,
      department: t.department,
      createdBy: t.createdBy,
      lines:    t.lines.map(l => ({
        item: l.item.toString(),
        lot:  l.lot,
        qty:  l.qty
      }))
    }))
  });
}
