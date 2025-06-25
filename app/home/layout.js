// app/home/layout.js
import { basicAuth } from "@/db/lib/auth";
import db from '@/db/index.js'; // ✅ Single import
import NavBar from "@/components/NavBar";

export default async function HomeLayout({ children }) {
  const user = await basicAuth(); //default: "/"
  
  // Get items for QR scanner in navigation
  let allItems = [];
  try {
    await db.connect(); // ✅ Use db.connect()
    const raw = await db.models.Item.find().lean(); // ✅ Use db.models.Item
    allItems = raw.map(d => ({
      _id: d._id.toString(),
      displayName: d.displayName || '',
      sku: d.sku || '',
      itemType: d.itemType || 'chemical',
      qtyOnHand: Number(d.qtyOnHand) || 0,
      uom: d.uom || '',
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
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
      updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
      expirationDate: d.expirationDate ? d.expirationDate.toISOString() : null,
      searchText: `${d.displayName || ''} ${d.sku || ''} ${d.description || ''} ${d.vendor || ''} ${d.location || ''}`.toLowerCase()
    }));
  } catch (error) {
    console.error('Failed to load items for navigation:', error);
  }

  return (
    <>
      <NavBar user={user} allItems={allItems} />
      {children}
    </>
  );
}