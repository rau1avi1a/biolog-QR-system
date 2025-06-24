// app/api/upload/route.js - Simplified for NetSuite format only
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectMongoDB from '@/db/index';
import { Item, Chemical, Solution, Product } from '@/db/schemas/Item';

/**
 * Read uploaded File object into UTF-8 string
 */
const readFile = async (file) => {
  const buf = await file.arrayBuffer();
  return Buffer.from(buf).toString('utf-8');
};

/**
 * Parse NetSuite CSV format
 * Columns: Name, Display Name, Type, Internal ID, Number, On Hand
 * One row = one lot for one item
 */
function parseNetSuiteCSV(csv) {
  console.log('Parsing NetSuite CSV...');
  
  const records = parse(csv, {
    columns: true, // Use first row as headers
    skip_empty_lines: true,
    trim: true
  });
  
  const itemsMap = new Map();
  
  for (const record of records) {
    const sku = record.Name?.trim()?.toUpperCase();
    const displayName = record['Display Name']?.trim();
    const type = record.Type?.trim();
    const netsuiteInternalId = record['Internal ID']?.trim();
    const lotNumber = record.Number?.trim();
    const onHand = parseFloat(record['On Hand']) || 0;
    
    if (!sku || !netsuiteInternalId) {
      console.warn(`Skipping row - missing SKU or Internal ID:`, record);
      continue;
    }
    
    // Initialize item if we haven't seen it yet
    if (!itemsMap.has(sku)) {
      itemsMap.set(sku, {
        sku,
        displayName,
        type,
        netsuiteInternalId,
        lots: []
      });
    }
    
    // Only add lots with non-zero quantities (but still create the item)
    if (lotNumber && onHand > 0) {
      itemsMap.get(sku).lots.push({
        lotNumber,
        quantity: onHand
      });
      console.log(`  Added lot ${lotNumber}: ${onHand} for ${sku}`);
    } else if (lotNumber && onHand === 0) {
      console.log(`  Skipped zero-quantity lot ${lotNumber} for ${sku}`);
    }
  }
  
  const items = Array.from(itemsMap.values());
  console.log(`Parsed ${items.length} items from NetSuite CSV`);
  return items;
}

/**
 * Determine item type from NetSuite Type field
 */
function determineItemType(netsuiteType) {
  if (!netsuiteType) return 'chemical'; // default
  
  const type = netsuiteType.toLowerCase();
  if (type.includes('solution')) return 'solution';
  if (type.includes('product')) return 'product';
  return 'chemical'; // default
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'chemical'; // This comes from the upload button
    
    console.log(`Processing NetSuite CSV upload, target type: ${type}`);
    
    const form = await req.formData();
    const file = form.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });
    }
    
    console.log('Processing uploaded file:', file.name);
    const text = await readFile(file);
    
    const items = parseNetSuiteCSV(text);
    
    if (!items.length) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }
    
    await connectMongoDB();
    
    let created = 0, updated = 0, errors = [];
    
    for (const itemData of items) {
      const { sku, displayName, type: csvType, netsuiteInternalId, lots } = itemData;
      
      console.log(`Processing ${sku}: ${displayName} (${lots.length} lots)`);
      
      try {
        let doc = await Item.findOne({ sku });
        
        if (!doc) {
          // Create new item
          console.log(`Creating new item: ${sku} as ${type}`);
          
          // Use the type from the URL parameter (from the tab you're on)
          const itemType = type; // Use the type from the upload button, not CSV
          const Model = itemType === 'chemical' ? Chemical : 
                       itemType === 'solution' ? Solution : Product;
          
          const totalQty = lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
          
          const docData = {
            sku,
            displayName,
            itemType,
            netsuiteInternalId,
            lotTracked: lots.length > 0,
            qtyOnHand: totalQty,
            Lots: lots
          };
          
          doc = await Model.create(docData);
          created++;
          console.log(`✓ Created ${sku} with ${lots.length} lots, total qty: ${totalQty}`);
          
        } else {
          // Update existing item
          console.log(`Updating existing item: ${sku}`);
          
          doc.displayName = displayName;
          doc.netsuiteInternalId = netsuiteInternalId;
          doc.lotTracked = lots.length > 0;
          
          // Replace lots entirely with new data from CSV
          doc.Lots = lots;
          doc.qtyOnHand = lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
          
          await doc.save();
          updated++;
          console.log(`✓ Updated ${sku} with ${lots.length} lots, total qty: ${doc.qtyOnHand}`);
        }
        
      } catch (e) {
        console.error(`Error processing ${sku}:`, e);
        errors.push(`${sku}: ${e.message}`);
      }
    }
    
    const response = {
      message: `Upload complete: ${created} created, ${updated} updated.`,
      created,
      updated,
      total: items.length,
      details: {
        itemsProcessed: items.length,
        totalLots: items.reduce((sum, item) => sum + item.lots.length, 0)
      }
    };
    
    if (errors.length) {
      response.errors = errors;
      response.message += ` ${errors.length} errors occurred.`;
    }
    
    console.log('Upload result:', response);
    return NextResponse.json(response);
    
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}