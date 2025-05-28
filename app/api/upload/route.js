// app/api/upload/route.js
import { NextResponse } from 'next/server';
import { parse }       from 'csv-parse/sync';
import connectMongoDB  from '@/lib/index';
import { Item, Chemical } from '@/models/Item'; // Import Chemical discriminator

const readFile = async (file) => {
  const buf = await file.arrayBuffer();
  return Buffer.from(buf).toString('utf-8');
};

function parseLots(lotString) {
  if (!lotString) return [];
  return lotString.split(',').flatMap(part => {
    const trimmed = part.trim();
    if (!trimmed) return [];
    
    // Handle different lot string formats
    // Format 1: LOT123(10.5)
    let match = trimmed.match(/([A-Za-z0-9-]+)\(([^)]+)\)/);
    if (match) {
      const qty = parseFloat(match[2]);
      return isNaN(qty) ? [] : [{
        lotNumber: match[1].trim(),
        quantity: qty
      }];
    }
    
    // Format 2: LOT123:10.5
    match = trimmed.match(/([A-Za-z0-9-]+):([0-9.]+)/);
    if (match) {
      const qty = parseFloat(match[2]);
      return isNaN(qty) ? [] : [{
        lotNumber: match[1].trim(),
        quantity: qty
      }];
    }
    
    // Format 3: Just lot number (assume quantity 1)
    if (/^[A-Za-z0-9-]+$/.test(trimmed)) {
      return [{
        lotNumber: trimmed,
        quantity: 1
      }];
    }
    
    console.warn(`Could not parse lot string: "${trimmed}"`);
    return [];
  });
}

function parseCSVToItems(csv) {
  console.log('Parsing CSV...');
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const hdr = lines.findIndex(l => /^Item\s*,/i.test(l));
  if (hdr < 0) throw new Error('CSV header row not found');
  
  const data = lines.slice(hdr + 1).join('\n');
  const records = parse(data, {
    columns: ['sku', 'displayName', 'lotString'],
    skip_empty_lines: true,
    trim: true
  });
  
  const items = records.map(r => ({
    sku: r.sku?.trim()?.toUpperCase(),
    displayName: r.displayName?.trim(),
    lots: parseLots(r.lotString)
  })).filter(item => item.sku && item.displayName);
  
  console.log(`Parsed ${items.length} items from CSV`);
  return items;
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'No CSV uploaded' }, { status: 400 });
    }
    
    console.log('Processing uploaded file:', file.name);
    const text = await readFile(file);
    const items = parseCSVToItems(text);
    
    if (!items.length) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }

    await connectMongoDB();

    let created = 0, updated = 0, errors = [];
    
    for (const { sku, displayName, lots } of items) {
      try {
        console.log(`Processing ${sku}: ${displayName} with ${lots.length} lots`);
        
        // First check if item exists (using base Item model)
        let doc = await Item.findOne({ sku });
        
        if (!doc) {
          // Create new chemical using Chemical discriminator
          console.log(`Creating new chemical: ${sku}`);
          doc = await Chemical.create({
            sku,
            displayName,
            itemType: 'chemical',
            uom: 'ea',
            lotTracked: true,
            qtyOnHand: lots.reduce((sum, l) => sum + (l.quantity || 0), 0),
            Lots: lots.map(lot => ({
              lotNumber: lot.lotNumber,
              quantity: lot.quantity
            }))
          });
          created++;
          console.log(`✓ Created ${sku} with ${lots.length} lots, total qty: ${doc.qtyOnHand}`);
          
        } else {
          // Update existing item - but make sure it's a chemical
          if (doc.itemType !== 'chemical') {
            console.warn(`Skipping ${sku} - not a chemical (type: ${doc.itemType})`);
            continue;
          }
          
          console.log(`Updating existing chemical: ${sku}`);
          
          // Update basic fields
          doc.displayName = displayName;
          doc.lotTracked = true;
          
          // Initialize Lots array if it doesn't exist
          if (!Array.isArray(doc.Lots)) {
            doc.Lots = [];
          }

          // Merge lots - update existing or add new
          for (const newLot of lots) {
            const existingLotIndex = doc.Lots.findIndex(l => l.lotNumber === newLot.lotNumber);
            if (existingLotIndex >= 0) {
              // Update existing lot
              doc.Lots[existingLotIndex].quantity = newLot.quantity;
              console.log(`  Updated lot ${newLot.lotNumber}: ${newLot.quantity}`);
            } else {
              // Add new lot
              doc.Lots.push({
                lotNumber: newLot.lotNumber,
                quantity: newLot.quantity
              });
              console.log(`  Added lot ${newLot.lotNumber}: ${newLot.quantity}`);
            }
          }
          
          // Recalculate total quantity
          doc.qtyOnHand = doc.Lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
          
          await doc.save();
          updated++;
          console.log(`✓ Updated ${sku} - ${doc.Lots.length} lots, total qty: ${doc.qtyOnHand}`);
        }
        
        // Verify the save worked
        const savedDoc = await Chemical.findOne({ sku }).lean();
        if (savedDoc && savedDoc.Lots) {
          console.log(`Verification for ${sku}:`, savedDoc.Lots.map(l => `${l.lotNumber}(${l.quantity})`).join(', '));
        }
        
      } catch (itemError) {
        console.error(`Error processing item ${sku}:`, itemError);
        errors.push(`${sku}: ${itemError.message}`);
      }
    }

    const response = {
      message: `Upload complete: ${created} created, ${updated} updated.`,
      created,
      updated,
      totalProcessed: items.length
    };
    
    if (errors.length > 0) {
      response.errors = errors;
      response.message += ` ${errors.length} errors occurred.`;
    }

    console.log('Upload completed:', response);
    return NextResponse.json(response);
    
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: err.message 
    }, { status: 500 });
  }
}