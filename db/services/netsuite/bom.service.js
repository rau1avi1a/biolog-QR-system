// services/netsuite/bom.service.js
import { createNetSuiteAuth } from './auth.service.js';
import db from '@/db/index.js';

/**
 * NetSuite BOM (Bill of Materials) Service
 * Handles fetching BOMs and components from NetSuite Assembly Items
 * Uses single db import for database operations
 */
export class NetSuiteBOMService {
  constructor(user) {
    this.user = user;
    this.auth = null; // Initialized in init()
  }

  /**
   * Initialize the auth service (must be called before using the service)
   */
  async init() {
    if (!this.auth) {
      this.auth = await createNetSuiteAuth(this.user);
    }
    return this;
  }

  /**
   * Ensure auth is initialized before making requests
   */
  async ensureAuth() {
    if (!this.auth) {
      await this.init();
    }
  }

  /**
   * Access to database models through db
   */
  get models() {
    return db.models;
  }

  /**
   * Access to other services through db
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
   * Search for Solutions/Assembly Items by name or internal ID
   * Enhanced search with better error handling and local caching
   */
  async searchAssemblyItems(searchTerm = '') {
    try {
      await this.ensureAuth();
      if (!searchTerm || searchTerm.trim().length < 2) return [];

      // Try local cache first
      await this.connect();
      const localItem = await this.models.Item.findOne({
        $or: [
          { netsuiteInternalId: searchTerm.trim() },
          { displayName: { $regex: searchTerm, $options: 'i' } },
          { sku: { $regex: searchTerm, $options: 'i' } }
        ],
        itemType: { $in: ['solution', 'product'] }
      }).lean();

      // Construct endpoint
      let endpoint = '/assemblyItem';
      if (/^\d+$/.test(searchTerm.trim())) {
        endpoint += `?q=internalid:${encodeURIComponent(searchTerm.trim())}`;
      } else {
        endpoint += `?q=${encodeURIComponent(searchTerm.trim())}`;
      }

      const results = await this.auth.makeRequest(endpoint);
      let netsuiteResults = [];
      if (results && results.items) netsuiteResults = results.items;
      else if (Array.isArray(results)) netsuiteResults = results;
      else if (results && results.links) netsuiteResults = [results];

      return await this.enhanceWithLocalData(netsuiteResults);
    } catch (error) {
      console.error('Error searching assembly items:', error);
      // Fallback simple search
      try {
        const fallback = await this.auth.makeRequest('/assemblyItem?limit=10');
        const items = fallback.items || [];
        const filtered = items.filter(item => {
          const id = item.itemid || item.id || '';
          const name = item.displayName || id;
          const term = searchTerm.toLowerCase();
          return id.toLowerCase().includes(term) || name.toLowerCase().includes(term);
        });
        return await this.enhanceWithLocalData(filtered);
      } catch (e) {
        console.error('Fallback search failed:', e);
        return [];
      }
    }
  }

  /**
   * Enhance NetSuite results with local database information
   */
  async enhanceWithLocalData(netsuiteResults) {
    const enhanced = [];
    for (const item of netsuiteResults) {
      const itemId = item.id || item.itemid;
      const local = await this.models.Item.findOne({ netsuiteInternalId: itemId }).lean();
      enhanced.push({
        ...item,
        localItem: local,
        hasLocalData: !!local,
        localQtyOnHand: local?.qtyOnHand || 0,
        localDisplayName: local?.displayName,
        localSku: local?.sku
      });
    }
    return enhanced;
  }

  /**
   * Get Assembly Item BOM and its components
   */
  async getAssemblyBOM(assemblyItemId) {
    await this.ensureAuth();
    await this.connect();

    // Optionally use local cache
    const localItem = await this.models.Item.findOne({
      netsuiteInternalId: assemblyItemId,
      bom: { $exists: true, $ne: [] }
    }).lean();
    // Always fetch fresh for now

    // Fetch BOM list
    const listResp = await this.auth.makeRequest(
      `/assemblyItem/${assemblyItemId}/billOfMaterials?expandSubResources=true`
    );
    if (!listResp.items?.length) throw new Error('No BOMs found');
    const bomData = listResp.items[0];
    const revisionId = bomData.currentRevision?.id;
    if (!revisionId) throw new Error('No current BOM revision');

    // Fetch revision components
    const rawComps = await this.getBOMRevisionComponents(revisionId);
    const normalized = this.normalizeComponentData(rawComps);
    const mapped = await this.mapComponentsToLocal(normalized);
    const recipe = this.formatBOMAsRecipe(normalized);

    const result = {
      bomId: bomData.billOfMaterials?.id,
      revisionId,
      components: rawComps,
      normalizedComponents: normalized,
      mappedComponents: mapped,
      recipe,
      assemblyItemId
    };

    // Cache locally
    await this.cacheBOMDataLocally(assemblyItemId, result);
    return result;
  }

  async getBOMRevisionComponents(revisionId) {
    const resp = await this.auth.makeRequest(
      `/bomrevision/${revisionId}?expandSubResources=true`
    );
    return resp.component?.items || [];
  }

  normalizeComponentData(rawComponents) {
    return rawComponents.map((c, i) => {
      const item = c.item || {};
      const id = item.id || item.internalId || c.itemId;
      const name = item.refName || item.itemid || 'Unknown';
      const qty = parseFloat(c.quantity || c.bomQuantity || 0);
      const units = c.units || c.unit || item.units || 'ea';
      return {
        ingredient: name,
        itemId: id,
        quantity: qty,
        bomQuantity: qty,
        units,
        componentYield: c.componentYield || 100,
        lineId: c.lineId,
        bomComponentId: c.id,
        itemSource: c.itemSource?.refName,
        _original: c
      };
    });
  }

  async mapComponentsToLocal(components) {
    try {
      return await db.netsuite.mapComponents(components);
    } catch {
      return components.map(comp => ({
        netsuiteComponent: comp,
        matches: [],
        bestMatch: null,
        mappedSuccessfully: false
      }));
    }
  }

  async cacheBOMDataLocally(assemblyItemId, bomData) {
    try {
      const forStorage = (bomData.normalizedComponents).map(c => ({
        itemId: c.itemId,
        ingredient: c.ingredient,
        qty: c.quantity,
        uom: c.units,
        netsuiteData: c
      }));
      await this.models.Item.updateOne(
        { netsuiteInternalId: assemblyItemId },
        { $set: { bom: forStorage, lastBOMSync: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error('Error caching BOM data:', e);
    }
  }

  formatBOMAsRecipe(components) {
    return components.map(c => ({
      ingredient: c.ingredient,
      itemId: c.itemId,
      quantity: c.quantity,
      units: c.units,
      componentYield: c.componentYield
    }));
  }
}

/**
 * Factory function to create BOM service - async
 */
export const createBOMService = async (user) => {
  const svc = new NetSuiteBOMService(user);
  await svc.init();
  return svc;
};
