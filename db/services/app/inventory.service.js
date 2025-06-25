// db/services/app/inventory.service.js - Items + Transactions unified service (FIXED)
import mongoose from 'mongoose';
import { CoreService } from './core.service.js';
import db from '../../index.js';

// =============================================================================
// ITEM SERVICE - Consolidated item management (Chemical, Solution, Product)
// =============================================================================

class ItemService extends CoreService {
  constructor() {
    super(null, {
      defaultPopulate: [],
      excludeFields: ['__v']
    });
  }

  async connect() {
    return db.connect();
  }

  // Lazy model getters
  get model() {
    return db.models.Item;
  }

  get Item() { 
    return db.models.Item; 
  }
  
  get Chemical() { 
    return db.models.Chemical; 
  }

  /**
   * Create item with type-specific handling
   */
  async create(payload, session = null) {
    await this.connect();
    
    const {
      itemType,
      sku,
      displayName,
      netsuiteInternalId,
      lotTracked = false,
      uom = 'ea',
      qtyOnHand = 0,
      bom = []
    } = payload;

    const ownSession = !session;
    if (ownSession) session = await mongoose.startSession();

    try {
      if (ownSession) session.startTransaction();

      const docData = {
        itemType,
        sku,
        displayName,
        netsuiteInternalId,
        lotTracked,
        uom,
        qtyOnHand
      };

      // Add type-specific fields
      if (itemType === 'chemical') {
        docData.casNumber = payload.casNumber;
        docData.location = payload.location;
        if (lotTracked) docData.Lots = [];
      }

      // Embed BOM for solution/product
      if ((itemType === 'solution' || itemType === 'product') && Array.isArray(bom) && bom.length) {
        docData.bom = bom.map(r => ({
          itemId: r.itemId || r.componentId,
          qty: Number(r.qty || r.quantity),
          uom: r.uom || 'ea'
        }));
        if (lotTracked) docData.Lots = [];
      }

      const [created] = await this.Item.create([docData], { session });

      if (ownSession) await session.commitTransaction();
      return created.toObject();

    } catch (err) {
      if (ownSession) await session.abortTransaction();
      throw err;
    } finally {
      if (ownSession) session.endSession();
    }
  }

  /**
   * Get item by ID - matches the interface your route expects
   */
  async getById(id) {
    await this.connect();
    const item = await this.Item.findById(id)
      .populate('bom.itemId', 'displayName sku')
      .lean();
    return item;
  }

  /**
   * Search items - matches the interface your route expects
   */
  async search(query = {}) {
    await this.connect();
    const { type, search, netsuiteId } = query;
    
    const filter = {};
    if (type) filter.itemType = type;
    
    if (netsuiteId) {
      filter.netsuiteInternalId = netsuiteId;
    } else if (search) {
      if (/^\d+$/.test(search.trim())) {
        filter.netsuiteInternalId = search.trim();
      } else {
        filter.displayName = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      }
    }

    return this.Item.find(filter)
      .sort({ displayName: 1 })
      .select('_id displayName sku netsuiteInternalId itemType qtyOnHand uom')
      .lean();
  }

  /**
   * List items by type with search
   */
  async listByType(itemType, options = {}) {
    const { search, limit = 50, skip = 0 } = options;
    
    const filter = { itemType };
    
    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    return this.find({
      filter,
      limit,
      skip,
      sort: { displayName: 1 }
    });
  }

