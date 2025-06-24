// app/home/page.jsx
import { Item } from '@/db/schemas/Item';
import dbConnect from '@/db/index';
import ClientHome from './clienthome';

// Add metadata for better SEO and performance
export const metadata = {
  title: 'Laboratory Inventory - Biolog QR System',
  description: 'Manage chemicals, solutions, and products efficiently with QR code integration'
};

export default async function HomePage() {
  await dbConnect();

  // Pull and flatten to plain JSON - PROPERLY serialize everything
  const raw = await Item.find().lean();
  const flat = raw.map(d => {
    // Convert all MongoDB objects to plain JavaScript objects
    const plainItem = {
      // Essential fields - ensure they're strings/primitives
      _id: d._id.toString(),
      displayName: d.displayName || '',
      sku: d.sku || '',
      itemType: d.itemType || 'chemical',
      qtyOnHand: Number(d.qtyOnHand) || 0,
      uom: d.uom || '',
      
      // Optional fields - safely convert
      description: d.description || '',
      vendor: d.vendor || '',
      location: d.location || '',
      minQty: Number(d.minQty) || 0,
      qrCode: d.qrCode || '',
      lotNumber: d.lotNumber || '',
      // Chemical-specific fields
      casNumber: d.casNumber || '',
      
      // Include Lots array for QR scanning
      Lots: d.Lots ? d.Lots.map(lot => ({
        _id: lot._id.toString(),
        lotNumber: lot.lotNumber || '',
        quantity: Number(lot.quantity) || 0
      })) : [],
      
      // Date fields - convert to ISO strings
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
      updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
      expirationDate: d.expirationDate ? d.expirationDate.toISOString() : null,
      
      // Add searchable text for instant search
      searchText: `${d.displayName || ''} ${d.sku || ''} ${d.description || ''} ${d.vendor || ''} ${d.location || ''}`.toLowerCase()
    };

    return plainItem;
  });

  // Group by type but also maintain a flat searchable array
  const groups = { chemical: [], solution: [], product: [] };
  flat.forEach(i => { 
    if (groups[i.itemType]) {
      groups[i.itemType].push(i); 
    }
  });

  // Calculate totals for overview - use the cleaned data
  const stats = {
    total: flat.length,
    chemical: groups.chemical.length,
    solution: groups.solution.length,
    product: groups.product.length,
    lowStock: flat.filter(i => i.qtyOnHand <= (i.minQty || 0)).length
  };

  return <ClientHome groups={groups} allItems={flat} stats={stats} />;
}