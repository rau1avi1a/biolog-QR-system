// app/api/files/route.js - FIXED: Consistent response format
import { NextResponse } from 'next/server';
import db from '@/db';
import { jwtVerify } from 'jose';

// Helper to get authenticated user
async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    
    await db.connect();
    const user = await db.models.User.findById(payload.userId).select('-password');
    
    return user ? { 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role 
    } : null;
  } catch (error) {
    console.error('Auth error in files route:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');
    const search = searchParams.get('search');
    const folderId = searchParams.get('folderId');

    // Ensure connection
    await db.connect();

    if (id) {
      if (action === 'download') {
        // Handle PDF download: GET /api/files?id=123&action=download
        const batch = await db.services.batchService.getBatchById(id);
        if (!batch?.signedPdf?.data) {
          return NextResponse.json({ 
            success: false,
            error: 'No PDF found',
            data: null
          }, { status: 404 });
        }
        
        const fileName = `${batch.fileId?.fileName || 'file'}-${batch.solutionLotNumber || `run-${batch.runNumber}`}.pdf`;
        
        return new NextResponse(batch.signedPdf.data, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`
          }
        });
      }
      
      if (action === 'batches') {
        // Get batches for this file: GET /api/files?id=123&action=batches
        const batches = await db.services.batchService.listBatches({ 
          filter: { fileId: id } 
        });
        
        return NextResponse.json({ 
          success: true, 
          data: {
            batches,
            count: batches.length
          },
          error: null
        });
      }
      
      if (action === 'stats') {
        // Get file statistics: GET /api/files?id=123&action=stats
        const fileStats = await db.services.fileService.getFileStats?.(id);
        
        if (fileStats) {
          return NextResponse.json({ 
            success: true, 
            data: fileStats,
            error: null
          });
        } else {
          // Fallback if getFileStats doesn't exist
          const file = await db.services.fileService.getFileById(id);
          const batches = await db.services.batchService.listBatches({ 
            filter: { fileId: id } 
          });
          
          return NextResponse.json({ 
            success: true, 
            data: {
              file,
              batchCount: batches.length,
              completedBatches: batches.filter(b => b.status === 'Completed').length
            },
            error: null
          });
        }
      }
      
      // Regular file get: GET /api/files?id=123
      const file = await db.services.fileService.getFileById(id, { includePdf: true });
      if (!file) {
        return NextResponse.json({ 
          success: false, 
          error: 'File not found',
          data: null
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: true, 
        data: file,
        error: null
      });
    }

    // Search: GET /api/files?search=eco
    if (search) {
      const files = search.trim() ? 
        await db.services.fileService.searchFiles(search) : 
        [];
      
      return NextResponse.json({ 
        success: true, 
        data: files, // Return files directly as data array
        count: files.length,
        query: search,
        error: null
      });
    }

    // List files: GET /api/files?folderId=abc
    const files = await db.services.fileService.listFiles({ 
      folderId: folderId || null 
    });
    
    return NextResponse.json({ 
      success: true, 
      data: files, // Return files directly as data array
      count: files.length,
      folderId: folderId || null,
      error: null
    });
    
  } catch (error) {
    console.error('GET files error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      data: null
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        data: null
      }, { status: 401 });
    }

    await db.connect();
    
    if (action === 'batch-upload') {
      // Handle batch upload with folder structure
      const formData = await request.formData();
      const files = formData.getAll('files');
      const baseFolderId = formData.get('folderId') || null;
      
      if (!files || files.length === 0) {
        return NextResponse.json({ 
          success: false,
          error: 'No files provided',
          data: null
        }, { status: 400 });
      }
      
      const fileDataArray = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file || file.size === 0) continue;
        
        const buffer = Buffer.from(await file.arrayBuffer());
        const relativePath = formData.get(`relativePath_${i}`);
        
        fileDataArray.push({
          buffer,
          fileName: relativePath ? relativePath.split('/').pop() : file.name,
          relativePath: relativePath || file.name,
          description: formData.get(`description_${i}`) || ''
        });
      }
      
      if (fileDataArray.length === 0) {
        return NextResponse.json({ 
          success: false,
          error: 'No valid files to upload',
          data: null
        }, { status: 400 });
      }
      
      const results = await db.services.fileService.createMultipleFilesFromUpload(
        fileDataArray, 
        baseFolderId
      );
      
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);
      
      return NextResponse.json({
        success: true,
        data: {
          uploaded: successful.length,
          failed: failed.length,
          results: successful,
          errors: failed
        },
        message: `Uploaded ${successful.length} files successfully${failed.length ? `, ${failed.length} failed` : ''}`,
        error: null
      });
    }
    
    // Regular single file upload
    const formData = await request.formData();
    const fileBlob = formData.get('file');
    
    if (!fileBlob) {
      return NextResponse.json({ 
        success: false,
        error: 'No file provided',
        data: null
      }, { status: 400 });
    }

    // Validate file type (optional)
    if (fileBlob.type && !fileBlob.type.includes('pdf')) {
      return NextResponse.json({ 
        success: false,
        error: 'Only PDF files are supported',
        data: null
      }, { status: 400 });
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const fileName = formData.get('fileName') || fileBlob.name;
    const description = formData.get('description') || '';
    const folderId = formData.get('folderId') || null;
    const relativePath = formData.get('relativePath') || '';

    if (!fileName) {
      return NextResponse.json({ 
        success: false,
        error: 'File name is required',
        data: null
      }, { status: 400 });
    }

    const file = await db.services.fileService.createFileFromUpload({
      buffer,
      fileName,
      description,
      folderId,
      relativePath
    });
    
    return NextResponse.json({ 
      success: true, 
      data: file,
      message: 'File uploaded successfully',
      error: null
    }, { status: 201 });
    
  } catch (error) {
    console.error('POST files error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      data: null
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'File ID required',
        data: null
      }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        data: null
      }, { status: 401 });
    }

    await db.connect();

    // Check if file exists
    const existingFile = await db.services.fileService.getFileById(id);
    if (!existingFile) {
      return NextResponse.json({ 
        success: false, 
        error: 'File not found',
        data: null
      }, { status: 404 });
    }
    
    const body = await request.json();
    
    let file;
    if ('status' in body) {
      // Update file status (if this functionality exists)
      file = await db.services.fileService.updateFileStatus?.(id, body.status);
      if (!file) {
        // Fallback if updateFileStatus doesn't exist
        file = await db.services.fileService.updateFileMeta(id, { status: body.status });
      }
    } else {
      // Update file metadata
      file = await db.services.fileService.updateFileMeta(id, body);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: file,
      message: 'File updated successfully',
      error: null
    });
    
  } catch (error) {
    console.error('PATCH files error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      data: null
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        error: 'File ID required',
        data: null
      }, { status: 400 });
    }

    // Get authenticated user and check permissions
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized',
        data: null
      }, { status: 401 });
    }

    await db.connect();

    // Check if file exists and user has permission
    const existingFile = await db.services.fileService.getFileById(id);
    if (!existingFile) {
      return NextResponse.json({ 
        success: false, 
        error: 'File not found',
        data: null
      }, { status: 404 });
    }

    // Check if file has associated batches
    const batches = await db.services.batchService.listBatches({ 
      filter: { fileId: id } 
    });

    if (batches.length > 0 && user.role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        error: `Cannot delete file with ${batches.length} associated batches. Admin access required.`,
        data: null
      }, { status: 403 });
    }

    await db.services.fileService.deleteFile(id);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        deletedFile: existingFile,
        deletedBatches: batches.length
      },
      message: 'File deleted successfully',
      error: null
    });
    
  } catch (error) {
    console.error('DELETE files error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      data: null
    }, { status: 500 });
  }
}