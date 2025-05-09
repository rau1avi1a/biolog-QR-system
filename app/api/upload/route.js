// app/api/upload/route.js
import { NextResponse } from 'next/server';
import { parse }       from 'csv-parse/sync';
import connectMongoDB  from '@/lib/index';
import { Item }        from '@/models/Item';

const readFile = async (file) => {
  const buf = await file.arrayBuffer();
  return Buffer.from(buf).toString('utf-8');
};

function parseLots(lotString) {
  if (!lotString) return [];
  return lotString.split(',').flatMap(part => {
    const m = part.trim().match(/([A-Za-z0-9-]+)\(([^)]+)\)/);
    if (!m) return [];
    const qty = parseFloat(m[2]);
    return isNaN(qty)
      ? []
      : [{ LotNumber: m[1], Quantity: qty }];
  });
}

function parseCSVToItems(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const hdr = lines.findIndex(l => /^Item\s*,/i.test(l));
  if (hdr < 0) throw new Error('CSV header row not found');
  const data = lines.slice(hdr + 1).join('\n');
  const records = parse(data, {
    columns: ['sku', 'displayName', 'lotString'],
    skip_empty_lines: true,
    trim: true
  });
  return records.map(r => ({
    sku:          r.sku,
    displayName:  r.displayName,
    lots:         parseLots(r.lotString)
  }));
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) {
      return NextResponse.json({ error: 'No CSV uploaded' }, { status: 400 });
    }
    const text = await readFile(file);
    const items = parseCSVToItems(text);
    if (!items.length) {
      return NextResponse.json({ error: 'No valid rows' }, { status: 400 });
    }

    await connectMongoDB();

    let created = 0, updated = 0;
    for (const { sku, displayName, lots } of items) {
      let doc = await Item.findOne({ sku });
      if (!doc) {
        // Create new chemical item
        doc = await Item.create({
          sku,
          displayName,
          itemType:   'chemical',
          uom:        'ea',
          lotTracked: true,
          qtyOnHand:  lots.reduce((sum, l) => sum + l.Quantity, 0),
          Lots:       lots
        });
        created++;
      } else {
        // Existing: merge fields and lots
        doc.itemType   = doc.itemType   || 'chemical';
        doc.uom        = doc.uom        || 'ea';
        doc.lotTracked = doc.lotTracked != null ? doc.lotTracked : true;
        doc.Lots       = Array.isArray(doc.Lots) ? doc.Lots : [];

        let deltaTotal = 0;
        for (const lot of lots) {
          const exist = doc.Lots.find(l => l.LotNumber === lot.LotNumber);
          if (exist) {
            deltaTotal += (lot.Quantity - exist.Quantity);
            exist.Quantity = lot.Quantity;
          } else {
            deltaTotal += lot.Quantity;
            doc.Lots.push(lot);
          }
        }
        doc.qtyOnHand = (doc.qtyOnHand || 0) + deltaTotal;
        await doc.save();
        updated++;
      }
    }

    return NextResponse.json({
      message: `Upload complete: ${created} created, ${updated} updated.`,
      created,
      updated
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
