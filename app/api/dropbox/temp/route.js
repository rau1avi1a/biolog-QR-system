// app/api/dropbox/temp/route.js
import { NextResponse } from 'next/server';
import getDropboxClient from '@/lib/dropbox';
import { withAuth } from '@/lib/api-auth';

async function getTempLink(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    if (!path) {
      return NextResponse.json({ message: 'No path specified' }, { status: 400 });
    }

    const dbx = getDropboxClient();
    const response = await dbx.filesGetTemporaryLink({ path });
    return NextResponse.json({ link: response.result.link });
  } catch (error) {
    console.error('getTempLink error:', error);
    return NextResponse.json(
      { message: 'Failed to get temporary link', error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Export an *actual* async function named GET 
 * that internally calls your withAuth wrapper.
 */
export async function GET(request) {
  // If withAuth returns a function (req) => NextResponse,
  // we just invoke it here:
  return withAuth(getTempLink)(request);
}
