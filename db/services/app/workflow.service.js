// db/services/app/workflow.service.js - Archive + Purchase Orders + Vendors + Cycle Count
import { CoreService } from './core.service.js';
import db from '@/db/index.js';

// =============================================================================
// ARCHIVE SERVICE - File archiving and management
// =============================================================================

/**
 * Build the folder chain from a given folder up to root
 */
async function buildFolderChain(folderId) {
  if (!folderId) return [];
  
  await db.connect(); // Ensure connection
  
  const chain = [];
  let current = await db.models.Folder.findById(folderId).lean();
  
  while (current) {
    chain.unshift(current);
    if (!current.parentId) break;
    current = await db.models.Folder.findById(current.parentId).lean();
  }
  
  return chain;
}

class ArchiveService {
  async connect() {
    return db.connect();
  }

  /**
   * Mark a batch as archived when completed
   */
  async createArchiveCopy(batch) {
    await this.connect();
    
    const mother = await db.models.File.findById(batch.fileId).lean();
    if (!mother) return;

    let folderPath = 'Root';
    if (mother.folderId) {
      const folderChain = await buildFolderChain(mother.folderId);
      folderPath = folderChain.map(f => f.name).join(' / ');
    }

    await db.models.Batch.findByIdAndUpdate(batch._id, {
      isArchived: true,
      archivedAt: new Date(),
      folderPath: folderPath
    });
  }

  /**
   * Move archived file to different folder path
   */
  async moveArchivedFile(fileId, targetFolderId) {
    await this.connect();
    
    let targetFolderPath = 'Root';
    if (targetFolderId && targetFolderId !== 'root') {
      const folderChain = await buildFolderChain(targetFolderId);
      targetFolderPath = folderChain.map(f => f.name).join(' / ');
    }

    const updatedBatch = await db.models.Batch.findOneAndUpdate(
      { _id: fileId, isArchived: true },
      { folderPath: targetFolderPath },
      { new: true }
    ).populate('fileId', 'fileName').lean();

    if (!updatedBatch) {
      throw new Error('Archived file not found');
    }

    return {
      _id: updatedBatch._id,
      fileName: updatedBatch.fileId ? `${updatedBatch.fileId.fileName.replace('.pdf', '')}-Run-${updatedBatch.runNumber}.pdf` : `Batch Run ${updatedBatch.runNumber}`,
      folderPath: updatedBatch.folderPath,
      archivedAt: updatedBatch.archivedAt,
      originalFileId: updatedBatch.fileId?._id,
      batchId: updatedBatch._id,
      runNumber: updatedBatch.runNumber,
      isArchived: true
    };
  }

  /**
   * Get archive folders grouped by path
   */
  async getFolders() {
    await this.connect();
    
    const archivedBatches = await db.models.Batch.find({ 
      isArchived: true,
      archivedAt: { $exists: true }
    })
    .select('folderPath archivedAt')
    .lean();

    const folderGroups = {};
    
    archivedBatches.forEach(batch => {
      const path = batch.folderPath || 'Root';
      if (!folderGroups[path]) {
        folderGroups[path] = {
          name: path,
          fileCount: 0,
          lastArchived: batch.archivedAt
        };
      }
      folderGroups[path].fileCount++;
      
      if (batch.archivedAt > folderGroups[path].lastArchived) {
        folderGroups[path].lastArchived = batch.archivedAt;
      }
    });

    const folders = Object.entries(folderGroups).map(([path, data], index) => ({
      _id: `archive-folder-${index}`,
      name: data.name,
      fileCount: data.fileCount,
      lastArchived: data.lastArchived,
      isArchiveFolder: true
    }));

    return folders.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get all archived files
   */
  async getAllFiles() {
    await this.connect();
    
    const batches = await db.models.Batch.find({ 
      isArchived: true,
      archivedAt: { $exists: true }
    })
    .populate('fileId', 'fileName')
    .select('runNumber folderPath archivedAt fileId')
    .sort({ archivedAt: -1 })
    .lean();

    return batches.map(batch => ({
      _id: batch._id,
      fileName: batch.fileId ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : `Batch Run ${batch.runNumber}`,
      folderPath: batch.folderPath,
      archivedAt: batch.archivedAt,
      originalFileId: batch.fileId?._id,
      batchId: batch._id,
      runNumber: batch.runNumber,
      isArchived: true
    }));
  }

  /**
   * Get archived files by folder path
   */
  async getFilesByPath(folderPath) {
    await this.connect();
    
    const batches = await db.models.Batch.find({ 
      isArchived: true,
      archivedAt: { $exists: true },
      folderPath: folderPath
    })
    .populate('fileId', 'fileName')
    .select('runNumber folderPath archivedAt fileId')
    .sort({ archivedAt: -1 })
    .lean();

    return batches.map(batch => ({
      _id: batch._id,
      fileName: batch.fileId ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : `Batch Run ${batch.runNumber}`,
      folderPath: batch.folderPath,
      archivedAt: batch.archivedAt,
      originalFileId: batch.fileId?._id,
      batchId: batch._id,
      runNumber: batch.runNumber,
      isArchived: true
    }));
  }

  /**
   * Get archived file by ID
   */
  async getFile(id) {
    await this.connect();
    
    const batch = await db.models.Batch.findOne({
      _id: id,
      isArchived: true
    })
    .populate('fileId', 'fileName pdf')
    .lean();
    
    if (!batch) return null;

    let pdfData = null;
    if (batch.signedPdf?.data) {
      pdfData = `data:${batch.signedPdf.contentType || 'application/pdf'};base64,${batch.signedPdf.data.toString('base64')}`;
    } else if (batch.fileId?.pdf?.data) {
      pdfData = `data:${batch.fileId.pdf.contentType || 'application/pdf'};base64,${batch.fileId.pdf.data.toString('base64')}`;
    }

    return {
      _id: batch._id,
      fileName: batch.fileId ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : `Batch Run ${batch.runNumber}`,
      pdf: pdfData,
      folderPath: batch.folderPath,
      archivedAt: batch.archivedAt,
      runNumber: batch.runNumber,
      isBatch: true,
      isArchived: true,
      snapshot: batch.snapshot,
      overlayPng: batch.overlayPng,
      status: batch.status
    };
  }
}

// =============================================================================
// PURCHASE ORDER SERVICE - Purchase order management and receiving
// =============================================================================

class PurchaseOrderService extends CoreService {
  constructor() {
    super(null, {
      defaultPopulate: ['vendor'],
      excludeFields: ['__v']
    });
  }

