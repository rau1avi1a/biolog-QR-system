// app/api/files/batch-upload/route.js - App Router format

import { createMultipleFilesFromUpload } from '@/services/file.service';
import fs from 'fs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    console.log('Received batch upload request');
    
    // Get the base folder ID from form data
    const baseFolderId = formData.get('folderId') || null;
    
    // Get all files from the form data
    const files = formData.getAll('files');
    
    if (!files || files.length === 0) {
      return Response.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`Processing ${files.length} files for batch upload`);

    // Prepare file data for batch processing
    const fileDataArray = [];
    
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      
      if (!file || file.size === 0) continue;
      
      try {
        // Get file buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Get the relative path from the corresponding field
        const relativePathKey = `relativePath_${index}`;
        const relativePath = formData.get(relativePathKey);
          
        console.log(`File ${index}: ${file.name}, relativePath: ${relativePath}`);
        
        // Extract just the filename from relativePath for the file record
        const fileName = relativePath ? relativePath.split('/').pop() : file.name;
        
        fileDataArray.push({
          buffer,
          fileName: fileName,
          relativePath: relativePath || file.name,
          description: ''
        });
        
      } catch (error) {
        console.error(`Error processing file ${index}:`, error);
        // Continue with other files
      }
    }

    if (!fileDataArray.length) {
      return Response.json({ error: 'No valid PDF files to process' }, { status: 400 });
    }

    console.log(`Calling createMultipleFilesFromUpload with ${fileDataArray.length} files`);
    
    // Debug: Log first few files to see structure
    fileDataArray.slice(0, 3).forEach((fileData, i) => {
      console.log(`FileData ${i}:`, {
        fileName: fileData.fileName,
        relativePath: fileData.relativePath,
        bufferSize: fileData.buffer.length
      });
    });

    // Process batch upload with folder structure
    const results = await createMultipleFilesFromUpload(fileDataArray, baseFolderId);
    
    // Count successful uploads
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    
    if (failed.length > 0) {
      console.error('Some files failed to upload:', failed);
    }

    console.log(`Upload complete: ${successful.length} successful, ${failed.length} failed`);

    return Response.json({
      success: true,
      message: `Uploaded ${successful.length} files successfully${failed.length ? `, ${failed.length} failed` : ''}`,
      uploaded: successful.length,
      failed: failed.length,
      results: successful, // Only return successful uploads
      errors: failed.length > 0 ? failed : undefined
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return Response.json({ 
      error: 'Failed to process batch upload',
      details: error.message 
    }, { status: 500 });
  }
}