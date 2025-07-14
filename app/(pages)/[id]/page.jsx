// app/(pages)/[id]/page.jsx - FIXED VERSION
import { notFound } from 'next/navigation';
import ItemDetailClient from './ItemDetailClient';
import LotDetailClient from './LotDetailClient';

// Server-side function to get item or lot data
async function getItemOrLot(id) {
  try {
    console.log('🔍 getItemOrLot called with ID:', id);
    
    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ Invalid ObjectId format:', id);
      return { type: null, data: null };
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    console.log('🌐 Using base URL:', baseUrl);

    // Try to get it as an item first
    console.log('📦 Trying as item first...');
    const itemResponse = await fetch(`${baseUrl}/api/items?id=${id}`, {
      cache: 'no-store'
    });

    console.log('📦 Item response status:', itemResponse.status);

    if (itemResponse.ok) {
      const itemResult = await itemResponse.json();
      console.log('📦 Item API response success:', !!itemResult.success);
      
      if (itemResult.success && itemResult.data) {
        console.log('✅ Found as item:', itemResult.data.displayName);
        
        // Get the lots for this item
        const lotsResponse = await fetch(`${baseUrl}/api/items?id=${id}&action=lots`, {
          cache: 'no-store'
        });

        let lots = [];
        if (lotsResponse.ok) {
          const lotsResult = await lotsResponse.json();
          console.log('📋 Lots API response success:', !!lotsResult.success);
          
          if (lotsResult.success && lotsResult.data) {
            lots = lotsResult.data.lots || [];
            console.log('📋 Extracted lots:', lots.length, 'lots');
          }
        } else {
          console.log('⚠️ Lots request failed:', lotsResponse.status);
        }

        return {
          type: 'item',
          data: {
            ...itemResult.data,
            lots: lots
          }
        };
      }
    } else {
      console.log('📦 Item not found, trying as lot...');
    }

    // If not found as item, check if it's a lot
    console.log('🔍 Trying as lot with findLot action...');
    const lotSearchResponse = await fetch(`${baseUrl}/api/items?action=findLot&lotId=${id}`, {
      cache: 'no-store'
    });

    console.log('🔍 Lot search response status:', lotSearchResponse.status);

    if (lotSearchResponse.ok) {
      const lotResult = await lotSearchResponse.json();
      console.log('🔍 Lot API response success:', !!lotResult.success);
      
      if (lotResult.success && lotResult.data) {
        console.log('✅ Found as lot:', lotResult.data.lot?.lotNumber);
        
        return {
          type: 'lot',
          data: lotResult.data // Should contain both lot and item data
        };
      }
    } else {
      console.log('❌ Lot search failed with status:', lotSearchResponse.status);
    }
    
    console.log('❌ Not found as either item or lot');
    return { type: null, data: null };
    
  } catch (error) {
    console.error('💥 Error in getItemOrLot:', error);
    return { type: null, data: null };
  }
}

// FIXED: Server-side function to get item transaction history
async function getItemTransactionHistory(itemId) {
  try {
    console.log('📊 Getting transaction history for item:', itemId);
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/items?id=${itemId}&action=transactions&limit=100`, {
      cache: 'no-store'
    });

    console.log('📊 Transaction history response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('📊 Transaction history success:', !!result.success);
      
      if (result.success) {
        const transactions = result.data?.transactions || [];
        console.log('📊 Found', transactions.length, 'transactions');
        return transactions;
      }
    } else {
      console.log('⚠️ Transaction history request failed:', response.status);
    }

    return [];
  } catch (error) {
    console.error('💥 Error in getItemTransactionHistory:', error);
    return [];
  }
}

// FIXED: Server-side function to get lot transaction history
async function getLotTransactionHistory(itemId, lotNumber) {
  try {
    console.log('📊 Getting lot transaction history for:', { itemId, lotNumber });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/items?id=${itemId}&action=transactions&lotNumber=${encodeURIComponent(lotNumber)}`, {
      cache: 'no-store'
    });

    console.log('📊 Lot transaction history response status:', response.status);

    if (response.ok) {
      const result = await response.json();
      console.log('📊 Lot transaction history success:', !!result.success);
      
      if (result.success) {
        const transactions = result.data?.transactions || [];
        console.log('📊 Found', transactions.length, 'lot transactions');
        return transactions;
      }
    } else {
      console.log('⚠️ Lot transaction history request failed:', response.status);
    }

    return [];
  } catch (error) {
    console.error('💥 Error in getLotTransactionHistory:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  try {
    const resolvedParams = await params;
    const { type, data } = await getItemOrLot(resolvedParams.id);
    
    if (!data) {
      return {
        title: 'Not Found',
        description: 'The requested item or lot could not be found.',
      };
    }

    if (type === 'item') {
      const itemTypeLabel = data.itemType ? data.itemType.charAt(0).toUpperCase() + data.itemType.slice(1) : 'Item';
      return {
        title: `${data.displayName || 'Item'} - ${itemTypeLabel} Details`,
        description: `Detailed information for ${data.displayName || 'item'} ${data.sku ? `(${data.sku})` : ''}`,
      };
    } else if (type === 'lot') {
      return {
        title: `Lot ${data.lot?.lotNumber || 'Unknown'} - ${data.item?.displayName || 'Item'}`,
        description: `Detailed information for lot ${data.lot?.lotNumber || 'unknown'}`,
      };
    }

    return {
      title: 'Item Details',
      description: 'Item or lot information',
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Not Found',
      description: 'The requested item or lot could not be found.',
    };
  }
}

// Main page component
export default async function DetailPage({ params }) {
  try {
    console.log('🚀 DetailPage starting...');
    const resolvedParams = await params;
    console.log('📋 Resolved params:', resolvedParams);
    
    // Get the item or lot data
    const { type, data } = await getItemOrLot(resolvedParams.id);
    
    if (!data) {
      console.log('❌ No data found, calling notFound()');
      notFound();
    }

    console.log('✅ Data found, type:', type);

    // Handle Item view
    if (type === 'item') {
      console.log('📦 Rendering item view');
      
      // Get transaction history for the item
      const transactions = await getItemTransactionHistory(resolvedParams.id);
      
      // Extract lots from the item data
      const lots = data.lots || [];
      
      console.log('📦 Item render data:', {
        itemName: data.displayName,
        transactionCount: transactions.length,
        lotCount: lots.length
      });
      
      return (
        <ItemDetailClient 
          item={data}
          transactions={transactions}
          lots={lots}
        />
      );
    }
    
    // Handle Lot view
    if (type === 'lot') {
      console.log('📋 Rendering lot view');
      
      // Get transaction history for the specific lot
      const transactions = await getLotTransactionHistory(
        data.item._id, 
        data.lot.lotNumber
      );
      
      console.log('📋 Lot render data:', {
        lotNumber: data.lot.lotNumber,
        itemName: data.item.displayName,
        transactionCount: transactions.length
      });
      
      return (
        <LotDetailClient 
          lot={data.lot}
          item={data.item}
          transactions={transactions}
        />
      );
    }

    // Fallback - should not reach here
    console.log('❌ Unknown type, calling notFound()');
    notFound();
    
  } catch (error) {
    console.error('💥 Error loading detail page:', error);
    
    // Better error handling for production
    if (process.env.NODE_ENV === 'production') {
      // Log the full error for debugging
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        params: params
      });
    }
    
    notFound();
  }
}