  async connect() {
    return db.connect();
  }
  
  get model() {
    return db.models.PurchaseOrder;
  }

  async listPurchaseOrders() {
    await this.connect();
    return db.models.PurchaseOrder.find().populate('vendor').lean();
  }

  async getPurchaseOrder(id) {
    await this.connect();
    return db.models.PurchaseOrder.findById(id).populate('vendor').lean();
  }

  async createPurchaseOrder(data) {
    await this.connect();
    return (await db.models.PurchaseOrder.create(data)).toObject();
  }

  async updatePurchaseOrderStatus(id, status) {
    await this.connect();
    return db.models.PurchaseOrder.findByIdAndUpdate(id, { status }, { new: true }).lean();
  }

  /**
   * Receive purchase order items using db.services for transactions
   */
  async receivePurchaseOrder(id, receiptLines, actor = 'system') {
    await this.connect();
    const po = await db.models.PurchaseOrder.findById(id);
    if (!po) throw new Error('PO not found');

    // Use db.services for transaction service
    const txn = await db.services.txnService.post({
      txnType: 'receipt',
      refDoc: po._id,
      lines: receiptLines.map(r => ({
        item: r.itemId,
        lot: r.lotNumber,
        qty: r.qty
      })),
      actor,
      memo: `PO receipt`
    });

    const remaining = po.lines.reduce((acc, l) => {
      const received = receiptLines
        .filter(r => r.itemId === l.item.toString())
        .reduce((s, r) => s + r.qty, 0);
      return acc + Math.max(0, l.qty - received);
    }, 0);

    po.status = remaining === 0 ? 'received' : 'partial';
    await po.save();

    return po.toObject();
  }
}

// =============================================================================
// VENDOR SERVICE - Vendor and vendor item management
// =============================================================================

class VendorService extends CoreService {
  constructor() {
    super(null, {
      excludeFields: ['__v']
    });
  }

  async connect() {
    return db.connect();
  }
  
  get model() {
    return db.models.Vendor;
  }

  async listVendors() {
    await this.connect();
    return await db.models.Vendor.find().lean();
  }

  async getVendor(id) {
    await this.connect();
    return await db.models.Vendor.findById(id).lean();
  }

  async createVendor(data) {
    await this.connect();
    return (await db.models.Vendor.create(data)).toObject();
  }

