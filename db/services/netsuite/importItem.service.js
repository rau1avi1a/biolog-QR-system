// =============================================================================
// db/services/netsuite/importItem.service.js - NetSuite Import Service
// =============================================================================
import { createNetSuiteAuth } from './auth.service.js';
import db from '@/db/index.js';

/**
 * NetSuite Import Service
 * Handles fetching inventory data from NetSuite and processing imports
 */
export class NetSuiteImportService {
  constructor(user) {
    this.user = user;
    this.auth = null;
  }

  /**
   * Initialize the auth service
   */
  async init() {
    if (!this.auth) {
      this.auth = await createNetSuiteAuth(this.user);
    }
    return this;
  }

  /**
   * Ensure auth is initialized
   */
  async ensureAuth() {
    if (!this.auth) {
      await this.init();
    }
  }

  /**
   * Access to database models
   */
  get models() {
    return db.models;
  }

  /**
   * Access to services
   */
  get services() {
    return db.services;
  }

  /**
   * Ensure database connection
   */
  async connect() {
    return db.connect();
  }

  /**
   * Execute SuiteQL query with pagination
   */
  async executeSuiteQL(query, offset = 0, limit = 1000) {
    await this.ensureAuth();
    
    const queryWithPagination = `${query} LIMIT ${limit} OFFSET ${offset}`;
    console.log('🔍 Executing SuiteQL:', queryWithPagination);

    // Store original base URL and switch to query endpoint
    const originalBaseUrl = this.auth.baseUrl;
    
    try {
      // Switch to SuiteQL endpoint
      this.auth.baseUrl = 'https://4511488-sb1.suitetalk.api.netsuite.com/services/rest';
      
      const response = await this.auth.makeRequest('/query/v1/suiteql', 'POST', { 
        q: queryWithPagination 
      }, {
        'Prefer': 'transient'
      });
      
      console.log('📋 SuiteQL response:', {
        hasItems: !!response.items,
        itemCount: response.items?.length || 0,
        hasMore: response.hasMore
      });
      
      return {
        items: response.items || [],
        hasMore: response.hasMore || false,
        count: response.count || 0,
        offset: offset,
        limit: limit
      };
      
    } catch (error) {
      console.error('❌ SuiteQL execution failed:', error);
      throw new Error(`SuiteQL query failed: ${error.message}`);
    } finally {
      // Always restore original base URL
      this.auth.baseUrl = originalBaseUrl;
    }
  }

  /**
   * Get the standard inventory query
   */
  getInventoryQuery() {
    return `SELECT
      i.itemid                   AS sku,
      i.displayname              AS "display name",
      i.id                       AS "item internal id",
      i.itemtype                 AS type,
      inv.inventorynumber        AS "lot number",
      inv.quantityonhand         AS "lot quantity",
      inv.id                     AS "lot internal id"
    FROM
      item i
    LEFT OUTER JOIN
      inventorynumber inv
      ON inv.item = i.id
    WHERE
      i.itemid LIKE '24-%'
    ORDER BY
      i.itemid,
      inv.inventorynumber`;
  }

  /**
   * Fetch all inventory data in batches
   */
  async fetchAllInventoryData(onProgress = null) {
    const query = this.getInventoryQuery();
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;
    let batchCount = 0;
    const allItems = [];

    while (hasMore) {
      batchCount++;
      
      if (onProgress) {
        onProgress({
          step: 'fetching',
          batch: batchCount,
          message: `Fetching batch ${batchCount} from NetSuite...`
        });
      }

      const batchResult = await this.executeSuiteQL(query, offset, batchSize);
      
      if (batchResult.items && batchResult.items.length > 0) {
        allItems.push(...batchResult.items);
        hasMore = batchResult.hasMore;
        offset += batchSize;
      } else {
        hasMore = false;
      }

      // Safety check to prevent infinite loops
      if (batchCount > 10) {
        console.warn('⚠️ Max batch limit reached');
        break;
      }
    }

    console.log(`✅ Fetched ${allItems.length} items from NetSuite in ${batchCount} batches`);
    return allItems;
  }

