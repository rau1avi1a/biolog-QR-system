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
      try {
        const doc = await Item.findById(itemId);
        if (!doc) {
          continue;
        }

        // Make sure this item is lot‐tracked
        doc.lotTracked = true;
        
        // Initialize Lots array if it doesn't exist
        if (!doc.Lots) {
          doc.Lots = [];
        }

        // Find or add the lot
        let lotIndex = doc.Lots.findIndex((l) => l.lotNumber === lotNumber);
        let lot;
        
        if (lotIndex === -1) {
          lot = { lotNumber: lotNumber, quantity: 0 };
          doc.Lots.push(lot);
          lotIndex = doc.Lots.length - 1; // Get the index of the newly added lot
        }

        // Apply the signed quantity delta directly to the lot in the array
        const oldQuantity = doc.Lots[lotIndex].quantity || 0;
        doc.Lots[lotIndex].quantity = oldQuantity + qty;

        // Recompute the overall on‐hand as the sum of all lots
        const totalQty = doc.Lots.reduce((sum, l) => {
          const lotQty = l.quantity || 0;
          return sum + lotQty;
        }, 0);
        
        doc.qtyOnHand = totalQty;

        await doc.save();

      } catch (error) {
        throw error;
      }
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