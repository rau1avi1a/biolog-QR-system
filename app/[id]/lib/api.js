// app/[id]/lib/api.js
import { Item } from '@/db/schemas/Item';
import connectMongoDB from '@/db/index';
import { txnService } from '@/db/services/app/txn.service';
import mongoose from 'mongoose';

/**
 * Get either an Item or Lot by ID
 * @param {string} id - MongoDB ObjectId as string
 * @returns {Promise<{type: 'item'|'lot'|null, data: object|null}>}
 */
export async function getItemOrLot(id) {
  await connectMongoDB();
  
  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return { type: null, data: null };
  }
  
  // Try to find it as an Item first
  const item = await Item.findById(id).lean();
  
  if (item) {
    return {
      type: 'item',
      data: formatItemData(item)
    };
  }

  // If not found as an Item, search for it as a Lot within Items
  try {
    // Use mongoose.Types.ObjectId for the query
    const itemWithLot = await Item.findOne({ 
      "Lots._id": new mongoose.Types.ObjectId(id) 
    }).lean();
    
    if (itemWithLot) {
      const lot = itemWithLot.Lots.find(l => l._id.toString() === id);
      
      if (lot) {
        return {
          type: 'lot',
          data: formatLotData(lot, itemWithLot)
        };
      }
    }
  } catch (error) {
    // Silently handle error
  }

  return { type: null, data: null };
}

/**
 * Format item data for consistent structure
 * @param {object} item - Raw item from database
 * @returns {object} - Formatted item data
 */
function formatItemData(item) {
  return {
    _id: item._id.toString(),
    displayName: item.displayName || '',
    sku: item.sku || '',
    itemType: item.itemType || '',
    qtyOnHand: Number(item.qtyOnHand) || 0,
    uom: item.uom || 'ea',
    description: item.description || '',
    cost: Number(item.cost) || 0,
    lotTracked: Boolean(item.lotTracked),
    
    // Chemical-specific fields
    casNumber: item.casNumber || '',
    location: item.location || '',
    
    // Solution/Product-specific fields (BOM)
    bom: item.bom || [],
    
    // Embedded lots from schema
    lots: (item.Lots || []).map(lot => ({
      _id: lot._id?.toString() || '',
      lotNumber: lot.lotNumber || '',
      quantity: Number(lot.quantity) || 0,
    })),
    
    createdAt: item.createdAt ? item.createdAt.toISOString() : null,
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
  };
}

/**
 * Format lot data with parent item info
 * @param {object} lot - Raw lot from database
 * @param {object} parentItem - Parent item containing the lot
 * @returns {object} - Formatted lot data with item info
 */
function formatLotData(lot, parentItem) {
  return {
    lot: {
      _id: lot._id.toString(),
      lotNumber: lot.lotNumber || '',
      quantity: Number(lot.quantity) || 0,
      qrCodeUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${lot._id}`,
    },
    item: {
      _id: parentItem._id.toString(),
      displayName: parentItem.displayName || '',
      sku: parentItem.sku || '',
      itemType: parentItem.itemType || '',
      uom: parentItem.uom || 'ea',
      description: parentItem.description || '',
      location: parentItem.location || '',
    }
  };
}

/**
 * Get transaction history for a specific item
 * @param {string} itemId - Item ObjectId as string
 * @returns {Promise<Array>} - Array of formatted transactions
 */
export async function getItemTransactionHistory(itemId) {
  try {    
    if (!txnService?.listByItem) {
      return [];
    }
    
    const transactions = await txnService.listByItem(itemId);
    
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }
    
    return transactions.map(txn => ({
      _id: txn._id.toString(),
      txnType: txn.txnType || '',
      memo: txn.memo || '',
      createdBy: txn.createdBy?.name || txn.createdBy?.email || 'System',
      project: txn.project || '',
      department: txn.department || '',
      postedAt: txn.postedAt ? txn.postedAt.toISOString() : null,
      effectiveDate: txn.effectiveDate ? txn.effectiveDate.toISOString() : null,
      status: txn.status || 'posted',
      // Extract relevant lines for this item
      lines: (txn.lines || [])
        .filter(line => line.item.toString() === itemId)
        .map(line => ({
          item: line.item.toString(),
          lotNumber: line.lot || '',
          qty: Number(line.qty) || 0,
          unitCost: Number(line.unitCost) || 0,
          totalValue: Number(line.totalValue) || 0,
          itemQtyBefore: Number(line.itemQtyBefore) || 0,
          itemQtyAfter: Number(line.itemQtyAfter) || 0,
          lotQtyBefore: Number(line.lotQtyBefore) || 0,
          lotQtyAfter: Number(line.lotQtyAfter) || 0,
          notes: line.notes || ''
        }))
    }));
  } catch (error) {
    console.error('Error fetching item transaction history:', error);
    return [];
  }
}

/**
 * Get transaction history for a specific lot
 * @param {string} itemId - Parent item ObjectId as string
 * @param {string} lotNumber - Lot number string
 * @returns {Promise<Array>} - Array of formatted transactions affecting this lot
 */
export async function getLotTransactionHistory(itemId, lotNumber) {
  try {    
    if (!txnService?.listByItem) {
      return [];
    }
    
    const transactions = await txnService.listByItem(itemId);
    
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }
    
    // Filter transactions that affect this specific lot
    const lotTransactions = transactions
      .map(txn => ({
        _id: txn._id.toString(),
        txnType: txn.txnType || '',
        memo: txn.memo || '',
        createdBy: txn.createdBy?.name || txn.createdBy?.email || 'System',
        project: txn.project || '',
        department: txn.department || '',
        postedAt: txn.postedAt ? txn.postedAt.toISOString() : null,
        effectiveDate: txn.effectiveDate ? txn.effectiveDate.toISOString() : null,
        status: txn.status || 'posted',
        // Extract only lines that affect this specific lot
        relevantLines: (txn.lines || [])
          .filter(line => 
            line.item.toString() === itemId && line.lot === lotNumber
          )
          .map(line => ({
            item: line.item.toString(),
            lot: line.lot,
            qty: Number(line.qty) || 0,
            unitCost: Number(line.unitCost) || 0,
            totalValue: Number(line.totalValue) || 0,
            itemQtyBefore: Number(line.itemQtyBefore) || 0,
            itemQtyAfter: Number(line.itemQtyAfter) || 0,
            lotQtyBefore: Number(line.lotQtyBefore) || 0,
            lotQtyAfter: Number(line.lotQtyAfter) || 0,
            notes: line.notes || ''
          }))
      }))
      .filter(txn => txn.relevantLines.length > 0);
    
    return lotTransactions;
  } catch (error) {
    console.error('Error fetching lot transaction history:', error);
    return [];
  }
}

/**
 * Generate metadata for items or lots
 * @param {string} id - ObjectId as string
 * @returns {Promise<object>} - Next.js metadata object
 */
export async function generateDetailMetadata(id) {
  const { type, data } = await getItemOrLot(id);
  
  if (!data) {
    return {
      title: 'Not Found',
      description: 'The requested item or lot could not be found.',
    };
  }

  if (type === 'item') {
    const itemTypeLabel = data.itemType.charAt(0).toUpperCase() + data.itemType.slice(1);
    return {
      title: `${data.displayName} - ${itemTypeLabel} Details`,
      description: `Detailed information for ${data.displayName} (${data.sku})`,
    };
  } else {
    return {
      title: `Lot ${data.lot.lotNumber} - ${data.item.displayName}`,
      description: `Detailed information for lot ${data.lot.lotNumber}`,
    };
  }
}