  /**
   * Group NetSuite items by SKU (since lots create multiple rows)
   */
  groupItemsBySku(items) {
    const grouped = {};
    
    items.forEach(item => {
      const sku = item.sku;
      if (!grouped[sku]) {
        grouped[sku] = {
          sku,
          displayName: item["display name"],
          netsuiteInternalId: item["item internal id"],
          itemType: item.type === 'InvtPart' ? 'chemical' : 'product',
          lots: []
        };
      }
      
      // Add lot if it exists and has quantity > 0
      if (item["lot number"] && parseFloat(item["lot quantity"]) > 0) {
        grouped[sku].lots.push({
          lotNumber: item["lot number"],
          quantity: parseFloat(item["lot quantity"]),
          lotInternalId: item["lot internal id"]
        });
      }
    });
    
    return grouped;
  }

  /**
   * Process inventory updates (full import)
   */
  async processInventoryUpdates(netsuiteItems, onProgress = null) {
    await this.connect();
    
    const results = {
      totalItems: 0,
      processedItems: 0,
      createdItems: 0,
      updatedItems: 0,
      lotsProcessed: 0,
      lotsCreated: 0,
      skippedZeroQuantity: 0,
      errors: []
    };

    // Group items by SKU
    const groupedItems = this.groupItemsBySku(netsuiteItems);
    results.totalItems = Object.keys(groupedItems).length;

    if (onProgress) {
      onProgress({
        step: 'processing',
        message: `Processing ${results.totalItems} items...`
      });
    }

    // Process each item
    for (const [sku, itemData] of Object.entries(groupedItems)) {
      try {
        await this.processItem(itemData, results);
        results.processedItems++;
        
        if (onProgress) {
          onProgress({
            step: 'processing',
            processed: results.processedItems,
            total: results.totalItems,
            message: `Processed ${results.processedItems} of ${results.totalItems} items...`
          });
        }
      } catch (error) {
        results.errors.push({
          sku,
          error: error.message
        });
        console.error(`❌ Error processing item ${sku}:`, error);
      }
    }

    return results;
  }

  /**
   * Process a single item (similar to your existing upload logic)
   */
  async processItem(itemData, results) {
    const { sku, displayName, netsuiteInternalId, itemType, lots } = itemData;
    
    // Check if item already exists
    let existingItem = await this.models.Item.findOne({ 
      sku,
      netsuiteInternalId 
    });
    
    if (!existingItem) {
      // Create new item
      const itemPayload = {
        itemType,
        sku,
        displayName,
        netsuiteInternalId,
        lotTracked: lots.length > 0,
        uom: 'ea',
        qtyOnHand: 0,
        createdBy: this.user._id
      };
      
      existingItem = await this.services.itemService.create(itemPayload);
      results.createdItems++;
      console.log(`✅ Created new ${itemType}: ${sku} - ${displayName}`);
    } else {
      // Update existing item
      await this.services.itemService.update(existingItem._id, {
        displayName,
        netsuiteInternalId,
        updatedBy: this.user._id
      });
      results.updatedItems++;
      console.log(`🔄 Updated existing ${itemType}: ${sku} - ${displayName}`);
    }
    
    // Process lots
    const nonZeroLots = lots.filter(lot => lot.quantity > 0);
    
    if (nonZeroLots.length > 0) {
      // Make sure item is lot-tracked
      if (!existingItem.lotTracked) {
        await this.models.Item.findByIdAndUpdate(existingItem._id, { 
          lotTracked: true,
          Lots: []
        });
      }
      
      // Reload item to get current lots
      const itemWithLots = await this.models.Item.findById(existingItem._id);
      if (!itemWithLots.Lots) {
        itemWithLots.Lots = [];
      }
      
      for (const lotData of nonZeroLots) {
        const { lotNumber, quantity } = lotData;
        
        // Check if lot already exists
        let existingLot = itemWithLots.Lots.find(l => l.lotNumber === lotNumber);
        
        if (existingLot) {
          // Update existing lot quantity
          existingLot.quantity = quantity;
          console.log(`🔄 Updated lot ${lotNumber} for ${sku}: ${quantity}`);
        } else {
          // Create new lot
          itemWithLots.Lots.push({
            lotNumber,
            quantity,
            location: 'Inventory',
            expiryDate: null
          });
          results.lotsCreated++;
          console.log(`✅ Created new lot ${lotNumber} for ${sku}: ${quantity}`);
        }
        
        results.lotsProcessed++;
      }
      
      // Recalculate total quantity
      itemWithLots.qtyOnHand = itemWithLots.Lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
      
      // Save the item with updated lots
      await itemWithLots.save();
    }
    
    // Count skipped zero quantity lots
    const zeroQuantityLots = lots.filter(lot => lot.quantity === 0);
    results.skippedZeroQuantity += zeroQuantityLots.length;
  }

