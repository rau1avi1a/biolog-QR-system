// services/txn.service.js
import mongoose from 'mongoose';
import connectMongoDB from '@/lib/index';
import { Item } from '@/models/Item';
import { InventoryTxn } from '@/models/InventoryTxn'; // Add this import

export const txnService = {
  /**
   * Create and post a transaction with enhanced tracking
   */
  post: async ({ 
    txnType, 
    lines, 
    actor, 
    memo, 
    project, 
    department,
    batchId,
    workOrderId,
    refDoc,
    refDocType,
    reason,
    effectiveDate
  }) => {
    await connectMongoDB();
    
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Enhance each line with before/after quantities
      const enhancedLines = [];
      
      for (const { item: itemId, lot: lotNumber, qty, unitCost, notes, expiryDate, vendorLotNumber, location } of lines) {
        const doc = await Item.findById(itemId).session(session);
        if (!doc) {
          throw new Error(`Item ${itemId} not found`);
        }
        
        // Make sure this item is lot-tracked if we have a lot
        if (lotNumber && !doc.lotTracked) {
          doc.lotTracked = true;
        }
        
        // Initialize Lots array if it doesn't exist
        if (!doc.Lots) {
          doc.Lots = [];
        }
        
        // Track quantities before change
        const itemQtyBefore = doc.qtyOnHand || 0;
        let lotQtyBefore = 0;
        
        // Find or add the lot
        let lotIndex = -1;
        if (lotNumber) {
          lotIndex = doc.Lots.findIndex((l) => l.lotNumber === lotNumber);
          
          if (lotIndex === -1) {
            // Create new lot
            const newLot = { 
              lotNumber, 
              quantity: 0,
              expiryDate: expiryDate ? new Date(expiryDate) : undefined,
              vendorLotNumber,
              location
            };
            doc.Lots.push(newLot);
            lotIndex = doc.Lots.length - 1;
          } else {
            lotQtyBefore = doc.Lots[lotIndex].quantity || 0;
          }
          
          // Apply quantity change to lot
          doc.Lots[lotIndex].quantity = lotQtyBefore + qty;
          
          // Update lot metadata for receipts
          if (txnType === 'receipt') {
            if (expiryDate) doc.Lots[lotIndex].expiryDate = new Date(expiryDate);
            if (vendorLotNumber) doc.Lots[lotIndex].vendorLotNumber = vendorLotNumber;
            if (location) doc.Lots[lotIndex].location = location;
          }
        }
        
        // Recompute the overall on-hand as the sum of all lots
        const totalQty = doc.Lots.reduce((sum, l) => {
          const lotQty = l.quantity || 0;
          return sum + Math.max(0, lotQty); // Don't allow negative lot quantities
        }, 0);
        
        doc.qtyOnHand = totalQty;
        
        // Calculate cost information
        const lineUnitCost = unitCost || doc.cost || 0;
        const lineTotalValue = qty * lineUnitCost;
        
        // Create enhanced line
        enhancedLines.push({
          item: itemId,
          lot: lotNumber,
          qty,
          unitCost: lineUnitCost,
          totalValue: lineTotalValue,
          lotQtyBefore,
          lotQtyAfter: lotNumber ? doc.Lots[lotIndex].quantity : null,
          itemQtyBefore,
          itemQtyAfter: doc.qtyOnHand,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          vendorLotNumber,
          location,
          notes
        });
        
        await doc.save({ session });
      }
      
      // Create the transaction record with enhanced data
      const txn = await InventoryTxn.create([{
        txnType,
        lines: enhancedLines,
        createdBy: {
          _id: actor._id || actor,
          name: actor.name || actor.displayName,
          email: actor.email
        },
        memo,
        project,
        department,
        batchId,
        workOrderId,
        refDoc,
        refDocType,
        reason,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date()
      }], { session });
      
      await session.commitTransaction();
      return txn[0];
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Get transactions for a specific item with enhanced filtering
   */
  listByItem: async (itemId, options = {}) => {
    await connectMongoDB();
    
    const {
      txnType,
      startDate,
      endDate,
      status = 'posted',
      limit = 100,
      page = 1
    } = options;
    
    const query = { 
      "lines.item": itemId,
      status
    };
    
    if (txnType) query.txnType = txnType;
    if (startDate || endDate) {
      query.postedAt = {};
      if (startDate) query.postedAt.$gte = new Date(startDate);
      if (endDate) query.postedAt.$lte = new Date(endDate);
    }
    
    const skip = (page - 1) * limit;
    
    return InventoryTxn.find(query)
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('lines.item', 'sku displayName uom')
      .lean();
  },

  /**
   * Get transaction by ID with full details
   */
  getById: async (txnId) => {
    await connectMongoDB();
    
    return InventoryTxn.findById(txnId)
      .populate('lines.item', 'sku displayName uom itemType')
      .populate('createdBy._id', 'name email')
      .populate('validatedBy._id', 'name email')
      .lean();
  },

  /**
   * Create a reversal transaction
   */
  reverse: async (originalTxnId, actor, reason) => {
    await connectMongoDB();
    
    const originalTxn = await InventoryTxn.findById(originalTxnId);
    if (!originalTxn) {
      throw new Error('Original transaction not found');
    }
    
    if (originalTxn.status === 'reversed') {
      throw new Error('Transaction already reversed');
    }
    
    // Create reversal lines (flip quantities)
    const reversalLines = originalTxn.lines.map(line => ({
      ...line,
      qty: -line.qty,
      totalValue: -line.totalValue
    }));
    
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Create reversal transaction
      const reversalTxn = await this.post({
        txnType: 'adjustment',
        lines: reversalLines,
        actor,
        memo: `Reversal of ${originalTxn.txnType} ${originalTxn._id}`,
        reason: reason || 'Transaction reversal',
        refDoc: originalTxn._id,
        refDocType: 'reversal'
      });
      
      // Mark original as reversed
      originalTxn.status = 'reversed';
      originalTxn.reversedBy = reversalTxn._id;
      await originalTxn.save({ session });
      
      await session.commitTransaction();
      return reversalTxn;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Get lot history for a specific item and lot
   */
  getLotHistory: async (itemId, lotNumber) => {
    await connectMongoDB();
    
    return InventoryTxn.find({
      "lines.item": itemId,
      "lines.lot": lotNumber,
      status: 'posted'
    })
    .sort({ postedAt: -1 })
    .populate('lines.item', 'sku displayName uom')
    .lean();
  },

  /**
   * Get summary statistics for an item
   */
  getItemStats: async (itemId, startDate, endDate) => {
    await connectMongoDB();
    
    const matchStage = {
      "lines.item": new mongoose.Types.ObjectId(itemId),
      status: 'posted'
    };
    
    if (startDate || endDate) {
      matchStage.postedAt = {};
      if (startDate) matchStage.postedAt.$gte = new Date(startDate);
      if (endDate) matchStage.postedAt.$lte = new Date(endDate);
    }
    
    const stats = await InventoryTxn.aggregate([
      { $match: matchStage },
      { $unwind: '$lines' },
      { $match: { "lines.item": new mongoose.Types.ObjectId(itemId) } },
      {
        $group: {
          _id: '$txnType',
          totalQty: { $sum: '$lines.qty' },
          totalValue: { $sum: '$lines.totalValue' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);
    
    return stats;
  }
};