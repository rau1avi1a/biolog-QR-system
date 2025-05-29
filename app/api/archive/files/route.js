// app/api/archive/files/route.js
import { NextResponse } from 'next/server';
import { getAllArchivedFiles, getArchivedFilesByPath } from '@/services/archive.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('folderPath');
    
    let files;
    if (folderPath && folderPath !== 'all') {
      files = await getArchivedFilesByPath(folderPath);
    } else {
      files = await getAllArchivedFiles();
    }
    
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Archive files error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch archived files' },
      { status: 500 }
    );
  }
}
