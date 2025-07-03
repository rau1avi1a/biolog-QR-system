// db/lib/netsuite-units.js - Enhanced unit mapping
export const netsuiteUnits = {
  // Weight units
  '33': { name: 'Gram', symbol: 'g', type: 'weight', conversionRate: 1 },
  '34': { name: 'Kilogram', symbol: 'kg', type: 'weight', conversionRate: 1000 },
  '38': { name: 'Pound', symbol: 'lb', type: 'weight', conversionRate: 453.592 },
  '39': { name: 'Ounce', symbol: 'oz', type: 'weight', conversionRate: 28.3495 },
  
  // Volume units  
  '35': { name: 'Milliliter', symbol: 'mL', type: 'volume', conversionRate: 1 },
  '36': { name: 'Liter', symbol: 'L', type: 'volume', conversionRate: 1000 },
  '40': { name: 'Gallon', symbol: 'gal', type: 'volume', conversionRate: 3785.41 },
  '41': { name: 'Fluid Ounce', symbol: 'fl oz', type: 'volume', conversionRate: 29.5735 },
  '42': { name: 'Pint', symbol: 'pt', type: 'volume', conversionRate: 473.176 },
  '43': { name: 'Quart', symbol: 'qt', type: 'volume', conversionRate: 946.353 },
  
  // Count units
  '37': { name: 'Each', symbol: 'ea', type: 'count', conversionRate: 1 },
  '44': { name: 'Dozen', symbol: 'dz', type: 'count', conversionRate: 12 },
  '45': { name: 'Case', symbol: 'case', type: 'count', conversionRate: 1 },
  '46': { name: 'Box', symbol: 'box', type: 'count', conversionRate: 1 },
  
  // Length units
  '47': { name: 'Meter', symbol: 'm', type: 'length', conversionRate: 1 },
  '48': { name: 'Centimeter', symbol: 'cm', type: 'length', conversionRate: 0.01 },
  '49': { name: 'Millimeter', symbol: 'mm', type: 'length', conversionRate: 0.001 },
  '50': { name: 'Inch', symbol: 'in', type: 'length', conversionRate: 0.0254 },
  '51': { name: 'Foot', symbol: 'ft', type: 'length', conversionRate: 0.3048 },
  
  // Add more mappings as needed based on your NetSuite configuration
};

// Helper function to map NetSuite unit ID to local symbol
export function mapNetSuiteUnit(netsuiteUnitId) {
  const unit = netsuiteUnits[netsuiteUnitId];
  return unit ? unit.symbol : 'ea'; // Default to 'ea' if not found
}

// Helper function to get full unit info
export function getNetSuiteUnitInfo(netsuiteUnitId) {
  return netsuiteUnits[netsuiteUnitId] || { 
    name: 'Unknown', 
    symbol: 'ea', 
    type: 'unknown', 
    conversionRate: 1 
  };
}

// Helper function to convert units back to NetSuite ID (for work orders)
export function getNetSuiteUnitId(symbol) {
  for (const [id, unit] of Object.entries(netsuiteUnits)) {
    if (unit.symbol === symbol) {
      return id;
    }
  }
  return '37'; // Default to 'ea' ID
}

// Validate NetSuite unit ID
export function isValidNetSuiteUnit(unitId) {
  return netsuiteUnits.hasOwnProperty(unitId);
}