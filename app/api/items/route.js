// app/api/items/route.js - Enhanced with NetSuite ID search
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
    const netsuiteId = searchParams.get('netsuiteId'); // Search by NetSuite Internal ID

    const q = {};
    if (type) q.itemType = type;
    
    // Enhanced search logic
    if (netsuiteId) {
      // Priority 1: Search by NetSuite Internal ID (exact match)
      q.netsuiteInternalId = netsuiteId;
      console.log('Searching by NetSuite ID:', netsuiteId);
    } else if (searchRaw) {
      // Priority 2: Check if search term looks like a NetSuite ID (numeric)
      if (/^\d+$/.test(searchRaw.trim())) {
        // If it's numeric, search NetSuite ID first
        q.netsuiteInternalId = searchRaw.trim();
        console.log('Searching numeric term as NetSuite ID:', searchRaw);
      } else {
        // Priority 3: Text search in display name
        const escaped = escapeRegExp(searchRaw);
        q.displayName = { $regex: escaped, $options: 'i' };
        console.log('Searching by name:', searchRaw);
      }
    }

    console.log('Final search query:', q);
    
    // Get the items with explicit fields including netsuiteInternalId
    let items = await Item.find(q)
      .sort({ displayName: 1 })
      .select('_id displayName sku netsuiteInternalId itemType qtyOnHand uom')
      .lean();

    // If searching by numeric term in displayName yielded no results, try NetSuite ID as fallback
    if (items.length === 0 && searchRaw && /^\d+$/.test(searchRaw.trim()) && !netsuiteId) {
      console.log('No results found by name, trying NetSuite ID fallback for:', searchRaw);
      const fallbackQuery = { ...q };
      delete fallbackQuery.displayName;
      fallbackQuery.netsuiteInternalId = searchRaw.trim();
      
      items = await Item.find(fallbackQuery)
        .sort({ displayName: 1 })
        .select('_id displayName sku netsuiteInternalId itemType qtyOnHand uom')
        .lean();
    }

    console.log('Items returned:', items.length);
    if (items.length > 0) {
      console.log('First item NetSuite ID:', items[0].netsuiteInternalId);
    }

    return NextResponse.json({ 
      items,
      searchParams: {
        type,
        search: searchRaw,
        netsuiteId,
        queryUsed: q
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