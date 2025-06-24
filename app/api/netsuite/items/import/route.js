// app/api/netsuite/items/import/route.js - Import NetSuite items as local chemicals
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/db/index';
import User from '@/db/schemas/User';
import { Item } from '@/db/schemas/Item';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    await connectMongoDB();
    const user = await User.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export async function POST(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    if (!user.hasNetSuiteAccess()) {
      return NextResponse.json({
        success: false,
        message: 'NetSuite access not configured'
      }, { status: 400 });
    }

    const { netsuiteComponents, createMissing = false } = await request.json();
    
    if (!netsuiteComponents || !Array.isArray(netsuiteComponents)) {
      return NextResponse.json({
        success: false,
        message: 'NetSuite components array required'
      }, { status: 400 });
    }

    await connectMongoDB();
    
    const results = [];
    
    for (const component of netsuiteComponents) {
      try {
        const { itemId, ingredient, itemRefName } = component;
        
        // Check if item already exists by NetSuite ID
        let existing = await Item.findOne({
          netsuiteInternalId: itemId
        });
        
        if (existing) {
          results.push({
            netsuiteId: itemId,
            ingredient: ingredient,
            action: 'exists',
            localItem: {
              _id: existing._id,
              displayName: existing.displayName,
              sku: existing.sku,
              netsuiteInternalId: existing.netsuiteInternalId
            }
          });
          continue;
        }
        
        // Create new item if createMissing is true
        if (createMissing) {
          const newItem = await Item.create({
            sku: itemRefName || `NS-${itemId}`,
            displayName: ingredient || itemRefName || `NetSuite Item ${itemId}`,
            itemType: 'chemical',
            netsuiteInternalId: itemId,
            qtyOnHand: 0,
            lotTracked: true, // Default to lot tracked for chemicals
            uom: 'g' // Default unit
          });
          
          results.push({
            netsuiteId: itemId,
            ingredient: ingredient,
            action: 'created',
            localItem: {
              _id: newItem._id,
              displayName: newItem.displayName,
              sku: newItem.sku,
              netsuiteInternalId: newItem.netsuiteInternalId
            }
          });
        } else {
          results.push({
            netsuiteId: itemId,
            ingredient: ingredient,
            action: 'missing',
            message: 'Local item not found and createMissing is false'
          });
        }
        
      } catch (error) {
        results.push({
          netsuiteId: component.itemId,
          ingredient: component.ingredient,
          action: 'error',
          error: error.message
        });
      }
    }
    
    const summary = {
      total: netsuiteComponents.length,
      existing: results.filter(r => r.action === 'exists').length,
      created: results.filter(r => r.action === 'created').length,
      missing: results.filter(r => r.action === 'missing').length,
      errors: results.filter(r => r.action === 'error').length
    };
    
    return NextResponse.json({
      success: true,
      summary,
      results
    });

  } catch (error) {
    console.error('NetSuite item import error:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}
