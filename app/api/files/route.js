// app/api/files/route.js
import { NextResponse } from 'next/server';
import db from '@/db';
import { jwtVerify } from 'jose';

async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    await db.connect();
    const u = await db.models.User.findById(payload.userId).select('-password');
    return u ? { _id: u._id, name: u.name, email: u.email, role: u.role } : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const url      = new URL(request.url);
    const id       = url.searchParams.get('id');
    const action   = url.searchParams.get('action');
    const search   = url.searchParams.get('search');
    const folderId = url.searchParams.get('folderId') || null;

    await db.connect();

    // ----- single-file routes -----
    if (id) {
      // 1) Download PDF
      if (action === 'download') {
        const batch = await db.services.batchService.getBatchById(id);
        if (!batch?.signedPdf?.data) {
          return NextResponse.json({ success: false, data: null, error: 'No PDF found' }, { status: 404 });
        }
        const fileName = `${batch.fileId?.fileName || 'file'}-${batch.solutionLotNumber || `run-${batch.runNumber}`}.pdf`;
        return new NextResponse(batch.signedPdf.data, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`
          }
        });
      }

      // 2) List batches for this file
      if (action === 'batches') {
        const batches = await db.services.batchService.listBatches({ filter: { fileId: id } });
        return NextResponse.json({
          success: true,
          data: { batches, count: batches.length, fileId: id },
          error: null
        });
      }

      // 3) File stats
      if (action === 'stats') {
        const stats = await db.services.fileService.getFileStats?.(id)
          ?? { file: await db.services.fileService.getFileById(id), batchCount: 0 };
        return NextResponse.json({ success: true, data: stats, error: null });
      }

      // 4) Get with PDF embedded
      if (action === 'with-pdf') {
        const f = await db.services.fileService.getFileById(id, { includePdf: true });
        if (!f) {
          return NextResponse.json({ success: false, data: null, error: 'File not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: f, error: null });
      }

      // 5) Default “get file metadata”
      const fileDoc = await db.models.File
        .findById(id)
        .populate('solutionRef')
        .populate({ path: 'components.itemId', model: 'Item' })
        .lean();

      if (!fileDoc) {
        return NextResponse.json({ success: false, data: null, error: 'File not found' }, { status: 404 });
      }

      // reshape for your client
      const file = {
        ...fileDoc,
        components: (fileDoc.components || []).map(c => ({
          itemId:       c.itemId?._id,
          item:         c.itemId,               // full populated Item
          amount:       c.amount,
          unit:         c.unit,
          netsuiteData: c.netsuiteData,
          qty:          String(c.amount)        // for your component form
        }))
      };

      return NextResponse.json({ success: true, data: file, error: null });
    }

    // ----- search -----
    if (search) {
      const term = search.trim();
      if (term.length < 2) {
        return NextResponse.json({
          success: true,
          data: { files: [], count: 0, message: 'Query too short', query: term },
          error: null
        });
      }
      const all = await db.services.fileService.searchFiles(term);
      const original = (all || []).filter(f =>
        !f.isBatch && !f.runNumber && !f.status && !f.batchId && !f.sourceType
      );
      return NextResponse.json({
        success: true,
        data: {
          files: original,
          count: original.length,
          totalFound: all.length,
          query: term
        },
        error: null
      });
    }

    // ----- list files (root or folder) -----
    const all = await db.services.fileService.listFiles({ folderId });
    const original = (all || []).filter(f =>
      !f.isBatch && !f.runNumber && !f.status && !f.batchId && !f.sourceType
    );

    return NextResponse.json({
      success: true,
      data: {
        files: original,
        count: original.length,
        folderId,
        totalFiles: all.length
      },
      error: null
    });

  } catch (err) {
    console.error('GET /api/files error:', err);
    return NextResponse.json({
      success: false,
      data: null,
      error: 'Internal server error: ' + err.message
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