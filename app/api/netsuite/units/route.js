// app/api/netsuite/units/route.js - NetSuite unit mapping reference
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// NetSuite unit mappings (you can expand this based on your NetSuite setup)
const netsuiteUnits = {
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get('id');
    const type = searchParams.get('type'); // 'weight', 'volume', 'count'
    
    if (unitId) {
      // Get specific unit by ID
      const unit = netsuiteUnits[unitId];
      if (!unit) {
        return NextResponse.json({
          success: false,
          error: `Unit ID ${unitId} not found`
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        unit: { id: unitId, ...unit }
      });
    }
    
    // Get all units, optionally filtered by type
    let units = Object.entries(netsuiteUnits).map(([id, unit]) => ({
      id,
      ...unit
    }));
    
    if (type) {
      units = units.filter(unit => unit.type === type);
    }
    
    return NextResponse.json({
      success: true,
      units
    });
    
  } catch (error) {
    console.error('NetSuite units error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Helper function to map NetSuite unit ID to local symbol
export function mapNetSuiteUnit(netsuiteUnitId) {
  const unit = netsuiteUnits[netsuiteUnitId];
  return unit ? unit.symbol : 'ea'; // Default to 'ea' if not found
}