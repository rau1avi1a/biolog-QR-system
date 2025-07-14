// app/files/[id]/page.jsx - MINIMAL FIX: Direct API call without touching existing API structure
import { notFound } from 'next/navigation';
import FilesDetailClient from './FilesDetailClient';

async function getBatchWithFile(id) {
  try {
    console.log('📄 Fetching batch with file for ID:', id);
    
    // ✅ MINIMAL FIX: Use direct fetch to bypass API client issues
    // This doesn't affect any other components or API calls
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/batches?id=${encodeURIComponent(id)}`, {
      headers: { 
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const result = await response.json();
    console.log('📊 Raw API response:', result);
    
    // Handle both success/error format and direct data format
    let batch;
    if (result.success === true) {
      batch = result.data;
    } else if (result.success === false) {
      console.error('❌ API Error:', result.error);
      return null;
    } else {
      // Direct data format (legacy)
      batch = result;
    }
    
    if (!batch) {
      console.log('❌ No batch found for ID:', id);
      return null;
    }

    console.log('✅ Successfully fetched batch:', {
      id: batch._id,
      runNumber: batch.runNumber,
      status: batch.status,
      hasFile: !!batch.fileId,
      hasSignedPdf: !!batch.signedPdf?.data
    });

    return batch;
  } catch (error) {
    console.error('💥 Exception fetching batch:', error);
    return null;
  }
}

export default async function FilesPage({ params }) {
  const { id } = await params; // Await params in Next.js 15
  const batch = await getBatchWithFile(id);

  if (!batch) {
    notFound();
  }

  return <FilesDetailClient batch={batch} />;
}