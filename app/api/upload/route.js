// =============================================================================
// app/api/upload/route.js - CSV Upload Handler for Solution Inventory (FIXED: Standardized Response Format)
// =============================================================================
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper to get authenticated user
async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    
      const { default: db } = await import('@/db');
  await db.connect();
    const user = await db.models.User.findById(payload.userId).select('-password');
    
    return user ? { 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    } : null;
  } catch (error) {
    console.error('Auth error in upload route:', error);
    return null;
  }
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    if (type === 'product' || type === 'solution') {
      return await handleSolutionInventoryUpload(request, user, type);
    }

    return NextResponse.json({ 
      success: false,
      data: null,
      error: 'Invalid upload type. Supported types: product, solution'
    }, { status: 400 });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

async function handleSolutionInventoryUpload(request, user, itemType) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Parse CSV
    const text = await file.text();
    const Papa = await import('papaparse');
    
    const parsed = Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';']
    });

    if (parsed.errors.length > 0) {
      console.warn('CSV parsing warnings:', parsed.errors);
    }

    if (!parsed.data || parsed.data.length === 0) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'No data found in CSV file'
      }, { status: 400 });
    }

    // Validate CSV structure
    const requiredColumns = ['Name', 'Display Name', 'Internal ID'];
    const headers = Object.keys(parsed.data[0]);
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        success: false,
        data: {
          foundColumns: headers,
          missingColumns
        },
        error: `Missing required columns: ${missingColumns.join(', ')}`
      }, { status: 400 });
    }

    // Process the data
    const results = await processSolutionInventoryData(parsed.data, user, itemType);
    
    return NextResponse.json({
      success: true,
      data: results,
      error: null,
      message: `Successfully processed ${results.totalRows} rows`
    });
    
  } catch (error) {
    console.error('Solution inventory upload error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Failed to process solution inventory file',
      message: error.message 
    }, { status: 500 });
  }
}

async function processSolutionInventoryData(csvData, user, itemType) {
    const { default: db } = await import('@/db');
  await db.connect();
  
  const results = {
    totalRows: csvData.length,
    processedItems: 0,
    createdItems: 0,
    updatedItems: 0,
    lotsProcessed: 0,
    lotsCreated: 0,
    skippedZeroQuantity: 0,
    errors: []
  };

  // Group by item (Name + Display Name + Internal ID combination)
  const itemGroups = new Map();
  
  csvData.forEach((row, index) => {
    const sku = row['Name']?.toString().trim();
    const displayName = row['Display Name']?.toString().trim();
    const netsuiteInternalId = row['Internal ID']?.toString();
    const lotNumber = row['Number']?.toString().trim();
    const onHand = parseFloat(row['On Hand']) || 0;
    
    if (!sku || !displayName || !netsuiteInternalId) {
      results.errors.push({
        row: index + 1,
        error: 'Missing required fields (Name, Display Name, or Internal ID)'
      });
      return;
    }
    
    const itemKey = `${sku}-${netsuiteInternalId}`;
    
    if (!itemGroups.has(itemKey)) {
      itemGroups.set(itemKey, {
        sku,
        displayName,
        netsuiteInternalId,
        lots: []
      });
    }
    
    // Add lot if it has quantity > 0 or if it's the only lot for this item
    if (onHand > 0 || lotNumber) {
      itemGroups.get(itemKey).lots.push({
        lotNumber: lotNumber || 'DEFAULT',
        quantity: onHand,
        rowIndex: index + 1
      });
    }
  });

  // Process each unique item
  for (const [itemKey, itemData] of itemGroups) {
    try {
      await processItem(itemData, user, itemType, results);
    } catch (error) {
      results.errors.push({
        sku: itemData.sku,
        error: `Failed to process item: ${error.message}`
      });
    }
  }
  
  return results;
}

