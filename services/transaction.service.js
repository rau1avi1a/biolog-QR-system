// services/transaction.service.js  (wrapper around InventoryTxn)
import { InventoryTxn } from "@/models/InventoryTxn";
import ChemicalAudit    from "@/models/ChemicalAudit";

export async function postTxn({ txnType, refDoc, lines, actor, memo, project }) {
  /* 1. write InventoryTxn */
  const txn = await InventoryTxn.create({
    txnType, refDoc, lines, memo,
    createdBy: actor?._id        // we'll add this field below
  });

  /* 2. mirror to ChemicalAudit for each chemical line */
  for (const ln of lines) {
    const item = await Item.findById(ln.item).lean();
    if (item.itemType !== 'chemical') continue;

    const lotInfo = item.Lots?.find(l => l.LotNumber === ln.lot) ?? {};
    await ChemicalAudit.logUsage({
      chemical: item,
      lotNumber: lotInfo.LotNumber ?? 'N/A',
      quantityUsed: txnType === 'receipt' ? -ln.qty : ln.qty,
      quantityRemaining: (lotInfo.Quantity ?? item.qtyOnHand) - ln.qty,
      user: actor,
      notes: memo,
      project
    });
  }
  return txn.toObject();
}
