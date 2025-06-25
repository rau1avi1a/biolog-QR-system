// =============================================================================
// app/api/folders/route.js - Complete folder operations (FIXED)
// =============================================================================
import { NextResponse } from "next/server";
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
    console.error('Auth error in folders route:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const parentId = searchParams.get('parentId');
    const action = searchParams.get('action');

    // Ensure connection
    await db.connect();

    if (id) {
      if (action === 'tree') {
        // GET /api/folders?id=123&action=tree - Get folder tree/path
        const folder = await db.models.Folder.findById(id)
          .populate('path', 'name')
          .lean();
        
        if (!folder) {
          return NextResponse.json({ 
            success: false, 
            error: "Folder not found" 
          }, { status: 404 });
        }

        // Build full path including current folder
        const fullPath = [...(folder.path || []), folder];
        
        return NextResponse.json({ 
          success: true, 
          folder,
          path: fullPath,
          breadcrumbs: fullPath.map(f => ({ _id: f._id, name: f.name }))
        });
      }

      if (action === 'children') {
        // GET /api/folders?id=123&action=children - Get immediate children
        const [subfolders, files] = await Promise.all([
          db.models.Folder.find({ parentId: id })
            .select('name createdAt updatedAt')
            .sort({ name: 1 })
            .lean(),
          db.services.fileService.listFiles({ folderId: id })
        ]);

        return NextResponse.json({ 
          success: true, 
          subfolders,
          files,
          counts: {
            subfolders: subfolders.length,
            files: files.length
          }
        });
      }
      
      // GET /api/folders?id=123 - Get specific folder
      const folder = await db.models.Folder.findById(id)
        .populate('parentId', 'name')
        .lean();
      
      if (!folder) {
        return NextResponse.json({ 
          success: false, 
          error: "Folder not found" 
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: true, 
        folder 
      });
    }

    // GET /api/folders?parentId=123 or GET /api/folders (root level)
    const actualParentId = parentId === 'null' || parentId === '' ? null : parentId;
    
    const folders = await db.models.Folder.find({ 
      parentId: actualParentId 
    })
    .select('name parentId path createdAt updatedAt createdBy')
    .sort({ name: 1 })
    .lean();

    // Get file count for each folder
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        try {
          const fileCount = await db.models.File.countDocuments({ folderId: folder._id });
          const subfolderCount = await db.models.Folder.countDocuments({ parentId: folder._id });
          
          return {
            ...folder,
            fileCount,
            subfolderCount,
            isEmpty: fileCount === 0 && subfolderCount === 0
          };
        } catch (error) {
          console.error(`Error getting counts for folder ${folder._id}:`, error);
          return {
            ...folder,
            fileCount: 0,
            subfolderCount: 0,
            isEmpty: true
          };
        }
      })
    );
    
    return NextResponse.json({ 
      success: true, 
      folders: foldersWithCounts,
      parentId: actualParentId,
      count: foldersWithCounts.length
    });
    
  } catch (error) {
    console.error('GET folders error:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error",
      message: error.message 
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.connect();
    
    if (action === 'delete') {
      // POST /api/folders?action=delete&id=123
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: "Folder ID required" }, { status: 400 });
      }

      // Check if folder exists
      const folder = await db.models.Folder.findById(id);
      if (!folder) {
        return NextResponse.json({ 
          success: false, 
          error: "Folder not found" 
        }, { status: 404 });
      }

      // Check if folder is empty (no files or subfolders)
      const [fileCount, subfolderCount] = await Promise.all([
        db.models.File.countDocuments({ folderId: id }),
        db.models.Folder.countDocuments({ parentId: id })
      ]);

      if (fileCount > 0 || subfolderCount > 0) {
        return NextResponse.json({ 
          error: `Cannot delete folder: contains ${fileCount} files and ${subfolderCount} subfolders` 
        }, { status: 400 });
      }

      await db.models.Folder.findByIdAndDelete(id);
      
      return NextResponse.json({ 
        success: true,
        message: `Folder "${folder.name}" deleted successfully`
      });
    }

    if (action === 'move') {
      // POST /api/folders?action=move
      const { folderId, newParentId } = await request.json();
      
      if (!folderId) {
        return NextResponse.json({ error: "Folder ID required" }, { status: 400 });
      }

      const folder = await db.models.Folder.findById(folderId);
      if (!folder) {
        return NextResponse.json({ 
          success: false, 
          error: "Folder not found" 
        }, { status: 404 });
      }

      // Validate new parent (if provided)
      if (newParentId && newParentId !== 'null') {
        const newParent = await db.models.Folder.findById(newParentId);
        if (!newParent) {
          return NextResponse.json({ 
            error: "New parent folder not found" 
          }, { status: 404 });
        }

        // Check for circular reference
        if (newParent.path && newParent.path.includes(folderId)) {
          return NextResponse.json({ 
            error: "Cannot move folder to its own subfolder" 
          }, { status: 400 });
        }
      }

      folder.parentId = newParentId === 'null' ? null : newParentId;
      await folder.save(); // This will trigger the pre-save hook to update path

      return NextResponse.json({ 
        success: true, 
        folder: folder.toObject(),
        message: "Folder moved successfully"
      });
    }

    // Create folder - POST /api/folders
    const { name, parentId = null } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Validate parent folder if provided
    if (parentId && parentId !== 'null') {
      const parentFolder = await db.models.Folder.findById(parentId);
      if (!parentFolder) {
        return NextResponse.json({ 
          error: "Parent folder not found" 
        }, { status: 404 });
      }
    }

    // Check for duplicate name in same parent
    const actualParentId = parentId === 'null' ? null : parentId;
    const existingFolder = await db.models.Folder.findOne({ 
      name: trimmedName, 
      parentId: actualParentId 
    });

    if (existingFolder) {
      return NextResponse.json({ 
        error: "A folder with this name already exists in this location" 
      }, { status: 409 });
    }

    try {
      const folder = await db.models.Folder.create({
        name: trimmedName,
        parentId: actualParentId,
        createdBy: user._id
      });

      return NextResponse.json({ 
        success: true, 
        folder: folder.toObject(),
        message: `Folder "${trimmedName}" created successfully`
      }, { status: 201 });
      
    } catch (error) {
      if (error.code === 11000) {
        return NextResponse.json({ 
          error: "A folder with this name already exists in this location" 
        }, { status: 409 });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('POST folders error:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error",
      message: error.message 
    }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: "Folder ID required" }, { status: 400 });
    }

    // Get authenticated user
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.connect();

    const { name } = await request.json();
    
    if (!name?.trim()) {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if folder exists
    const existingFolder = await db.models.Folder.findById(id);
    if (!existingFolder) {
      return NextResponse.json({ 
        success: false, 
        error: "Folder not found" 
      }, { status: 404 });
    }

    // Check for duplicate name in same parent (excluding current folder)
    const duplicateFolder = await db.models.Folder.findOne({ 
      name: trimmedName, 
      parentId: existingFolder.parentId,
      _id: { $ne: id }
    });

    if (duplicateFolder) {
      return NextResponse.json({ 
        error: "A folder with this name already exists in this location" 
      }, { status: 409 });
    }
    
    const folder = await db.models.Folder.findByIdAndUpdate(
      id,
      { 
        name: trimmedName,
        updatedBy: user._id
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    return NextResponse.json({ 
      success: true, 
      folder: folder.toObject(),
      message: `Folder renamed to "${trimmedName}" successfully`
    });
    
  } catch (error) {
    console.error('PATCH folders error:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error",
      message: error.message 
    }, { status: 500 });
  }
}