// app/api/upload/route.js
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectMongoDB from '@/lib/index';
import { Item, Chemical, Solution, Product } from '@/models/Item';

/**
 * Read uploaded File object into UTF-8 string
 */
const readFile = async (file) => {
  const buf = await file.arrayBuffer();
  return Buffer.from(buf).toString('utf-8');
};

/**
 * Original chemical lot-string parsing logic (unchanged)
 */
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
      return isNaN(qty) ? [] : [{ lotNumber: match[1].trim(), quantity: qty }];
    }
    // Format 2: LOT123:10.5
    match = trimmed.match(/([A-Za-z0-9-]+):([0-9.]+)/);
    if (match) {
      const qty = parseFloat(match[2]);
      return isNaN(qty) ? [] : [{ lotNumber: match[1].trim(), quantity: qty }];
    }
    // Format 3: Just lot number (assume quantity 1)
    if (/^[A-Za-z0-9-]+$/.test(trimmed)) {
      return [{ lotNumber: trimmed, quantity: 1 }];
    }
    console.warn(`Could not parse lot string: "${trimmed}"`);
    return [];
  });
}

/**
 * Parse CSV for chemical items, preserving original logic
 * Expects header row matching /^Item\s*,/ and columns: sku, displayName, lotString
 */
function parseCSVToChemicals(csv) {
  console.log('Parsing CSV for chemicals...');
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const hdr = lines.findIndex(l => /^Item\s*,/i.test(l));
  if (hdr < 0) throw new Error('CSV header row not found');
  const data = lines.slice(hdr + 1).join('\n');
  const records = parse(data, {
    columns: ['sku','displayName','lotString'],
    skip_empty_lines: true,
    trim: true
  });
  const items = records.map(r => ({
    sku: r.sku?.trim()?.toUpperCase(),
    displayName: r.displayName?.trim(),
    lots: parseLots(r.lotString)
  })).filter(item => item.sku && item.displayName);
  console.log(`Parsed ${items.length} chemical items from CSV`);
  return items;
}

/**
 * Parse CSV for solutions/products (flat four-column format)
 * Columns: sku, displayName, lotNumber, quantity
 */
function parseCSVToInventory(csv) {
  console.log('Parsing CSV for inventory (solutions/products)...');
  const records = parse(csv, {
    columns: ['sku','displayName','lotNumber','quantity'],
    skip_empty_lines: true,
    trim: true
  });
  const map = new Map();
  for (const r of records) {
    const sku = r.sku?.trim()?.toUpperCase();
    const displayName = r.displayName?.trim();
    const lotNum = r.lotNumber?.trim();
    const qty = parseFloat(r.quantity);
    if (!sku || !displayName || !lotNum || isNaN(qty)) continue;
    if (!map.has(sku)) {
      map.set(sku, { sku, displayName, lots: [] });
    }
    map.get(sku).lots.push({ lotNumber: lotNum, quantity: qty });
  }
  const items = Array.from(map.values());
  console.log(`Parsed ${items.length} inventory items from CSV`);
  return items;
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'chemical';
    console.log(`Upload type: ${type}`);
    const form = await req.formData();
    const file = form.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });
    }
    console.log('Processing uploaded file:', file.name);
    const text = await readFile(file);
    const items = type === 'chemical'
      ? parseCSVToChemicals(text)
      : parseCSVToInventory(text);
    if (!items.length) {
      return NextResponse.json({ error: 'No valid rows found in CSV' }, { status: 400 });
    }
    await connectMongoDB();
    const Model = type === 'chemical'
      ? Chemical
      : type === 'solution'
        ? Solution
        : Product;
    let created = 0, updated = 0, errors = [];
    for (const { sku, displayName, lots } of items) {
      console.log(`Processing SKU ${sku}: ${displayName}, ${lots.length} lots`);
      try {
        let doc = await Item.findOne({ sku });
        if (!doc) {
          console.log(`Creating new ${type}: ${sku}`);
          const total = lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
          doc = await Model.create({
            sku,
            displayName,
            itemType: type,
            lotTracked: true,
            qtyOnHand: total,
            Lots: lots
          });
          created++;
          console.log(`✓ Created ${sku} with total qty ${doc.qtyOnHand}`);
        } else {
          if (doc.itemType !== type) {
            console.warn(`Skipping ${sku} - type mismatch (${doc.itemType})`);
            continue;
          }
          console.log(`Updating existing ${type}: ${sku}`);
          doc.displayName = displayName;
          doc.lotTracked = true;
          if (!Array.isArray(doc.Lots)) doc.Lots = [];
          for (const newLot of lots) {
            const idx = doc.Lots.findIndex(l => l.lotNumber === newLot.lotNumber);
            if (idx >= 0) {
              doc.Lots[idx].quantity = newLot.quantity;
              console.log(`  Updated lot ${newLot.lotNumber} to ${newLot.quantity}`);
            } else {
              doc.Lots.push(newLot);
              console.log(`  Added lot ${newLot.lotNumber}: ${newLot.quantity}`);
            }
          }
          doc.qtyOnHand = doc.Lots.reduce((sum, l) => sum + (l.quantity || 0), 0);
          await doc.save();
          updated++;
          console.log(`✓ Updated ${sku} - new total qty ${doc.qtyOnHand}`);
        }
        // Optional verification log
        const saved = await Model.findOne({ sku }).lean();
        console.log(`Verification ${sku}:`, saved.Lots.map(l => `${l.lotNumber}(${l.quantity})`).join(', '));
      } catch (e) {
        console.error(`Error processing ${sku}:`, e);
        errors.push(`${sku}: ${e.message}`);
      }
    }
    const response = {
      message: `Upload complete: ${created} created, ${updated} updated.`,
      created,
      updated,
      total: items.length
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
