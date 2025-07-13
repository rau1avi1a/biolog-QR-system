// app/files/[id]/page.jsx
import { notFound } from 'next/navigation';
import { filesApi, extractApiData, hasApiError, handleApiError } from '../lib/api';
import FilesDetailClient from './FilesDetailClient';

async function getBatchWithFile(id) {
  try {
    console.log('📄 Fetching batch with file for ID:', id);
    
    // ✅ FIXED: Use your new apiClient structure
    const result = await filesApi.batches.get(id);
    
    if (hasApiError(result)) {
      console.error('❌ Error fetching batch:', handleApiError(result));
      return null;
    }
    
    const batch = extractApiData(result);
    
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