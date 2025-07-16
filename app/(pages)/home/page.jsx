// app/(pages)/home/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { ItemListDisplay } from './components';
import { itemsApi } from './lib/api';

/**
 * QR Scanner integration functions
 * These handle the QR scanning logic for the ItemListDisplay component
 */
const handleQRScan = async (qrData, allItems) => {
  try {
    // Extract the ID from the URL format: mywebsite/[id]
    let searchId = qrData.trim();
    
    if (searchId.includes('/')) {
      const urlParts = searchId.split('/');
      searchId = urlParts[urlParts.length - 1]; // Get the last part (ID)
    }
    
    // Find item by multiple criteria
    const foundItem = allItems.find(item => {
      const matches = {
        byId: item._id === searchId,
        bySku: item.sku === searchId,
        byLotNumber: item.lotNumber === searchId,
        bySkuLower: item.sku && item.sku.toLowerCase() === searchId.toLowerCase(),
        byLotLower: item.lotNumber && item.lotNumber.toLowerCase() === searchId.toLowerCase(),
        // Search in Lots array
        byLotId: item.Lots && item.Lots.some(lot => lot._id === searchId),
        byLotNumberInArray: item.Lots && item.Lots.some(lot => lot.lotNumber === searchId)
      };
      
      return Object.values(matches).some(m => m);
    });
    
    if (foundItem) {
      // Find the specific lot that matched
      let matchedLot = null;
      if (foundItem.Lots) {
        matchedLot = foundItem.Lots.find(lot => 
          lot._id === searchId || lot.lotNumber === searchId
        );
      }
      
      // Determine how it was matched
      const matchedBy = foundItem._id === searchId ? 'id' :
                       foundItem.sku === searchId ? 'sku' :
                       foundItem.lotNumber === searchId ? 'lotNumber' :
                       matchedLot ? 'lot' : 'fuzzy';
      
      return {
        ...foundItem,
        qrData: qrData,
        matchedBy: matchedBy,
        matchedLot: matchedLot
      };
    }
    
    // If not found, return object with notFound flag
    return { notFound: true, qrData: qrData, searchId: searchId };
    
  } catch (error) {
    console.error('QR Scan error:', error);
    return null;
  }
};

const handleItemFound = (result) => {
  if (result && !result.notFound) {
    // Item found successfully - handled by the component
    console.log('Item found:', result);
  } else if (result && result.notFound) {
    // Item not found - handled by the component
    console.log('Item not found:', result.qrData);
  }
};

export default function HomePage() {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        // Use your API client to fetch items
        const items = await itemsApi.getAll();
        
        // Process the items similar to how it was done server-side
        const processedItems = (items || []).map(d => ({
          // Essential fields - ensure they're strings/primitives
          _id: d._id?.toString() || '',
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
            _id: lot._id?.toString() || '',
            lotNumber: lot.lotNumber || '',
            quantity: Number(lot.quantity) || 0
          })) : [],
          
          // Date fields - convert to ISO strings
          createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
          updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
          expirationDate: d.expirationDate ? new Date(d.expirationDate).toISOString() : null,
          
          // Add searchable text for instant search
          searchText: `${d.displayName || ''} ${d.sku || ''} ${d.description || ''} ${d.vendor || ''} ${d.location || ''}`.toLowerCase()
        }));
        
        setAllItems(processedItems);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch items:', error);
        setError(error.message || 'Failed to load inventory');
        setAllItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  // Create QR scanner function with access to allItems
  const qrScanHandler = async (qrData) => {
    return await handleQRScan(qrData, allItems);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-lg font-semibold mb-2">Failed to Load Inventory</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ItemListDisplay 
      allItems={allItems}
      onQRScan={qrScanHandler}
      onItemFound={handleItemFound}
    />
  );
}