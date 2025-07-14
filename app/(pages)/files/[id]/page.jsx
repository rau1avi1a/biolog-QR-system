export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disable static generation for dynamic routes
export async function generateStaticParams() {
  return []; // no static paths at build time
}

import { notFound } from 'next/navigation';
import FilesDetailClient from './FilesDetailClient';

/**
 * Fetch batch data at runtime using absolute URL (avoids ERR_INVALID_URL on server)
 */
async function getBatchWithFile(id) {
  // Determine base URL from env or default to localhost
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${baseUrl}/api/batches?id=${encodeURIComponent(id)}`;

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    console.error(`❌ Fetch failed: ${response.status} ${response.statusText}`);
    return null;
  }

  const result = await response.json();
  // Normalize: wrapped vs raw data
  return result.success === true ? result.data : result;
}

export default async function FilesPage({ params }) {
  // Extract batch ID from route parameters
  const { id } = await params;
  const batch = await getBatchWithFile(id);

  if (!batch) {
    notFound();
  }

  return <FilesDetailClient batch={batch} />;
}
