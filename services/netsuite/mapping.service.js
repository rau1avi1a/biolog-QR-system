// services/netsuite/mapping.service.js - Enhanced component mapping service
import connectMongoDB from '@/lib/index';
import { Item } from '@/models/Item';

/**
 * Enhanced NetSuite Component Mapping Service
 * Maps NetSuite BOM components to local chemicals using multiple strategies
 */
export class NetSuiteMappingService {
  
  /**
   * Map NetSuite components to local chemicals using multiple strategies
   * @param {Array} netsuiteComponents - Array of NetSuite BOM components
   * @returns {Array} Mapping results with confidence scores
   */
  async mapComponentsToLocalChemicals(netsuiteComponents) {
    await connectMongoDB();
    
    const mappingResults = [];
    
    // Get all local chemicals for fuzzy matching
    const localChemicals = await Item.find({ itemType: 'chemical' })
      .select('_id displayName sku casNumber netsuiteInternalId qtyOnHand uom')
      .lean();
    
    console.log(`Found ${localChemicals.length} local chemicals for mapping`);
    
    for (const component of netsuiteComponents) {
      const mappingResult = await this.mapSingleComponent(component, localChemicals);
      mappingResults.push(mappingResult);
    }
    
    return mappingResults;
  }
  
  /**
   * Map a single NetSuite component to local chemicals
   * @param {Object} component - NetSuite component data
   * @param {Array} localChemicals - Array of local chemicals
   * @returns {Object} Mapping result with matches and confidence
   */
  async mapSingleComponent(component, localChemicals) {
    const matches = [];
    
    // Strategy 1: Exact NetSuite Internal ID match (highest confidence)
    if (component.itemId) {
      const exactMatch = localChemicals.find(chem => 
        chem.netsuiteInternalId === component.itemId
      );
      
      if (exactMatch) {
        matches.push({
          chemical: exactMatch,
          confidence: 1.0,
          matchType: 'netsuite_id_exact',
          reason: 'Exact NetSuite Internal ID match'
        });
      }
    }
    
    // Strategy 2: Name-based fuzzy matching (if no exact ID match)
    if (matches.length === 0 && component.ingredient) {
      const nameMatches = this.findNameMatches(component.ingredient, localChemicals);
      matches.push(...nameMatches);
    }
    
    // Strategy 3: SKU/Reference matching (if available)
    if (matches.length === 0 && component.itemRefName) {
      const skuMatches = this.findSKUMatches(component.itemRefName, localChemicals);
      matches.push(...skuMatches);
    }
    
    // Sort matches by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return {
      netsuiteComponent: component,
      matches: matches.slice(0, 5), // Top 5 matches
      bestMatch: matches.length > 0 ? matches[0] : null,
      mappedSuccessfully: matches.length > 0 && matches[0].confidence >= 0.8
    };
  }
  
  /**
   * Find name-based matches using fuzzy string matching
   */
  findNameMatches(ingredientName, localChemicals) {
    const matches = [];
    const searchName = ingredientName.toLowerCase().trim();
    
    for (const chemical of localChemicals) {
      const chemName = chemical.displayName.toLowerCase().trim();
      const confidence = this.calculateNameSimilarity(searchName, chemName);
      
      if (confidence > 0.3) { // Only include reasonable matches
        matches.push({
          chemical,
          confidence,
          matchType: confidence > 0.8 ? 'name_high' : confidence > 0.6 ? 'name_medium' : 'name_low',
          reason: `Name similarity: ${Math.round(confidence * 100)}%`
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Find SKU/Reference based matches
   */
  findSKUMatches(itemRefName, localChemicals) {
    const matches = [];
    const searchRef = itemRefName.toLowerCase().trim();
    
    for (const chemical of localChemicals) {
      const chemSku = chemical.sku.toLowerCase().trim();
      
      // Exact SKU match
      if (chemSku === searchRef) {
        matches.push({
          chemical,
          confidence: 0.9,
          matchType: 'sku_exact',
          reason: 'Exact SKU match'
        });
      }
      // Partial SKU match
      else if (chemSku.includes(searchRef) || searchRef.includes(chemSku)) {
        matches.push({
          chemical,
          confidence: 0.7,
          matchType: 'sku_partial',
          reason: 'Partial SKU match'
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Calculate name similarity using multiple algorithms
   */
  calculateNameSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Exact match
    if (str1 === str2) return 1.0;
    
    // Contains match (high confidence)
    if (str1.includes(str2) || str2.includes(str1)) return 0.9;
    
    // Word-based matching
    const words1 = str1.split(/[\s\-_(),]+/).filter(w => w.length > 2);
    const words2 = str2.split(/[\s\-_(),]+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    let matchingWords = 0;
    const totalWords = Math.max(words1.length, words2.length);
    
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2) {
          matchingWords += 1;
          break;
        } else if (word1.includes(word2) || word2.includes(word1)) {
          matchingWords += 0.7;
          break;
        } else if (this.levenshteinDistance(word1, word2) <= 2 && Math.min(word1.length, word2.length) > 3) {
          matchingWords += 0.5;
          break;
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
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Get detailed mapping statistics
   */
  getMappingStats(mappingResults) {
    const stats = {
      total: mappingResults.length,
      exactMatches: 0,
      highConfidenceMatches: 0,
      mediumConfidenceMatches: 0,
      lowConfidenceMatches: 0,
      unmapped: 0,
      byMatchType: {}
    };
    
    for (const result of mappingResults) {
      if (!result.bestMatch) {
        stats.unmapped++;
      } else {
        const confidence = result.bestMatch.confidence;
        const matchType = result.bestMatch.matchType;
        
        if (confidence === 1.0) stats.exactMatches++;
        else if (confidence >= 0.8) stats.highConfidenceMatches++;
        else if (confidence >= 0.6) stats.mediumConfidenceMatches++;
        else stats.lowConfidenceMatches++;
        
        stats.byMatchType[matchType] = (stats.byMatchType[matchType] || 0) + 1;
      }
    }
    
    return stats;
  }
  
  /**
   * Auto-accept mappings above confidence threshold
   */
  autoAcceptMappings(mappingResults, confidenceThreshold = 0.9) {
    const autoAccepted = [];
    const needsReview = [];
    
    for (const result of mappingResults) {
      if (result.bestMatch && result.bestMatch.confidence >= confidenceThreshold) {
        autoAccepted.push({
          ...result,
          autoAccepted: true,
          selectedMatch: result.bestMatch
        });
      } else {
        needsReview.push({
          ...result,
          autoAccepted: false,
          selectedMatch: null
        });
      }
    }
    
    return { autoAccepted, needsReview };
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