import connectMongoDB from "@/lib/index";
import { Item }       from "@/models/Item";
import {InventoryTxn}   from "@/models/InventoryTxn";

export const txnService = {
  post: async ({ txnType, lines, actor, memo, project, department }) => {
    await connectMongoDB();

    console.log('🔄 TXN SERVICE: Starting transaction processing');
    console.log('🔄 TXN SERVICE: Transaction type:', txnType);
    console.log('🔄 TXN SERVICE: Lines to process:', lines);

    // 1️⃣ write the transaction record
    const txn = await InventoryTxn.create({
      txnType,
      lines,
      createdBy: actor,
      memo,
      project,
      department
    });

    console.log('🔄 TXN SERVICE: Transaction record created:', txn._id);

    // 2️⃣ apply to each line
    for (const { item: itemId, lot: lotNumber, qty } of lines) {
      console.log('🔄 TXN SERVICE: Processing line:', { itemId, lotNumber, qty });
      
      try {
        const doc = await Item.findById(itemId);
        if (!doc) {
          console.error('🔄 TXN SERVICE: Item not found:', itemId);
          continue;
        }

        console.log('🔄 TXN SERVICE: Before update - Item:', { 
          _id: doc._id, 
          displayName: doc.displayName, 
          itemType: doc.itemType,
          currentQtyOnHand: doc.qtyOnHand,
          hasLotsArray: !!doc.Lots,
          currentLotsCount: doc.Lots ? doc.Lots.length : 0,
          currentLots: doc.Lots || []
        });

        // Make sure this item is lot‐tracked
        doc.lotTracked = true;
        
        // Initialize Lots array if it doesn't exist
        if (!doc.Lots) {
          console.log('🔄 TXN SERVICE: Initializing Lots array');
          doc.Lots = [];
        }

        // Find or add the lot
        let lotIndex = doc.Lots.findIndex((l) => l.lotNumber === lotNumber);
        let lot;
        
        if (lotIndex === -1) {
          console.log('🔄 TXN SERVICE: Creating new lot:', lotNumber);
          lot = { lotNumber: lotNumber, quantity: 0 };
          doc.Lots.push(lot);
          lotIndex = doc.Lots.length - 1; // Get the index of the newly added lot
        } else {
          console.log('🔄 TXN SERVICE: Found existing lot:', { lotNumber, currentQuantity: doc.Lots[lotIndex].quantity });
        }

        // Apply the signed quantity delta directly to the lot in the array
        const oldQuantity = doc.Lots[lotIndex].quantity || 0;
        doc.Lots[lotIndex].quantity = oldQuantity + qty;

        console.log('🔄 TXN SERVICE: Updated lot:', { 
          lotNumber, 
          oldQuantity, 
          deltaQty: qty, 
          newQuantity: doc.Lots[lotIndex].quantity 
        });

        // Recompute the overall on‐hand as the sum of all lots
        const totalQty = doc.Lots.reduce((sum, l) => {
          const lotQty = l.quantity || 0;
          console.log('🔄 TXN SERVICE: Adding lot to total:', { lotNumber: l.lotNumber, quantity: lotQty });
          return sum + lotQty;
        }, 0);
        
        doc.qtyOnHand = totalQty;

        console.log('🔄 TXN SERVICE: After update - Item:', { 
          _id: doc._id, 
          newQtyOnHand: doc.qtyOnHand,
          lotsCount: doc.Lots.length,
          allLots: doc.Lots.map(l => ({ lotNumber: l.lotNumber, quantity: l.quantity }))
        });

        const savedDoc = await doc.save();
        console.log('🔄 TXN SERVICE: Item saved successfully. New version:', savedDoc.__v);

      } catch (error) {
        console.error('🔄 TXN SERVICE: Error processing line:', error);
        throw error;
      }
    }

    console.log('🔄 TXN SERVICE: Transaction completed successfully');
    return txn;
  },

  listByItem: async (itemId) => {
    await connectMongoDB();
    return InventoryTxn.find({ "lines.item": itemId })
                       .sort({ createdAt: -1 })
                       .lean();
  }
};