  /**
   * Scan for new items (compare with local database)
   */
  async scanForNewItems(netsuiteItems, onProgress = null) {
    await this.connect();
    
    const groupedItems = this.groupItemsBySku(netsuiteItems);
    const newItems = [];
    
    if (onProgress) {
      onProgress({
        step: 'scanning',
        message: 'Identifying new items...'
      });
    }

    // Get all local SKUs for comparison
    const localItems = await this.models.Item.find({}, 'sku Lots').lean();
    const localSkuMap = new Map();
    
    localItems.forEach(item => {
      localSkuMap.set(item.sku, {
        lotNumbers: new Set((item.Lots || []).map(lot => lot.lotNumber))
      });
    });

    // Check each NetSuite item
    for (const [sku, itemData] of Object.entries(groupedItems)) {
      const localItem = localSkuMap.get(sku);
      
      if (!localItem) {
        // Completely new item
        newItems.push({
          ...itemData,
          isNew: true,
          isNewLots: false,
          newLots: itemData.lots,
          totalQuantity: itemData.lots.reduce((sum, lot) => sum + lot.quantity, 0)
        });
      } else {
        // Check for new lots
        const newLots = itemData.lots.filter(lot => !localItem.lotNumbers.has(lot.lotNumber));
        
        if (newLots.length > 0) {
          newItems.push({
            ...itemData,
            isNew: false,
            isNewLots: true,
            newLots,
            totalQuantity: newLots.reduce((sum, lot) => sum + lot.quantity, 0)
          });
        }
      }
    }

    console.log(`🔍 Found ${newItems.length} new items/lots out of ${Object.keys(groupedItems).length} total items`);
    return newItems;
  }

  /**
   * Perform full import workflow
   */
  async performFullImport(onProgress = null) {
    try {
      // Step 1: Fetch all data
      const allItems = await this.fetchAllInventoryData(onProgress);
      
      // Step 2: Process updates
      const results = await this.processInventoryUpdates(allItems, onProgress);
      
      return {
        success: true,
        results,
        totalItems: allItems.length
      };
      
    } catch (error) {
      console.error('❌ Full import failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Scan for new items workflow
   */
  async scanNewItems(onProgress = null) {
    try {
      // Step 1: Fetch all data
      const allItems = await this.fetchAllInventoryData(onProgress);
      
      // Step 2: Identify new items
      const newItems = await this.scanForNewItems(allItems, onProgress);
      
      return {
        success: true,
        newItems,
        totalScanned: allItems.length
      };
      
    } catch (error) {
      console.error('❌ Scan new items failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import selected items from preview
   */
  async importSelectedItems(selectedItems, onProgress = null) {
    try {
      // Convert back to NetSuite format for processing
      const netsuiteItems = [];
      
      selectedItems.forEach(item => {
        item.lots.forEach(lot => {
          netsuiteItems.push({
            sku: item.sku,
            "display name": item.displayName,
            "item internal id": item.netsuiteInternalId,
            type: item.itemType === 'chemical' ? 'InvtPart' : 'Assembly',
            "lot number": lot.lotNumber,
            "lot quantity": lot.quantity.toString(),
            "lot internal id": lot.lotInternalId
          });
        });
      });
      
      // Process the updates
      const results = await this.processInventoryUpdates(netsuiteItems, onProgress);
      
      return {
        success: true,
        results
      };
      
    } catch (error) {
      console.error('❌ Import selected items failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Factory function to create import service
 */
export const createImportService = async (user) => {
  const service = new NetSuiteImportService(user);
  await service.init();
  return service;
};

/**
 * Convenience functions
 */
export async function performFullImport(user, onProgress = null) {
  const service = await createImportService(user);
  return service.performFullImport(onProgress);
}

export async function scanNewItems(user, onProgress = null) {
  const service = await createImportService(user);
  return service.scanNewItems(onProgress);
}

export async function importSelectedItems(user, selectedItems, onProgress = null) {
  const service = await createImportService(user);
  return service.importSelectedItems(selectedItems, onProgress);
}