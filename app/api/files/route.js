// app/api/files/route.js - FIXED: Consistent wrapped list responses with metadata
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
            data: null,
            error: 'No PDF found'
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
        
        // FIXED: Return consistent wrapper structure
        return NextResponse.json({ 
          success: true, 
          data: {
            batches: batches || [],
            count: batches?.length || 0,
            fileId: id,
            query: {
              action: 'batches',
              fileId: id
            }
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
              completedBatches: batches.filter(b => b.status === 'Completed').length,
              stats: {
                totalBatches: batches.length,
                byStatus: {
                  draft: batches.filter(b => b.status === 'Draft').length,
                  inProgress: batches.filter(b => b.status === 'In Progress').length,
                  review: batches.filter(b => b.status === 'Review').length,
                  completed: batches.filter(b => b.status === 'Completed').length
                }
              }
            },
            error: null
          });
        }
      }

      if (action === 'with-pdf') {
        // Get file with PDF data: GET /api/files?id=123&action=with-pdf
        const file = await db.services.fileService.getFileById(id, { includePdf: true });
        if (!file) {
          return NextResponse.json({ 
            success: false, 
            data: null,
            error: 'File not found'
          }, { status: 404 });
        }
        
        return NextResponse.json({ 
          success: true, 
          data: file,
          error: null
        });
      }
      
      // Regular file get: GET /api/files?id=123
      const file = await db.services.fileService.getFileById(id);
      if (!file) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: 'File not found'
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
      console.log('🔍 Search request:', search);
      
      if (!search.trim() || search.trim().length < 2) {
        // FIXED: Return consistent wrapper structure even for empty results
        return NextResponse.json({ 
          success: true, 
          data: {
            files: [],
            count: 0,
            query: { 
              search: search, 
              folderId: null 
            },
            searchTerm: search,
            message: 'Search query too short (minimum 2 characters)'
          },
          error: null
        });
      }

      try {
        // Search only original files (not batches)
        const searchTerm = search.trim();
        
        // Search in original files only
        const files = await db.services.fileService.searchFiles(searchTerm);
        console.log('📄 Found original files:', files?.length || 0);
        
        // Filter to ensure only original files are returned
        const originalFiles = (files || []).filter(file => {
          // Check that it's NOT a batch file
          const isNotBatch = !file.isBatch && 
                            !file.runNumber && 
                            !file.status && 
                            !file.batchId &&
                            !file.sourceType;
          return isNotBatch;
        });
        
        console.log('✅ Filtered to original files only:', originalFiles.length, 'out of', files?.length || 0);
        
        // FIXED: Return consistent wrapper structure
        return NextResponse.json({ 
          success: true, 
          data: {
            files: originalFiles,
            count: originalFiles.length,
            query: { 
              search: searchTerm, 
              folderId: null 
            },
            searchTerm: searchTerm,
            totalFound: files?.length || 0,
            filtered: files?.length !== originalFiles.length
          },
          error: null
        });
        
      } catch (error) {
        console.error('💥 Search error:', error);
        // FIXED: Return consistent error structure
        return NextResponse.json({ 
          success: false, 
          data: {
            files: [],
            count: 0,
            query: { search, folderId: null }
          },
          error: 'Search failed: ' + error.message
        }, { status: 500 });
      }
    }

    // List files: GET /api/files?folderId=abc or GET /api/files
    const files = await db.services.fileService.listFiles({ 
      folderId: folderId || null 
    });
    
    console.log('📁 Listed files:', files?.length || 0, 'for folder:', folderId || 'root');
    
    // Filter to only return original files (not batches)
    const originalFiles = (files || []).filter(file => {
      const isNotBatch = !file.isBatch && 
                        !file.runNumber && 
                        !file.status && 
                        !file.batchId &&
                        !file.sourceType;
      return isNotBatch;
    });
    
    console.log('✅ Filtered to original files only:', originalFiles.length, 'out of', files?.length || 0);
    
    // FIXED: Always return consistent wrapper structure
    const responseData = {
      files: originalFiles,
      count: originalFiles.length,
      query: { 
        folderId: folderId || null,
        search: null 
      },
      folder: folderId ? { id: folderId } : null,
      totalFiles: files?.length || 0,
      filtered: files?.length !== originalFiles.length
    };
    
    // Add folder metadata if available
    if (folderId) {
      try {
        const folder = await db.models.Folder.findById(folderId).lean();
        if (folder) {
          responseData.folder = {
            id: folder._id,
            name: folder.name,
            parentId: folder.parentId,
            path: folder.path
          };
        }
      } catch (error) {
        console.warn('Could not fetch folder details:', error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      data: responseData,
      error: null
    });
    
  } catch (error) {
    console.error('GET files error:', error);
    // FIXED: Even errors return consistent structure
    return NextResponse.json({ 
      success: false, 
      data: {
        files: [],
        count: 0,
        query: {
          folderId: searchParams?.get('folderId') || null,
          search: searchParams?.get('search') || null
        }
      },
      error: 'Internal server error: ' + error.message
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
        data: null,
        error: 'Unauthorized'
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
          data: null,
          error: 'No files provided'
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
          data: null,
          error: 'No valid files to upload'
        }, { status: 400 });
      }
      
      const results = await db.services.fileService.createMultipleFilesFromUpload(
        fileDataArray, 
        baseFolderId
      );
      
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);
      
      // FIXED: Return consistent wrapper structure
      return NextResponse.json({
        success: true,
        data: {
          files: successful,
          uploaded: successful.length,
          failed: failed.length,
          results: successful,
          errors: failed,
          folderId: baseFolderId,
          totalAttempted: fileDataArray.length
        },
        error: null,
        message: `Uploaded ${successful.length} files successfully${failed.length ? `, ${failed.length} failed` : ''}`
      });
    }
    
    // Regular single file upload
    const formData = await request.formData();
    const fileBlob = formData.get('file');
    
    if (!fileBlob) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'No file provided'
      }, { status: 400 });
    }

    // Validate file type (optional)
    if (fileBlob.type && !fileBlob.type.includes('pdf')) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Only PDF files are supported'
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
        data: null,
        error: 'File name is required'
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
      error: null,
      message: 'File uploaded successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('POST files error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
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
        data: null,
        error: 'File ID required'
      }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    await db.connect();

    // Check if file exists
    const existingFile = await db.services.fileService.getFileById(id);
    if (!existingFile) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'File not found'
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
      error: null,
      message: 'File updated successfully'
    });
    
  } catch (error) {
    console.error('PATCH files error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
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
        data: null,
        error: 'File ID required'
      }, { status: 400 });
    }

    // Get authenticated user and check permissions
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    await db.connect();

    // Check if file exists and user has permission
    const existingFile = await db.services.fileService.getFileById(id);
    if (!existingFile) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'File not found'
      }, { status: 404 });
    }

    // Check if file has associated batches
    const batches = await db.services.batchService.listBatches({ 
      filter: { fileId: id } 
    });

    if (batches.length > 0 && user.role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: `Cannot delete file with ${batches.length} associated batches. Admin access required.`
      }, { status: 403 });
    }

    await db.services.fileService.deleteFile(id);
    
    return NextResponse.json({ 
      success: true, 
      data: {
        deletedFile: existingFile,
        deletedBatches: batches.length
      },
      error: null,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('DELETE files error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'File ID required in request body'
      }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    await db.connect();

    // Check if file exists
    const existingFile = await db.services.fileService.getFileById(id);
    if (!existingFile) {
      return NextResponse.json({ 
        success: false, 
        data: null,
        error: 'File not found'
      }, { status: 404 });
    }

    console.log('🔄 API: Updating file:', id, 'with data:', updateData);

    // Update file metadata using your service
    const updatedFile = await db.services.fileService.updateFileMeta(id, updateData);
    
    console.log('✅ API: File updated successfully');
    console.log('🔗 API: Returned file has solution:', !!updatedFile?.solution);
    
    return NextResponse.json({ 
      success: true, 
      data: updatedFile,
      error: null,
      message: 'File metadata updated successfully'
    });
    
  } catch (error) {
    console.error('💥 PUT files error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}