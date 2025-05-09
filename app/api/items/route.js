import { NextResponse } from 'next/server';
import dbConnect        from '@/lib/index';
import { Item }         from '@/models/Item';
import { createItem }   from '@/services/item.service';

/* ───────────── GET: list / search items ───────────── */
export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const type   = searchParams.get('type');      // chemical|solution|product
  const search = searchParams.get('search');    // free-text

  const q = {};
  if (type)   q.itemType      = type;
  if (search) q.displayName   = { $regex: search, $options: 'i' };

  const items = await Item.find(q).sort({ displayName: 1 }).lean();
  return NextResponse.json({ items });
}

/* ───────────── POST: create new item ──────────────── */
export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();         // { itemType, sku, displayName, bom? }
    const item = await createItem(body);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