  /**
   * Get item with lot details
   */
  async getWithLots(id) {
    await this.connect();
    
    const item = await this.Item.findById(id).lean();
    if (!item) return null;

    // Calculate lot totals if lot-tracked
    if (item.lotTracked && item.Lots) {
      const lotSummary = item.Lots.map(lot => ({
        ...lot,
        expired: lot.expiryDate && new Date(lot.expiryDate) < new Date(),
        daysUntilExpiry: lot.expiryDate ? 
          Math.ceil((new Date(lot.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
      }));

      return {
        ...item,
        lotSummary,
        totalQty: item.qtyOnHand,
        availableLots: lotSummary.filter(lot => lot.quantity > 0),
        expiredLots: lotSummary.filter(lot => lot.expired)
      };
    }

    return item;
  }

  /**
   * Update item - matches the interface your route expects
   */
  async update(id, data) {
    await this.connect();
    const allowed = ["displayName", "casNumber", "location", "description", "cost"];
    const update = {};
    for (const key of allowed) {
      if (data[key] !== undefined) update[key] = data[key];
    }

    return this.Item.findByIdAndUpdate(id, { $set: update }, { new: true, lean: true });
  }

  /**
   * Delete item - matches the interface your route expects
   */
  async delete(id, forceDelete = false) {
    await this.connect();
    const item = await this.Item.findById(id);
    if (!item) throw new Error('Item not found');

    if (item.qtyOnHand > 0 && !forceDelete) {
      throw new Error('Cannot delete item with active stock. Use force delete or adjust quantity to zero first.');
    }

    return this.Item.findByIdAndDelete(id);
  }

  /**
   * Get lots for an item - matches the interface your route expects
   */
  async getLots(itemId, lotId = null) {
    await this.connect();
    const item = await this.Item.findById(itemId).select('itemType uom Lots').lean();
    
    if (!item || item.itemType !== 'chemical') {
      return [];
    }
    
    let lots = (item.Lots || []).filter(l => (l.quantity || 0) > 0);
    
    if (lotId) {
      lots = lots.filter(l => l._id.toString() === lotId);
    }
    
    return lots.map(l => ({
      id: l._id.toString(),
      lotNumber: l.lotNumber,
      availableQty: l.quantity,
      unit: item.uom || 'ea',
      expiryDate: l.expiryDate?.toISOString().slice(0, 10) || null
    }));
  }

  /**
   * Delete a specific lot - matches the interface your route expects
   */
  async deleteLot(itemId, lotId) {
    await this.connect();
    const item = await this.Item.findById(itemId);
    if (!item) throw new Error('Item not found');

    const lotToDelete = (item.Lots || []).find(l => l._id.toString() === lotId);
    if (!lotToDelete) throw new Error('Lot not found');

    item.Lots = (item.Lots || []).filter(l => l._id.toString() !== lotId);
    if (item.lotTracked) {
      item.qtyOnHand = item.Lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
    }
    await item.save();

    return { lotNumber: lotToDelete.lotNumber, quantity: lotToDelete.quantity };
  }

  /**
   * Find items by NetSuite Internal ID
   */
  async findByNetSuiteId(netsuiteId) {
    return this.find({
      filter: { netsuiteInternalId: netsuiteId }
    });
  }

  /**
   * Update item quantities (used by transactions)
   */
  async updateQuantities(itemId, lotUpdates, session = null) {
    await this.connect();
    
    const item = await this.Item.findById(itemId).session(session);
    if (!item) throw new Error('Item not found');

    // Apply lot updates
    for (const { lotNumber, qtyChange, lotData = {} } of lotUpdates) {
      if (!item.Lots) item.Lots = [];
      
      let lot = item.Lots.find(l => l.lotNumber === lotNumber);
      
      if (!lot) {
        // Create new lot
        lot = {
          lotNumber,
          quantity: 0,
          ...lotData
        };
        item.Lots.push(lot);
      }
      
      lot.quantity += qtyChange;
      
      // Update lot metadata if provided
      if (lotData.expiryDate) lot.expiryDate = lotData.expiryDate;
      if (lotData.location) lot.location = lotData.location;
      if (lotData.vendorLotNumber) lot.vendorLotNumber = lotData.vendorLotNumber;
    }

    // Recalculate total quantity
    item.qtyOnHand = item.Lots.reduce((sum, lot) => sum + Math.max(0, lot.quantity), 0);
    
    await item.save({ session });
    return item.toObject();
  }
}

// =============================================================================
// TRANSACTION SERVICE - Inventory transactions with lot tracking
// =============================================================================

class TransactionService {
  async connect() {
    return db.connect();
  }

  // Lazy model getters
  get InventoryTxn() {
    return db.models.InventoryTxn;
  }

  get Item() {
    return db.models.Item;
  }
  
  /**
   * Post inventory transaction with enhanced tracking
   */
  async post({ 
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
  }) {
    await this.connect();
    
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const enhancedLines = [];
      
      for (const { item: itemId, lot: lotNumber, qty, unitCost, notes, expiryDate, vendorLotNumber, location } of lines) {
        const doc = await this.Item.findById(itemId).session(session);
        if (!doc) {
          throw new Error(`Item ${itemId} not found`);
        }
        
        // Make sure this item is lot-tracked if we have a lot
        if (lotNumber && !doc.lotTracked) {
          doc.lotTracked = true;
        }
        
        if (!doc.Lots) doc.Lots = [];
        
        const itemQtyBefore = doc.qtyOnHand || 0;
        let lotQtyBefore = 0;
        
        // Find or add the lot
        let lotIndex = -1;
        if (lotNumber) {
          lotIndex = doc.Lots.findIndex((l) => l.lotNumber === lotNumber);
          
          if (lotIndex === -1) {
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
          
          doc.Lots[lotIndex].quantity = lotQtyBefore + qty;
          
          // Update lot metadata for receipts
          if (txnType === 'receipt') {
            if (expiryDate) doc.Lots[lotIndex].expiryDate = new Date(expiryDate);
            if (vendorLotNumber) doc.Lots[lotIndex].vendorLotNumber = vendorLotNumber;
            if (location) doc.Lots[lotIndex].location = location;
          }
        }
        
        // Recompute overall quantity
        const totalQty = doc.Lots.reduce((sum, l) => {
          const lotQty = l.quantity || 0;
          return sum + Math.max(0, lotQty);
        }, 0);
        
        doc.qtyOnHand = totalQty;
        
        const lineUnitCost = unitCost || doc.cost || 0;
        const lineTotalValue = qty * lineUnitCost;
        
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
      
      const txn = await this.InventoryTxn.create([{
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
  }

  /**
   * Get transactions for a specific item
   */
  async listByItem(itemId, options = {}) {
    await this.connect();
    
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
    
    return this.InventoryTxn.find(query)
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('lines.item', 'sku displayName uom')
      .populate('batchId', 'runNumber fileId status')
      .populate({
        path: 'batchId',
        populate: [
          { path: 'fileId', select: 'fileName' },
          { path: 'snapshot.solutionRef', select: 'displayName sku' },
          { path: 'snapshot.productRef', select: 'displayName sku' }
        ]
      })
      .lean();
  }

  /**
   * Get lot history for specific item and lot
   */
  async getLotHistory(itemId, lotNumber) {
    await this.connect();
    
    return this.InventoryTxn.find({
      "lines.item": itemId,
      "lines.lot": lotNumber,
      status: 'posted'
    })
    .sort({ postedAt: -1 })
    .populate('lines.item', 'sku displayName uom')
    .populate('batchId', 'runNumber fileId status')
    .lean();
  }

  /**
   * Get transaction by ID with full details
   */
  async getById(txnId) {
    await this.connect();
    
    return this.InventoryTxn.findById(txnId)
      .populate('lines.item', 'sku displayName uom itemType')
      .populate('createdBy._id', 'name email')
      .populate('batchId', 'runNumber fileId status')
      .lean();
  }

  /**
   * Create a reversal transaction
   */
  async reverse(originalTxnId, actor, reason) {
    await this.connect();
    
    const originalTxn = await this.InventoryTxn.findById(originalTxnId);
    if (!originalTxn) {
      throw new Error('Original transaction not found');
    }
    
    if (originalTxn.status === 'reversed') {
      throw new Error('Transaction already reversed');
    }
    
    const reversalLines = originalTxn.lines.map(line => ({
      ...line,
      qty: -line.qty,
      totalValue: -line.totalValue
    }));
    
    const reversalTxn = await this.post({
      txnType: 'adjustment',
      lines: reversalLines,
      actor,
      memo: `Reversal of ${originalTxn.txnType} ${originalTxn._id}`,
      reason: reason || 'Transaction reversal',
      refDoc: originalTxn._id,
      refDocType: 'reversal'
    });
    
    originalTxn.status = 'reversed';
    originalTxn.reversedBy = reversalTxn._id;
    await originalTxn.save();
    
    return reversalTxn;
  }

  /**
   * Get item stats for a specific item - ADDED MISSING METHOD
   */
  async getItemStats(itemId, startDate, endDate) {
    await this.connect();
    
    const query = {
      "lines.item": itemId,
      status: 'posted'
    };
    
    if (startDate || endDate) {
      query.postedAt = {};
      if (startDate) query.postedAt.$gte = new Date(startDate);
      if (endDate) query.postedAt.$lte = new Date(endDate);
    }
    
    const transactions = await this.InventoryTxn.find(query)
      .sort({ postedAt: -1 })
      .lean();
    
    const stats = {
      totalTransactions: transactions.length,
      receipts: 0,
      issues: 0,
      adjustments: 0,
      builds: 0,
      totalReceived: 0,
      totalIssued: 0,
      totalAdjusted: 0,
      totalBuilt: 0
    };
    
    transactions.forEach(txn => {
      const itemLine = txn.lines.find(line => line.item.toString() === itemId);
      if (itemLine) {
        stats[`${txn.txnType}s`]++;
        
        if (txn.txnType === 'receipt') {
          stats.totalReceived += itemLine.qty;
        } else if (txn.txnType === 'issue') {
          stats.totalIssued += Math.abs(itemLine.qty);
        } else if (txn.txnType === 'adjustment') {
          stats.totalAdjusted += itemLine.qty;
        } else if (txn.txnType === 'build') {
          stats.totalBuilt += itemLine.qty;
        }
      }
    });
    
    return stats;
  }
}

// =============================================================================
// CREATE SERVICE INSTANCES
// =============================================================================

const itemService = new ItemService();
const txnService = new TransactionService();

// =============================================================================
// EXPORTS - Export service instances directly (no destructuring)
// =============================================================================

export { itemService, txnService, ItemService, TransactionService };