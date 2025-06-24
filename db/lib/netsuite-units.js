// lib/netsuite-units.js - NetSuite unit utilities
export const netsuiteUnits = {
    '33': { name: 'Gram', symbol: 'g', type: 'weight' },
    '34': { name: 'Kilogram', symbol: 'kg', type: 'weight' },
    '35': { name: 'Liter', symbol: 'L', type: 'volume' },
    '36': { name: 'Milliliter', symbol: 'mL', type: 'volume' },
    '37': { name: 'Each', symbol: 'ea', type: 'count' },
    '38': { name: 'Pound', symbol: 'lb', type: 'weight' },
    '39': { name: 'Ounce', symbol: 'oz', type: 'weight' },
    '40': { name: 'Gallon', symbol: 'gal', type: 'volume' },
    // Add more mappings as needed based on your NetSuite configuration
  };
  
  // Helper function to map NetSuite unit ID to local symbol
  export function mapNetSuiteUnit(netsuiteUnitId) {
    const unit = netsuiteUnits[netsuiteUnitId];
    return unit ? unit.symbol : 'ea'; // Default to 'ea' if not found
  }