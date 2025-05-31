// app/files/[id]/page.jsx
import { notFound } from 'next/navigation';
import connectMongoDB from '@/lib/index';
import Batch from '@/models/Batch';
import File from '@/models/File';
import FilesDetailClient from './FilesDetailClient';

async function getBatchWithFile(id) {
  try {
    await connectMongoDB();
    
    const batch = await Batch.findById(id)
      .populate('fileId', 'fileName fileSize uploadedAt createdAt')
      .populate({
        path: 'snapshot.solutionRef',
        select: 'displayName sku'
      })
      .populate({
        path: 'snapshot.productRef', 
        select: 'displayName sku'
      })
      .populate({
        path: 'snapshot.components.itemId',
        select: 'displayName sku'
      })
      .lean();

    if (!batch) {
      return null;
    }

    // Convert ObjectIds to strings for client-side usage
    return JSON.parse(JSON.stringify(batch));
  } catch (error) {
    console.error('Error fetching batch:', error);
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