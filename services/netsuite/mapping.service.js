// services/netsuite/mapping.service.js - Enhanced to search both chemicals and solutions
import connectMongoDB from '@/lib/index';
import { Item } from '@/models/Item';

/**
 * Enhanced NetSuite Component Mapping Service
 * Maps NetSuite BOM components to local chemicals AND solutions using multiple strategies
 */
export class NetSuiteMappingService {
  
  /**
   * Map NetSuite components to local chemicals and solutions using multiple strategies
   * @param {Array} netsuiteComponents - Array of NetSuite BOM components
   * @returns {Array} Mapping results with confidence scores
   */
  async mapComponentsToLocalChemicals(netsuiteComponents) {
    await connectMongoDB();
    
    const mappingResults = [];
    
    // Get all local chemicals AND solutions for mapping
    const [localChemicals, localSolutions] = await Promise.all([
      Item.find({ itemType: 'chemical' })
        .select('_id displayName sku casNumber netsuiteInternalId qtyOnHand uom itemType')
        .lean(),
      Item.find({ itemType: 'solution' })
        .select('_id displayName sku netsuiteInternalId qtyOnHand uom itemType')
        .lean()
    ]);
    
    // Combine all components and add itemCategory for identification
    const allLocalComponents = [
      ...localChemicals.map(item => ({ ...item, itemCategory: 'chemical' })),
      ...localSolutions.map(item => ({ ...item, itemCategory: 'solution' }))
    ];
    
    console.log(`Found ${localChemicals.length} chemicals and ${localSolutions.length} solutions for mapping (${allLocalComponents.length} total)`);
    
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
    
    console.log(`Mapping NetSuite component: ${component.ingredient} (ID: ${component.itemId})`);
    
    // Strategy 1: Exact NetSuite Internal ID match (highest confidence)
    if (component.itemId) {
      const exactMatch = allLocalComponents.find(item => 
        item.netsuiteInternalId === component.itemId
      );
      
      if (exactMatch) {
        console.log(`✓ Found exact NetSuite ID match: ${exactMatch.displayName} (${exactMatch.itemCategory})`);
        matches.push({
          chemical: exactMatch, // Keep naming for compatibility
          confidence: 1.0,
          matchType: 'netsuite_id_exact',
          reason: `Exact NetSuite Internal ID match (${exactMatch.itemCategory})`
        });
      }
    }
    
    // Strategy 2: Name-based fuzzy matching (if no exact ID match)
    if (matches.length === 0 && component.ingredient) {
      console.log(`No exact ID match found, trying name-based matching for: ${component.ingredient}`);
      const nameMatches = this.findNameMatches(component.ingredient, allLocalComponents);
      matches.push(...nameMatches);
      
      if (nameMatches.length > 0) {
        console.log(`Found ${nameMatches.length} name-based matches`);
      }
    }
    
    // Strategy 3: SKU/Reference matching (if available)
    if (matches.length === 0 && component.itemRefName) {
      console.log(`No name matches found, trying SKU matching for: ${component.itemRefName}`);
      const skuMatches = this.findSKUMatches(component.itemRefName, allLocalComponents);
      matches.push(...skuMatches);
      
      if (skuMatches.length > 0) {
        console.log(`Found ${skuMatches.length} SKU-based matches`);
      }
    }
    
    // Sort matches by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);
    
    const result = {
      netsuiteComponent: component,
      matches: matches.slice(0, 5), // Top 5 matches
      bestMatch: matches.length > 0 ? matches[0] : null,
      mappedSuccessfully: matches.length > 0 && matches[0].confidence >= 0.8
    };
    
    if (result.bestMatch) {
      console.log(`✓ Best match for ${component.ingredient}: ${result.bestMatch.chemical.displayName} (${result.bestMatch.chemical.itemCategory}) - confidence: ${Math.round(result.bestMatch.confidence * 100)}%`);
    } else {
      console.log(`✗ No suitable match found for ${component.ingredient}`);
    }
    
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
      
      if (confidence > 0.3) { // Only include reasonable matches
        matches.push({
          chemical: component, // Keep naming for compatibility
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
      
      // Exact SKU match
      if (componentSku === searchRef) {
        matches.push({
          chemical: component, // Keep naming for compatibility
          confidence: 0.9,
          matchType: 'sku_exact',
          reason: `Exact SKU match (${component.itemCategory})`
        });
      }
      // Partial SKU match
      else if (componentSku.includes(searchRef) || searchRef.includes(componentSku)) {
        matches.push({
          chemical: component, // Keep naming for compatibility
          confidence: 0.7,
          matchType: 'sku_partial',
          reason: `Partial SKU match (${component.itemCategory})`
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
      byMatchType: {},
      byItemType: { chemical: 0, solution: 0 }
    };
    
    for (const result of mappingResults) {
      if (!result.bestMatch) {
        stats.unmapped++;
      } else {
        const confidence = result.bestMatch.confidence;
        const matchType = result.bestMatch.matchType;
        const itemType = result.bestMatch.chemical.itemCategory;
        
        if (confidence === 1.0) stats.exactMatches++;
        else if (confidence >= 0.8) stats.highConfidenceMatches++;
        else if (confidence >= 0.6) stats.mediumConfidenceMatches++;
        else stats.lowConfidenceMatches++;
        
        stats.byMatchType[matchType] = (stats.byMatchType[matchType] || 0) + 1;
        stats.byItemType[itemType] = (stats.byItemType[itemType] || 0) + 1;
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