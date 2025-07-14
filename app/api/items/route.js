// =============================================================================
// app/api/items/route.js - Complete item operations (FIXED: Standardized Response Format)
// =============================================================================
import { NextResponse } from 'next/server';
import db from '@/db';
import { jwtVerify } from 'jose';
import mongoose from 'mongoose';

// Helper to get authenticated user
async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    
    await db.connect();
    const user = await db.models.User.findById(payload.userId).select('-password');
    
    return user ? { 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    } : null;
  } catch (error) {
    console.error('Auth error in items route:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');
    const lotId = searchParams.get('lotId');

    // Ensure connection
    await db.connect();

      if (action === 'findLot') {
      console.log('🔍 [API] findLot action triggered with lotId:', lotId);
      
      if (!lotId) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'lotId parameter is required'
        }, { status: 400 });
      }

      try {
        console.log('🔍 [API] Searching for lot ID:', lotId);
        
        // Search for an item that contains this lot ID
        // Note: Using "Lots" (capital L) to match your database structure
        const itemWithLot = await db.models.Item.findOne({ 
          "Lots._id": new mongoose.Types.ObjectId(lotId) 
        }).lean();
        
        console.log('📦 [API] Found item with lot:', itemWithLot ? itemWithLot.displayName : 'none');
        
        if (itemWithLot && itemWithLot.Lots) {
          const lot = itemWithLot.Lots.find(l => l._id.toString() === lotId);
          
          console.log('🎯 [API] Found specific lot:', lot ? lot.lotNumber : 'none');
          
          if (lot) {
            const responseData = {
              success: true,
              data: {
                type: 'lot',
                lot: {
                  _id: lot._id.toString(),
                  lotNumber: lot.lotNumber || '',
                  quantity: Number(lot.quantity) || 0,
                  qrCodeUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/${lot._id}`,
                  createdAt: lot.createdAt,
                  updatedAt: lot.updatedAt,
                  expiryDate: lot.expiryDate,
                  receivedDate: lot.receivedDate || lot.createdAt,
                  location: lot.location
                },
                item: {
                  _id: itemWithLot._id.toString(),
                  displayName: itemWithLot.displayName || '',
                  sku: itemWithLot.sku || '',
                  itemType: itemWithLot.itemType || '',
                  uom: itemWithLot.uom || 'ea',
                  description: itemWithLot.description || '',
                  location: itemWithLot.location || '',
                  cost: Number(itemWithLot.cost) || 0,
                  lotTracked: itemWithLot.lotTracked || false
                }
              },
              error: null
            };
            
            console.log('✅ [API] Returning lot data:', JSON.stringify(responseData, null, 2));
            
            return NextResponse.json(responseData);
          }
        }
        
        console.log('❌ [API] Lot not found');
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Lot not found'
        }, { status: 404 });
        
      } catch (error) {
        console.error('❌ [API] Error finding lot:', error);
        return NextResponse.json({
          success: false,
          data: null,
          error: 'Error searching for lot: ' + error.message
        }, { status: 500 });
      }
    }

    if (id) {

if (action === 'lots') {
  // GET /api/items?id=123&action=lots&lotId=456 (optional)
  try {
    console.log('🔍 Getting lots for item:', id, 'lotId:', lotId);
    
    const item = await db.models.Item.findById(id).lean();
    
    if (!item) {
      console.log('❌ Item not found:', id);
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'Item not found'
      }, { status: 404 });
    }
    
    console.log('📦 Item found:', item.displayName, 'Lots count:', item.Lots?.length || 0);
    
    // Transform the lots to match expected format
    let lots = (item.Lots || []).map(lot => ({
      _id: lot._id.toString(),
      id: lot._id.toString(), // Add fallback id field
      lotNumber: lot.lotNumber || '',
      quantity: Number(lot.quantity) || 0,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
      expiryDate: lot.expiryDate,
      receivedDate: lot.receivedDate || lot.createdAt, // Fallback to createdAt
      location: lot.location || item.location, // Fallback to item location
      vendorLotNumber: lot.vendorLotNumber
    }));
    
    // If specific lotId requested, filter to that lot
    if (lotId) {
      lots = lots.filter(lot => lot._id === lotId || lot.id === lotId);
      console.log('🎯 Filtered to specific lot:', lotId, 'Found:', lots.length);
    }
    
    console.log('✅ Returning lots:', lots.length, 'lots');
    
    return NextResponse.json({ 
      success: true, 
      data: {
        lots,
        count: lots.length,
        itemId: id,
        itemName: item.displayName
      },
      error: null
    });
  } catch (error) {
    console.error('❌ Error in lots action:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Error fetching lots: ' + error.message
    }, { status: 500 });
  }
}
      
      if (action === 'transactions') {
        // GET /api/items?id=123&action=transactions
        const options = {
          txnType: searchParams.get('type'),
          startDate: searchParams.get('startDate'),
          endDate: searchParams.get('endDate'),
          status: searchParams.get('status') || 'posted',
          limit: parseInt(searchParams.get('limit')) || 100,
          page: parseInt(searchParams.get('page')) || 1
        };
        
        const transactions = await db.services.txnService.listByItem(id, options);
        
        return NextResponse.json({ 
          success: true, 
          data: {
            transactions,
            count: transactions.length,
            itemId: id,
            options
          },
          error: null
        });
      }
      
      if (action === 'stats') {
        // GET /api/items?id=123&action=stats
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        
        const stats = await db.services.txnService.getItemStats(id, startDate, endDate);
        
        return NextResponse.json({ 
          success: true, 
          data: {
            stats,
            itemId: id,
            period: {
              startDate,
              endDate
            }
          },
          error: null
        });
      }

      if (action === 'with-lots') {
        // GET /api/items?id=123&action=with-lots
        const item = await db.services.itemService.getWithLots(id);
        if (!item) {
          return NextResponse.json({ 
            success: false, 
            data: null,
            error: 'Item not found'
          }, { status: 404 });
        }
        
        return NextResponse.json({ 
          success: true, 
          data: item,
          error: null
        });
      }

      if (action === 'vendors') {
        // GET /api/items?id=123&action=vendors
        const vendors = await db.services.vendorService.getVendorSourcesForItem(id);
        
        return NextResponse.json({ 
          success: true, 
          data: {
            vendors,
            count: vendors.length,
            itemId: id
          },
          error: null
        });
      }
      
      // GET /api/items?id=123 - Get single item
      const item = await db.services.itemService.getById(id);
      if (!item) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'Item not found'
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: true, 
        data: item,
        error: null
      });
    }

    // GET /api/items?type=chemical&search=water&netsuiteId=123
    const query = {
      type: searchParams.get('type'),
      search: searchParams.get('search') || '',
      netsuiteId: searchParams.get('netsuiteId')
    };

    // If no search parameters, list by type with pagination
    if (!query.search && !query.netsuiteId && query.type) {
      const limit = parseInt(searchParams.get('limit')) || 50;
      const skip = parseInt(searchParams.get('skip')) || 0;
      
      const items = await db.services.itemService.listByType(query.type, {
        search: query.search,
        limit,
        skip
      });
      
      return NextResponse.json({ 
        success: true, 
        data: {
          items,
          count: items.length,
          query,
          pagination: { limit, skip }
        },
        error: null
      });
    }

    // Search items
    const items = await db.services.itemService.search(query);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        items,
        count: items.length,
        query
      },
      error: null
    });
    
  } catch (error) {
    console.error('GET items error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');
    const lotId = searchParams.get('lotId');
    
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    await db.connect();
    
    if (id && action === 'transactions') {
      // POST /api/items?id=123&action=transactions&lotId=456
      const { qty, memo, project, department, batchId, workOrderId, unitCost, notes, expiryDate, vendorLotNumber, location } = await request.json();
      
      const delta = Number(qty);
      
      if (!delta || isNaN(delta)) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: 'qty must be a non-zero number'
        }, { status: 400 });
      }

      // Validate item exists
      const item = await db.services.itemService.getById(id);
      if (!item) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'Item not found'
        }, { status: 404 });
      }

      // Validate lot exists if specified and delta is negative (issue)
      if (lotId && delta < 0) {
        const lots = await db.services.itemService.getLots(id, lotId);
        if (lots.length === 0) {
          return NextResponse.json({ 
            success: false,
            data: null,
            error: 'Lot not found'
          }, { status: 404 });
        }

        const lot = lots[0];
        if (lot.availableQty < Math.abs(delta)) {
          return NextResponse.json({ 
            success: false,
            data: null,
            error: `Insufficient quantity. Available: ${lot.availableQty}, Requested: ${Math.abs(delta)}`
          }, { status: 400 });
        }
      }
      
      const txnData = {
        txnType: delta > 0 ? (action === 'adjustment' ? 'adjustment' : 'receipt') : 'issue',
        lines: [{
          item: id,
          lot: lotId,
          qty: delta,
          unitCost,
          notes,
          expiryDate,
          vendorLotNumber,
          location
        }],
        actor: { 
          _id: user._id, 
          name: user.name, 
          email: user.email 
        },
        memo,
        project,
        department: department || user.department || 'Production',
        batchId,
        workOrderId,
        reason: memo || `${delta > 0 ? 'Receipt' : 'Issue'} via API`
      };
      
      const txn = await db.services.txnService.post(txnData);
      const updatedItem = await db.services.itemService.getById(id);
      
      return NextResponse.json({ 
        success: true, 
        data: {
          item: updatedItem, 
          transaction: txn
        },
        error: null,
        message: `Transaction posted: ${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} ${item.uom || 'units'}`
      });
    }

    if (id && action === 'vendor') {
      // POST /api/items?id=123&action=vendor - Link item to vendor
      const { vendorId, vendorSKU, lastPrice, preferred, leadTime, minimumOrderQty } = await request.json();
      
      if (!vendorId) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: 'Vendor ID required'
        }, { status: 400 });
      }

      const vendorItem = await db.services.vendorService.linkVendorItem(vendorId, id, {
        vendorSKU,
        lastPrice,
        preferred,
        leadTime,
        minimumOrderQty
      });
      
      return NextResponse.json({ 
        success: true, 
        data: vendorItem,
        error: null,
        message: 'Item linked to vendor successfully'
      });
    }
    
    // POST /api/items - Create new item
    const body = await request.json();
    
    // Validate required fields
    const { itemType, sku, displayName } = body;
    if (!itemType || !sku || !displayName) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'itemType, sku, and displayName are required'
      }, { status: 400 });
    }

    // Check for duplicate SKU
    const existingItem = await db.models.Item.findOne({ sku });
    if (existingItem) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'An item with this SKU already exists'
      }, { status: 409 });
    }

    // Add creator info
    body.createdBy = user._id;
    
    const item = await db.services.itemService.create(body);
    
    return NextResponse.json({ 
      success: true, 
      data: item,
      error: null,
      message: `${itemType} "${displayName}" created successfully`
    }, { status: 201 });
    
  } catch (error) {
    console.error('POST items error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Item ID required'
      }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    await db.connect();

    // Check if item exists
    const existingItem = await db.services.itemService.getById(id);
    if (!existingItem) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'Item not found'
      }, { status: 404 });
    }
    
    const data = await request.json();
    
    // Add updater info
    data.updatedBy = user._id;
    
    const updated = await db.services.itemService.update(id, data);
    
    return NextResponse.json({ 
      success: true, 
      data: updated,
      error: null,
      message: 'Item updated successfully'
    });
    
  } catch (error) {
    console.error('PATCH items error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const lotId = searchParams.get('lotId');
    const action = searchParams.get('action');
    
    // Get authenticated user and check permissions
    const user = await getAuthUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Admin or manager access required for deletions'
      }, { status: 403 });
    }

    await db.connect();

    if (id && lotId && action === 'lot') {
      // DELETE /api/items?id=123&lotId=456&action=lot
      const item = await db.services.itemService.getById(id);
      if (!item) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'Item not found'
        }, { status: 404 });
      }

      const deleted = await db.services.itemService.deleteLot(id, lotId);
      
      return NextResponse.json({
        success: true,
        data: {
          deletedLot: deleted,
          itemId: id
        },
        error: null,
        message: `Lot ${deleted.lotNumber} deleted successfully`
      });
    }

    if (id) {
      // DELETE /api/items?id=123
      const item = await db.services.itemService.getById(id);
      if (!item) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'Item not found'
        }, { status: 404 });
      }

      const body = await request.json().catch(() => ({}));
      const forceDelete = body.force === true;

      // Check for active inventory
      if (item.qtyOnHand > 0 && !forceDelete) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: `Cannot delete item with ${item.qtyOnHand} units on hand. Use force=true to override or adjust quantity to zero first.`
        }, { status: 400 });
      }

      // Check for recent transactions
      const recentTransactions = await db.services.txnService.listByItem(id, { 
        limit: 1,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      });

      if (recentTransactions.length > 0 && !forceDelete) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: 'Item has recent transaction history. Use force=true to override.'
        }, { status: 400 });
      }

      await db.services.itemService.delete(id, forceDelete);
      
      return NextResponse.json({ 
        success: true, 
        data: {
          deletedItem: {
            _id: item._id,
            sku: item.sku,
            displayName: item.displayName,
            itemType: item.itemType
          }
        },
        error: null,
        message: `Item "${item.displayName}" deleted successfully`
      });
    }

    return NextResponse.json({ 
      success: false,
      data: null,
      error: 'Invalid delete request'
    }, { status: 400 });
    
  } catch (error) {
    console.error('DELETE items error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}