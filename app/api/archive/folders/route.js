// app/api/archive/folders/route.js
import { NextResponse } from 'next/server';
import { getArchiveFolders } from '@/services/archive.service';

export async function GET() {
  try {
    const folders = await getArchiveFolders();
    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Archive folders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch archive folders' },
      { status: 500 }
    );
  }
}
