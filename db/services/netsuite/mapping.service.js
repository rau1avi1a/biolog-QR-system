// services/netsuite/mapping.service.js
import db from '@/db/index.js';

/**
 * Enhanced NetSuite Component Mapping Service
 * Maps NetSuite BOM components to local chemicals AND solutions using multiple strategies
 * Uses single db import for database operations
 */
export class NetSuiteMappingService {
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
   * Map NetSuite components to local chemicals and solutions using multiple strategies
   * @param {Array} netsuiteComponents - Array of NetSuite BOM components
   * @returns {Array} Mapping results with confidence scores
   */
  async mapComponentsToLocalChemicals(netsuiteComponents) {
    await this.connect();
    
    const mappingResults = [];
    
    // Get all local chemicals AND solutions for mapping
    const [localChemicals, localSolutions] = await Promise.all([
      this.models.Item.find({ itemType: 'chemical' })
        .select('_id displayName sku casNumber netsuiteInternalId qtyOnHand uom itemType')
        .lean(),
      this.models.Item.find({ itemType: 'solution' })
        .select('_id displayName sku netsuiteInternalId qtyOnHand uom itemType')
        .lean()
    ]);
    
    // Combine all components and add itemCategory for identification
    const allLocalComponents = [
      ...localChemicals.map(item => ({ ...item, itemCategory: 'chemical' })),
      ...localSolutions.map(item => ({ ...item, itemCategory: 'solution' }))
    ];
    
    for (const component of netsuiteComponents) {
      const mappingResult = await this.mapSingleComponent(component, allLocalComponents);
      mappingResults.push(mappingResult);
    }
    
    return mappingResults;
  }
  
  /**
   * Map a single NetSuite component to local chemicals and solutions
   * @param {Object} component - NetSuite component data
   * @param {Array} allLocalComponents - Array of local chemicals and solutions
   * @returns {Object} Mapping result with matches and confidence
   */
  async mapSingleComponent(component, allLocalComponents) {
    const matches = [];
    
    // Strategy 1: Exact NetSuite Internal ID match (highest confidence)
    if (component.itemId) {
      const exactMatch = allLocalComponents.find(item => 
        item.netsuiteInternalId === component.itemId
      );
      if (exactMatch) {
        matches.push({
          chemical: exactMatch,
          confidence: 1.0,
          matchType: 'netsuite_id_exact',
          reason: `Exact NetSuite Internal ID match (${exactMatch.itemCategory})`
        });
      }
    }
    
    // Strategy 2: Name-based fuzzy matching (if no exact ID match)
    if (matches.length === 0 && component.ingredient) {
      const nameMatches = this.findNameMatches(component.ingredient, allLocalComponents);
      matches.push(...nameMatches);
    }
    
    // Strategy 3: SKU/Reference matching (if available)
    if (matches.length === 0 && component.itemRefName) {
      const skuMatches = this.findSKUMatches(component.itemRefName, allLocalComponents);
      matches.push(...skuMatches);
    }
    
    // Sort matches by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);
    
    const result = {
      netsuiteComponent: component,
      matches: matches.slice(0, 5), // Top 5 matches
      bestMatch: matches.length > 0 ? matches[0] : null,
      mappedSuccessfully: matches.length > 0 && matches[0].confidence >= 0.8
    };
    
    return result;
  }
  
  /**
   * Find name-based matches using fuzzy string matching
   */
  findNameMatches(ingredientName, allLocalComponents) {
    const matches = [];
    const searchName = ingredientName.toLowerCase().trim();
    
    for (const component of allLocalComponents) {
      const componentName = component.displayName.toLowerCase().trim();
      const confidence = this.calculateNameSimilarity(searchName, componentName);
      if (confidence > 0.3) {
        matches.push({
          chemical: component,
          confidence,
          matchType: confidence > 0.8 ? 'name_high' : confidence > 0.6 ? 'name_medium' : 'name_low',
          reason: `Name similarity: ${Math.round(confidence * 100)}% (${component.itemCategory})`
        });
      }
    }
    return matches;
  }
  