  /**
   * Link item to vendor with pricing/sourcing info
   */
  async linkVendorItem(vendorId, itemId, payload) {
    await this.connect();
    const doc = await db.models.VendorItem.findOneAndUpdate(
      { vendor: vendorId, item: itemId },
      { ...payload, vendor: vendorId, item: itemId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc;
  }

  /**
   * Get all vendor sources for an item
   */
  async getVendorSourcesForItem(itemId) {
    await this.connect();
    return await db.models.VendorItem.find({ item: itemId })
      .populate('vendor')
      .sort({ preferred: -1, 'vendor.name': 1 })
      .lean();
  }

  /**
   * Get items for a vendor
   */
  async getVendorItems(vendorId) {
    await this.connect();
    return await db.models.VendorItem.find({ vendor: vendorId })
      .populate('item', 'sku displayName itemType uom')
      .sort({ 'item.displayName': 1 })
      .lean();
  }

  /**
   * Update vendor item pricing
   */
  async updateVendorItemPricing(vendorId, itemId, pricingData) {
    await this.connect();
    return await db.models.VendorItem.findOneAndUpdate(
      { vendor: vendorId, item: itemId },
      { 
        lastPrice: pricingData.lastPrice,
        preferred: pricingData.preferred,
        vendorSKU: pricingData.vendorSKU,
        leadTime: pricingData.leadTime,
        minimumOrderQty: pricingData.minimumOrderQty
      },
      { new: true }
    ).lean();
  }
}

// =============================================================================
// CYCLE COUNT SERVICE - Inventory cycle counting
// =============================================================================

class CycleCountService extends CoreService {
  constructor() {
    super(null, {
      defaultPopulate: ['items.chemical'],
      excludeFields: ['__v']
    });
  }

  async connect() {
    return db.connect();
  }
  
  get model() {
    return db.models.CycleCount;
  }

  /**
   * Create new cycle count
   */
  async createCycleCount(itemsData = []) {
    await this.connect();
    
    const cycleCount = await db.models.CycleCount.create({
      items: itemsData,
      isActive: true
    });

    return cycleCount.toObject();
  }

  /**
   * Get active cycle count
   */
  async getActiveCycleCount() {
    await this.connect();
    
    return await db.models.CycleCount.findOne({ isActive: true })
      .populate('items.chemical', 'sku displayName itemType')
      .lean();
  }

  /**
   * Update count quantities
   */
  async updateCycleCounts(cycleCountId, countUpdates) {
    await this.connect();
    
    const cycleCount = await db.models.CycleCount.findById(cycleCountId);
    if (!cycleCount) throw new Error('Cycle count not found');

    // Update counted quantities
    for (const update of countUpdates) {
      const item = cycleCount.items.id(update.itemId);
      if (item) {
        item.countedQuantity = update.countedQuantity;
      }
    }

    await cycleCount.save();
    return cycleCount.toObject();
  }

  /**
   * Complete cycle count and generate adjustments using db.services
   */
  async completeCycleCount(cycleCountId, actor) {
    await this.connect();
    
    const cycleCount = await db.models.CycleCount.findById(cycleCountId)
      .populate('items.chemical');
    
    if (!cycleCount) throw new Error('Cycle count not found');

    const adjustments = [];
    
    // Generate adjustment transactions for variances
    for (const item of cycleCount.items) {
      if (item.countedQuantity !== undefined) {
        const variance = item.countedQuantity - item.previousQuantity;
        
        if (variance !== 0) {
          adjustments.push({
            item: item.chemical._id,
            lot: item.LotNumber,
            qty: variance,
            reason: `Cycle count adjustment - ${item.chemical.displayName}`,
            previousQty: item.previousQuantity,
            countedQty: item.countedQuantity,
            variance: variance
          });
        }
      }
    }

    // Post adjustment transactions using db.services
    if (adjustments.length > 0) {
      await db.services.txnService.post({
        txnType: 'adjustment',
        lines: adjustments.map(adj => ({
          item: adj.item,
          lot: adj.lot,
          qty: adj.qty
        })),
        actor,
        memo: `Cycle count adjustments - ${new Date().toLocaleDateString()}`,
        reason: 'Cycle count variance',
        department: 'Inventory Control'
      });
    }

    // Mark cycle count as completed
    cycleCount.isActive = false;
    cycleCount.completedAt = new Date();
    await cycleCount.save();

    return {
      cycleCount: cycleCount.toObject(),
      adjustments: adjustments,
      totalVariances: adjustments.length,
      totalAdjustmentValue: adjustments.reduce((sum, adj) => sum + Math.abs(adj.variance), 0)
    };
  }

  /**
   * Get cycle count history
   */
  async getCycleCountHistory(limit = 10) {
    await this.connect();
    
    return await db.models.CycleCount.find({ isActive: false })
      .sort({ completedAt: -1 })
      .limit(limit)
      .select('createdAt completedAt items')
      .lean();
  }

  /**
   * Generate cycle count for random items
   */
  async generateRandomCycleCount(itemCount = 20, itemType = 'chemical') {
    await this.connect();
    
    const randomItems = await db.models.Item.aggregate([
      { $match: { itemType: itemType, lotTracked: true } },
      { $sample: { size: itemCount } }
    ]);

    const countItems = randomItems.map(item => ({
      chemical: item._id,
      BiologNumber: item.sku,
      ChemicalName: item.displayName,
      LotNumber: 'DEFAULT', // You might want to select specific lots
      previousQuantity: item.qtyOnHand || 0
    }));

    return await this.createCycleCount(countItems);
  }
}

// =============================================================================
// CREATE SERVICE INSTANCES
// =============================================================================

const archiveService = new ArchiveService();
const poService = new PurchaseOrderService();
const vendorService = new VendorService();
const cycleCountService = new CycleCountService();

// =============================================================================
// CLEAN EXPORTS - Only service instances and classes
// =============================================================================

// Service instances
export { archiveService, poService, vendorService, cycleCountService };

// Service classes
export { ArchiveService, PurchaseOrderService, VendorService, CycleCountService };