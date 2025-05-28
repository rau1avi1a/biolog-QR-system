// app/api/archive/files/move/route.js

import { NextResponse } from 'next/server';
import { moveArchivedFile } from '@/services/archive.service';

export async function PUT(request) {
  try {
    const { fileId, targetFolderId } = await request.json();
    
    if (!fileId || !targetFolderId) {
      return NextResponse.json(
        { error: 'fileId and targetFolderId are required' },
        { status: 400 }
      );
    }
    
    const result = await moveArchivedFile(fileId, targetFolderId);
    return NextResponse.json({ file: result });
  } catch (error) {
    console.error('Move archived file error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to move archived file' },
      { status: 500 }
    );
  }
}