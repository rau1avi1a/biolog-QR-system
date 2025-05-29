import { NextResponse } from 'next/server';
import dbConnect        from '@/lib/index';
import { Item }         from '@/models/Item';
import { createItem }   from '@/services/item.service';

// simple regex‐escape helper
const escapeRegExp = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await dbConnect();

    // Fix: More robust URL handling
    let searchParams;
    try {
      // Try to parse as absolute URL first
      const url = new URL(request.url);
      searchParams = url.searchParams;
    } catch (urlError) {
      // If that fails, try with a base URL
      try {
        const url = new URL(request.url, 'http://localhost:3000');
        searchParams = url.searchParams;
      } catch (baseUrlError) {
        // Fallback: create empty URLSearchParams
        searchParams = new URLSearchParams();
      }
    }
    
    const type       = searchParams.get('type');       // chemical|solution|product
    const searchRaw  = searchParams.get('search') || '';

    const q = {};
    if (type) q.itemType = type;
    if (searchRaw) {
      // escape any regex metas so (+), etc. don't break the query
      const escaped = escapeRegExp(searchRaw);
      q.displayName = { $regex: escaped, $options: 'i' };
    }

    const items = await Item.find(q)
      .sort({ displayName: 1 })
      .select('_id displayName sku')
      .lean();

    return NextResponse.json({ items });
  } catch (err) {
    // Removed console.error as requested
    // always return JSON so front-end res.json() won't fail
    return NextResponse.json(
      { items: [], error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();  // { itemType, sku, displayName, bom? }
    const item = await createItem(body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    // Removed console.error as requested
    return NextResponse.json(
      { error: err.message },
      { status: 400 }
    );
  }
}