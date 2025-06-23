// app/api/items/route.js - Debug version to see all fields
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
      // FIXED: Use partial matching instead of exact regex
      const escaped = escapeRegExp(searchRaw);
      q.displayName = { $regex: escaped, $options: 'i' };
    }

    // DEBUG: Let's see what fields are actually available
    console.log('Searching for items with query:', q);
    console.log('Search term:', searchRaw);
    
    // First, let's get ONE item with ALL fields to see what's available
    const debugItem = await Item.findOne(q).lean();
    console.log('Sample item with ALL fields:', debugItem ? 'Found item' : 'No item found');
    if (debugItem) {
      console.log('Sample item fields:', Object.keys(debugItem));
      console.log('NetSuite ID in sample:', debugItem.netsuiteInternalId);
    }

    // Now get the items with explicit fields
    const items = await Item.find(q)
      .sort({ displayName: 1 })
      .select('_id displayName sku netsuiteInternalId') // Include netsuiteInternalId
      .lean();

    console.log('Items returned:', items.length);
    if (items.length > 0) {
      console.log('First item fields:', Object.keys(items[0]));
      console.log('First item NetSuite ID:', items[0].netsuiteInternalId);
    }

    return NextResponse.json({ 
      items,
      debug: {
        query: q,
        sampleItem: debugItem,
        itemCount: items.length
      }
    });
  } catch (err) {
    console.error('Items API error:', err);
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
    return NextResponse.json(
      { error: err.message },
      { status: 400 }
    );
  }
}