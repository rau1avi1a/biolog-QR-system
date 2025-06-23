// app/api/netsuite/units/route.js - NetSuite unit mapping reference
import { NextResponse } from 'next/server';
import { netsuiteUnits } from '@/lib/netsuite-units';

export const dynamic = 'force-dynamic';

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