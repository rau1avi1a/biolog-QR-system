// app/(pages)/home/components/QRScanner/hooks/core/itemLookup/itemLookup.core.js

/**
 * Core item lookup logic for QR Scanner
 * Handles finding items based on QR code data
 */

const extractIdFromQRData = (qrData) => {
  let searchId = qrData.trim();
  
  // Extract the ID from URL format: mywebsite/[id]
  if (searchId.includes('/')) {
    const urlParts = searchId.split('/');
    searchId = urlParts[urlParts.length - 1]; // Get the last part (ID)
  }
  
  return searchId;
};

const findItemByMultipleCriteria = (allItems, searchId) => {
  const foundItem = allItems.find(item => {
    const matches = {
      byId: item._id === searchId,
      bySku: item.sku === searchId,
      byLotNumber: item.lotNumber === searchId,
      bySkuLower: item.sku && item.sku.toLowerCase() === searchId.toLowerCase(),
      byLotLower: item.lotNumber && item.lotNumber.toLowerCase() === searchId.toLowerCase(),
      // Search in Lots array
      byLotId: item.Lots && item.Lots.some(lot => lot._id === searchId),
      byLotNumberInArray: item.Lots && item.Lots.some(lot => lot.lotNumber === searchId)
    };
    
    return Object.values(matches).some(m => m);
  });
  
  return foundItem;
};

const findMatchedLot = (item, searchId) => {
  if (!item.Lots) return null;
  
  return item.Lots.find(lot => 
    lot._id === searchId || lot.lotNumber === searchId
  );
};

const determineMatchType = (item, searchId, matchedLot) => {
  if (item._id === searchId) return 'id';
  if (item.sku === searchId) return 'sku';
  if (item.lotNumber === searchId) return 'lotNumber';
  if (matchedLot) return 'lot';
  return 'fuzzy';
};

const processItemLookup = async (qrData, allItems) => {
  try {
    const searchId = extractIdFromQRData(qrData);
    const foundItem = findItemByMultipleCriteria(allItems, searchId);
    
    if (foundItem) {
      const matchedLot = findMatchedLot(foundItem, searchId);
      const matchedBy = determineMatchType(foundItem, searchId, matchedLot);
      
      return {
        ...foundItem,
        qrData: qrData,
        matchedBy: matchedBy,
        matchedLot: matchedLot
      };
    }
    
    // If not found, return object with notFound flag
    return { 
      notFound: true, 
      qrData: qrData, 
      searchId: searchId 
    };
    
  } catch (error) {
    console.error('Item lookup error:', error);
    return null;
  }
};

export {
  extractIdFromQRData,
  findItemByMultipleCriteria,
  findMatchedLot,
  determineMatchType,
  processItemLookup
};