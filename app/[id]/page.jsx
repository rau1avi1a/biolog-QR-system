// app/[id]/page.jsx
import { notFound } from 'next/navigation';
import ItemDetailClient from './ItemDetailClient';
import LotDetailClient from './LotDetailClient';
import { 
  getItemOrLot, 
  getItemTransactionHistory, 
  getLotTransactionHistory,
  generateDetailMetadata 
} from './lib/api';

export async function generateMetadata({ params }) {
  // Next.js 15 requires awaiting params
  const { id } = await params;
  return await generateDetailMetadata(id);
}

export default async function UniversalDetailPage({ params }) {
  // Next.js 15 requires awaiting params
  const { id } = await params;
  
  console.log('🔄 PAGE: Processing request for ID:', id);
  
  const { type, data } = await getItemOrLot(id);
  
  if (!data) {
    console.log('❌ PAGE: No data found, returning 404');
    notFound();
  }

  console.log('✅ PAGE: Found', type, 'data, rendering client component');

  if (type === 'item') {
    // It's an item - use the item detail client
    const transactions = await getItemTransactionHistory(id);
    
    return (
      <ItemDetailClient 
        item={data}
        transactions={transactions}
        lots={data.lots}
      />
    );
  } else {
    // It's a lot - use the lot detail client
    const transactions = await getLotTransactionHistory(data.item._id, data.lot.lotNumber);
    
    return (
      <LotDetailClient 
        lot={data.lot}
        item={data.item}
        transactions={transactions}
      />
    );
  }
}