async function processItem(itemData, user, itemType, results) {
  const { sku, displayName, netsuiteInternalId, lots } = itemData;
  
  // Check if item already exists
  let existingItem = await db.models.Item.findOne({ 
    sku,
    netsuiteInternalId 
  });
  
  if (!existingItem) {
    // Create new item
    const itemPayload = {
      itemType: itemType === 'product' ? 'product' : 'solution',
      sku,
      displayName,
      netsuiteInternalId,
      lotTracked: lots.length > 0,
      uom: 'ea', // Default unit
      qtyOnHand: 0,
      createdBy: user._id
    };
    
    existingItem = await db.services.itemService.create(itemPayload);
    results.createdItems++;
    console.log(`Created new ${itemType}: ${sku} - ${displayName}`);
  } else {
    // Update existing item
    await db.services.itemService.update(existingItem._id, {
      displayName, // Update display name in case it changed
      netsuiteInternalId, // Ensure NetSuite ID is set
      updatedBy: user._id
    });
    results.updatedItems++;
    console.log(`Updated existing ${itemType}: ${sku} - ${displayName}`);
  }
  
  // Process lots
  const nonZeroLots = lots.filter(lot => lot.quantity > 0);
  
  if (nonZeroLots.length > 0) {
    // Make sure item is lot-tracked
    if (!existingItem.lotTracked) {
      await db.models.Item.findByIdAndUpdate(existingItem._id, { 
        lotTracked: true,
        Lots: []
      });
    }
    
    // Reload item to get current lots
    const itemWithLots = await db.models.Item.findById(existingItem._id);
    if (!itemWithLots.Lots) {
      itemWithLots.Lots = [];
    }
    
    for (const lotData of nonZeroLots) {
      const { lotNumber, quantity } = lotData;
      
      // Check if lot already exists
      let existingLot = itemWithLots.Lots.find(l => l.lotNumber === lotNumber);
      
      if (existingLot) {
        // Update existing lot quantity
        existingLot.quantity = quantity;
        console.log(`Updated lot ${lotNumber} for ${sku}: ${quantity}`);
      } else {
        // Create new lot
        itemWithLots.Lots.push({
          lotNumber,
          quantity,
          location: 'Inventory', // Default location
          expiryDate: null
        });
        results.lotsCreated++;
        console.log(`Created new lot ${lotNumber} for ${sku}: ${quantity}`);
      }
      
      results.lotsProcessed++;
    }
    
    // Recalculate total quantity
    itemWithLots.qtyOnHand = itemWithLots.Lots.reduce((sum, lot) => sum + (lot.quantity || 0), 0);
    
    // Save the item with updated lots
    await itemWithLots.save();
  }
  
  // Count skipped zero quantity lots
  const zeroQuantityLots = lots.filter(lot => lot.quantity === 0);
  results.skippedZeroQuantity += zeroQuantityLots.length;
  
  results.processedItems++;
}

// Also handle GET for upload form or status
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  
  if (type === 'product' || type === 'solution') {
    return NextResponse.json({
      success: true,
      data: {
        uploadType: type,
        expectedFormat: {
          columns: [
            { name: 'Name', description: 'Item SKU', required: true },
            { name: 'Display Name', description: 'Item display name', required: true },
            { name: 'Type', description: 'Item type (not stored)', required: false },
            { name: 'Internal ID', description: 'NetSuite Internal ID', required: true },
            { name: 'Number', description: 'Lot number', required: false },
            { name: 'On Hand', description: 'Lot quantity', required: false }
          ],
          notes: [
            'Multiple rows with same Name/Internal ID will be treated as different lots',
            'Lots with 0 quantity will be skipped',
            'Items will be created even if no lots have quantity',
            'Existing items will be updated with new NetSuite ID and lots'
          ]
        }
      },
      error: null
    });
  }
  
  return NextResponse.json({
    success: false,
    data: null,
    error: 'Invalid upload type. Supported types: product, solution'
  }, { status: 400 });
}