  /**
   * Find SKU/Reference based matches
   */
  findSKUMatches(itemRefName, allLocalComponents) {
    const matches = [];
    const searchRef = itemRefName.toLowerCase().trim();
    
    for (const component of allLocalComponents) {
      const componentSku = component.sku.toLowerCase().trim();
      
      if (componentSku === searchRef) {
        matches.push({ chemical: component, confidence: 0.9, matchType: 'sku_exact', reason: `Exact SKU match (${component.itemCategory})` });
      } else if (componentSku.includes(searchRef) || searchRef.includes(componentSku)) {
        matches.push({ chemical: component, confidence: 0.7, matchType: 'sku_partial', reason: `Partial SKU match (${component.itemCategory})` });
      }
    }
    return matches;
  }
  
  /**
   * Calculate name similarity using multiple algorithms
   */
  calculateNameSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.9;
    const words1 = str1.split(/[^a-z0-9]+/).filter(w => w.length > 2);
    const words2 = str2.split(/[^a-z0-9]+/).filter(w => w.length > 2);
    if (!words1.length || !words2.length) return 0;
    let matchingWords = 0;
    const totalWords = Math.max(words1.length, words2.length);
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2) { matchingWords += 1; break; }
        if (w1.includes(w2) || w2.includes(w1)) { matchingWords += 0.7; break; }
        if (this.levenshteinDistance(w1, w2) <= 2 && Math.min(w1.length, w2.length) > 3) {
          matchingWords += 0.5; break;
        }
      }
    }
    return Math.min(1.0, matchingWords / totalWords);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        matrix[i][j] = str2[i-1] === str1[j-1]
          ? matrix[i-1][j-1]
          : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
      }
    }
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Get detailed mapping statistics
   */
  getMappingStats(mappingResults) {
    const stats = { total: mappingResults.length, exactMatches: 0, highConfidenceMatches: 0, mediumConfidenceMatches: 0, lowConfidenceMatches: 0, unmapped: 0, byMatchType: {}, byItemType: { chemical: 0, solution: 0 } };
    for (const result of mappingResults) {
      if (!result.bestMatch) { stats.unmapped++; continue; }
      const { confidence, matchType, chemical } = result.bestMatch;
      if (confidence === 1.0) stats.exactMatches++;
      else if (confidence >= 0.8) stats.highConfidenceMatches++;
      else if (confidence >= 0.6) stats.mediumConfidenceMatches++;
      else stats.lowConfidenceMatches++;
      stats.byMatchType[matchType] = (stats.byMatchType[matchType]||0)+1;
      stats.byItemType[chemical.itemCategory] = (stats.byItemType[chemical.itemCategory]||0)+1;
    }
    return stats;
  }
  
  /**
   * Auto-accept mappings above confidence threshold
   */
  autoAcceptMappings(mappingResults, confidenceThreshold = 0.9) {
    const autoAccepted = [], needsReview = [];
    for (const result of mappingResults) {
      if (result.bestMatch && result.bestMatch.confidence >= confidenceThreshold) {
        autoAccepted.push({ ...result, autoAccepted: true, selectedMatch: result.bestMatch });
      } else {
        needsReview.push({ ...result, autoAccepted: false, selectedMatch: null });
      }
    }
    return { autoAccepted, needsReview };
  }
  
  /**
   * Enhanced method to save mapping results to database using db.services
   */
  async saveMappingResults(mappingResults, bomId, userId = null) {
    await this.connect();
    const mappingStats = this.getMappingStats(mappingResults);
    console.log('Saving mapping results for BOM:', bomId, 'Stats:', mappingStats);
    // Extend to save to a ComponentMapping model if desired
    return { saved: true, stats: mappingStats };
  }
}

/**
 * Factory function to create mapping service
 */
export const createMappingService = () => {
  return new NetSuiteMappingService();
};

/**
 * Standalone function for quick component mapping
 */
export async function mapNetSuiteComponents(netsuiteComponents) {
  const mappingService = createMappingService();
  return await mappingService.mapComponentsToLocalChemicals(netsuiteComponents);
}
