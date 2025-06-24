// app/api/archive/files/[id]/route.js
import { NextResponse } from 'next/server';
import { getArchivedFile } from '@/db/services/app/archive.service';

export async function GET(request, { params }) {
  try {
    // Await params before using its properties (Next.js 15 requirement)
    const { id } = await params;
    const file = await getArchivedFile(id);
    
    if (!file) {
      return NextResponse.json(
        { error: 'Archived file not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ file });
  } catch (error) {
    console.error('Load archived file error:', error);
    return NextResponse.json(
      { error: 'Failed to load archived file' },
      { status: 500 }
    );
  }
}