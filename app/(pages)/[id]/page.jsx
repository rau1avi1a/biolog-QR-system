// app/[id]/page.js
import { getItemOrLot, getItemTransactionHistory, getLotTransactionHistory, generateDetailMetadata } from './lib/api';
import ItemDetailClient from './ItemDetailClient';
import LotDetailClient from './LotDetailClient';
import { notFound } from 'next/navigation';

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  try {
    const resolvedParams = await params;
    return await generateDetailMetadata(resolvedParams.id);
  } catch (error) {
    return {
      title: 'Not Found',
      description: 'The requested item or lot could not be found.',
    };
  }
}

// Main page component
export default async function DetailPage({ params }) {
  try {
    const resolvedParams = await params;
    
    // Get the item or lot data
    const { type, data } = await getItemOrLot(resolvedParams.id);
    
    if (!data) {
      notFound();
    }

    // Handle Item view
    if (type === 'item') {
      // Get transaction history for the item
      const transactions = await getItemTransactionHistory(resolvedParams.id);
      
      // Extract lots from the item data
      const lots = data.lots || [];
      
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
      // Get transaction history for the specific lot
      const transactions = await getLotTransactionHistory(
        data.item._id, 
        data.lot.lotNumber
      );
      
      return (
        <LotDetailClient 
          lot={data.lot}
          item={data.item}
          transactions={transactions}
        />
      );
    }

    // Fallback - should not reach here
    notFound();
    
  } catch (error) {
    console.error('Error loading detail page:', error);
    notFound();
  }
}