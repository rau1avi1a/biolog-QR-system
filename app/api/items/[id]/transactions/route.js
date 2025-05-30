// api/items/[id]/transactions/route.js
import { NextResponse } from "next/server";
import { txnService } from "@/services/txn.service";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const options = {
      txnType: searchParams.get('type'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: parseInt(searchParams.get('limit')) || 100,
      page: parseInt(searchParams.get('page')) || 1
    };
    
    const txns = await txnService.listByItem(id, options);
    
    return NextResponse.json({
      success: true,
      transactions: txns.map((t) => ({
        id: t._id.toString(),
        txnType: t.txnType,
        postedAt: t.postedAt,
        effectiveDate: t.effectiveDate,
        memo: t.memo,
        project: t.project,
        department: t.department,
        reason: t.reason,
        status: t.status,
        totalValue: t.totalValue,
        batchId: t.batchId,
        workOrderId: t.workOrderId,
        createdBy: t.createdBy,
        validated: t.validated,
        validatedBy: t.validatedBy,
        lines: t.lines
                 .filter(l => {
                     // if l.item is populated, use its _id; otherwise it's already an ObjectId
                     const lineItemId = l.item._id 
                       ? l.item._id.toString() 
                       : l.item.toString();
                     return lineItemId === id;
                   })
                   .map(l => ({
                     // always return the string _id
                     item:            l.item._id 
                                       ? l.item._id.toString() 
                                       : l.item.toString(),            item: l.item,
            lot: l.lot,
            qty: l.qty,
            unitCost: l.unitCost,
            totalValue: l.totalValue,
            lotQtyBefore: l.lotQtyBefore,
            lotQtyAfter: l.lotQtyAfter,
            itemQtyBefore: l.itemQtyBefore,
            itemQtyAfter: l.itemQtyAfter,
            notes: l.notes
          }))
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}