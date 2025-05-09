// services/txn.service.js
import connectMongoDB from "@/lib/index";
import { Item }       from "@/models/Item";
import {InventoryTxn}   from "@/models/InventoryTxn";

export const txnService = {
  post: async ({ txnType, lines, actor, memo, project, department }) => {
    await connectMongoDB();

    // 1️⃣ write the transaction record
    const txn = await InventoryTxn.create({
      txnType,
      lines,
      createdBy: actor,
      memo,
      project,
      department
    });

    // 2️⃣ apply to each line
    for (const { item: itemId, lot: lotNumber, qty } of lines) {
      const doc = await Item.findById(itemId);
      if (!doc) continue;

      // Make sure this item is lot‐tracked
      doc.lotTracked = true;
      doc.Lots = doc.Lots || [];

      // Find or add the lot
      let lot = doc.Lots.find((l) => l.LotNumber === lotNumber);
      if (!lot) {
        lot = { LotNumber: lotNumber, Quantity: 0 };
        doc.Lots.push(lot);
      }

      // Apply the signed quantity delta
      lot.Quantity += qty;

      // Recompute the overall on‐hand as the sum of all lots
      doc.qtyOnHand = doc.Lots.reduce((sum, l) => sum + l.Quantity, 0);

      await doc.save();
    }

    return txn;
  },

  listByItem: async (itemId) => {
    await connectMongoDB();
    return InventoryTxn.find({ "lines.item": itemId })
                       .sort({ createdAt: -1 })
                       .lean();
  }
};
