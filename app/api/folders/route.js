// app/api/folders/route.js - FIXED: Consistent wrapped list responses with metadata
import { NextResponse } from "next/server";
import db from '@/db';
import { jwtVerify } from 'jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
            data: null,
            error: "Folder not found"
          }, { status: 404 });
        }

        // Build full path including current folder
        const fullPath = [...(folder.path || []), folder];
        
        return NextResponse.json({ 
          success: true, 
          data: {
            folder,
            path: fullPath,
            breadcrumbs: fullPath.map(f => ({ _id: f._id, name: f.name })),
            depth: fullPath.length - 1,
            isRoot: !folder.parentId
          },
          error: null
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
          data: {
            subfolders,
            files,
            counts: {
              subfolders: subfolders.length,
              files: files.length,
              total: subfolders.length + files.length
            },
            parentId: id,
            isEmpty: subfolders.length === 0 && files.length === 0
          },
          error: null
        });
      }
      
      // GET /api/folders?id=123 - Get specific folder
      const folder = await db.models.Folder.findById(id)
        .populate('parentId', 'name')
        .lean();
      
      if (!folder) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: "Folder not found"
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        success: true, 
        data: folder,
        error: null
      });
    }

    // List folders: GET /api/folders?parentId=123 or GET /api/folders (root level)
    const actualParentId = parentId === 'null' || parentId === '' ? null : parentId;
    
    const folders = await db.models.Folder.find({ 
      parentId: actualParentId 
    })
    .select('name parentId path createdAt updatedAt createdBy')
    .sort({ name: 1 })
    .lean();

    // Get file count and subfolder count for each folder (with error handling)
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        try {
          const [fileCount, subfolderCount] = await Promise.all([
            db.models.File.countDocuments({ folderId: folder._id }),
            db.models.Folder.countDocuments({ parentId: folder._id })
          ]);
          
          return {
            ...folder,
            fileCount,
            subfolderCount,
            totalItems: fileCount + subfolderCount,
            isEmpty: fileCount === 0 && subfolderCount === 0,
            hasFiles: fileCount > 0,
            hasSubfolders: subfolderCount > 0
          };
        } catch (error) {
          console.error(`Error getting counts for folder ${folder._id}:`, error);
          return {
            ...folder,
            fileCount: 0,
            subfolderCount: 0,
            totalItems: 0,
            isEmpty: true,
            hasFiles: false,
            hasSubfolders: false,
            countError: true
          };
        }
      })
    );

    // Build context information
    let parentContext = null;
    if (actualParentId) {
      try {
        const parentFolder = await db.models.Folder.findById(actualParentId)
          .select('name parentId path')
          .lean();
        
        if (parentFolder) {
          parentContext = {
            id: actualParentId,
            name: parentFolder.name,
            path: parentFolder.path || [],
            isRoot: !parentFolder.parentId
          };
        }
      } catch (error) {
        console.warn(`Could not load parent folder ${actualParentId}:`, error.message);
        parentContext = {
          id: actualParentId,
          name: 'Unknown Folder',
          path: [],
          isRoot: false,
          error: 'Could not load parent folder details'
        };
      }
    }

    // Calculate summary statistics
    const totalFileCount = foldersWithCounts.reduce((sum, folder) => sum + folder.fileCount, 0);
    const totalSubfolderCount = foldersWithCounts.reduce((sum, folder) => sum + folder.subfolderCount, 0);
    const emptyFolders = foldersWithCounts.filter(f => f.isEmpty);

    const responseData = {
      folders: foldersWithCounts,
      count: foldersWithCounts.length,
      query: {
        parentId: actualParentId,
        level: actualParentId ? 'subfolder' : 'root'
      },
      parentContext,
      summary: {
        totalFolders: foldersWithCounts.length,
        totalFiles: totalFileCount,
        totalSubfolders: totalSubfolderCount,
        emptyFolders: emptyFolders.length,
        nonEmptyFolders: foldersWithCounts.length - emptyFolders.length
      },
      hierarchy: {
        isRoot: !actualParentId,
        level: actualParentId ? 'child' : 'root',
        parentId: actualParentId
      }
    };

    // Add helpful descriptions
    if (!actualParentId) {
      responseData.description = 'Root level folders';
    } else {
      responseData.description = parentContext 
        ? `Subfolders of "${parentContext.name}"`
        : `Subfolders of folder ${actualParentId}`;
    }
    
    return NextResponse.json({ 
      success: true, 
      data: responseData,
      error: null
    });
    
  } catch (error) {
    console.error('GET folders error:', error);
    
    // Return consistent error structure
    const actualParentId = searchParams.get('parentId') === 'null' || searchParams.get('parentId') === '' ? null : searchParams.get('parentId');
    
    return NextResponse.json({ 
      success: false, 
      data: {
        folders: [],
        count: 0,
        query: {
          parentId: actualParentId,
          level: actualParentId ? 'subfolder' : 'root'
        },
        parentContext: actualParentId ? { id: actualParentId, error: 'Could not load parent' } : null,
        summary: {
          totalFolders: 0,
          totalFiles: 0,
          totalSubfolders: 0,
          emptyFolders: 0,
          nonEmptyFolders: 0
        }
      },
      error: "Internal server error: " + error.message
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
    
    if (action === 'delete') {
      // POST /api/folders?action=delete&id=123
      const id = searchParams.get('id');
      if (!id) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: "Folder ID required"
        }, { status: 400 });
      }

      // Check if folder exists
      const folder = await db.models.Folder.findById(id);
      if (!folder) {
        return NextResponse.json({ 
          success: false, 
          data: null,
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
          success: false,
          data: {
            folder,
            contents: {
              files: fileCount,
              subfolders: subfolderCount,
              total: fileCount + subfolderCount
            }
          },
          error: `Cannot delete folder: contains ${fileCount} files and ${subfolderCount} subfolders`
        }, { status: 400 });
      }

      await db.models.Folder.findByIdAndDelete(id);
      
      return NextResponse.json({ 
        success: true,
        data: { 
          deletedFolder: folder,
          parentId: folder.parentId 
        },
        error: null,
        message: `Folder "${folder.name}" deleted successfully`
      });
    }

    if (action === 'move') {
      // POST /api/folders?action=move
      const { folderId, newParentId } = await request.json();
      
      if (!folderId) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: "Folder ID required"
        }, { status: 400 });
      }

      const folder = await db.models.Folder.findById(folderId);
      if (!folder) {
        return NextResponse.json({ 
          success: false, 
          data: null,
          error: "Folder not found"
        }, { status: 404 });
      }

      // Validate new parent (if provided)
      if (newParentId && newParentId !== 'null') {
        const newParent = await db.models.Folder.findById(newParentId);
        if (!newParent) {
          return NextResponse.json({ 
            success: false,
            data: null,
            error: "New parent folder not found"
          }, { status: 404 });
        }

        // Check for circular reference
        if (newParent.path && newParent.path.includes(folderId)) {
          return NextResponse.json({ 
            success: false,
            data: {
              folder,
              newParent,
              circularPath: newParent.path
            },
            error: "Cannot move folder to its own subfolder"
          }, { status: 400 });
        }
      }

      const oldParentId = folder.parentId;
      folder.parentId = newParentId === 'null' ? null : newParentId;
      await folder.save(); // This will trigger the pre-save hook to update path

      return NextResponse.json({ 
        success: true, 
        data: {
          folder: folder.toObject(),
          move: {
            from: oldParentId,
            to: newParentId === 'null' ? null : newParentId
          }
        },
        error: null,
        message: "Folder moved successfully"
      });
    }

    // Create folder - POST /api/folders
    const { name, parentId = null } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: "Folder name required"
      }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Validate parent folder if provided
    if (parentId && parentId !== 'null') {
      const parentFolder = await db.models.Folder.findById(parentId);
      if (!parentFolder) {
        return NextResponse.json({ 
          success: false,
          data: null,
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
        success: false,
        data: {
          existingFolder,
          attemptedName: trimmedName,
          parentId: actualParentId
        },
        error: "A folder with this name already exists in this location"
      }, { status: 409 });
    }

    try {
      const folder = await db.models.Folder.create({
        name: trimmedName,
        parentId: actualParentId,
        createdBy: user._id
      });

      // Add context info for response
      const responseData = {
        folder: folder.toObject(),
        location: {
          parentId: actualParentId,
          isRoot: !actualParentId
        }
      };

      // Add parent context if applicable
      if (actualParentId) {
        try {
          const parent = await db.models.Folder.findById(actualParentId).select('name');
          responseData.location.parentName = parent?.name || 'Unknown';
        } catch (error) {
          responseData.location.parentName = 'Unknown';
        }
      }

      return NextResponse.json({ 
        success: true, 
        data: responseData,
        error: null,
        message: `Folder "${trimmedName}" created successfully`
      }, { status: 201 });
      
    } catch (error) {
      if (error.code === 11000) {
        return NextResponse.json({ 
          success: false,
          data: null,
          error: "A folder with this name already exists in this location"
        }, { status: 409 });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('POST folders error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: "Internal server error: " + error.message
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
        error: "Folder ID required"
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

    const { name } = await request.json();
    
    if (!name?.trim()) {
      return NextResponse.json({ 
        success: false,
        data: null,
        error: "Folder name required"
      }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if folder exists
    const existingFolder = await db.models.Folder.findById(id);
    if (!existingFolder) {
      return NextResponse.json({ 
        success: false, 
        data: null,
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
        success: false,
        data: {
          existingFolder,
          duplicateFolder,
          attemptedName: trimmedName
        },
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
      data: {
        folder: folder.toObject(),
        changes: {
          oldName: existingFolder.name,
          newName: trimmedName
        }
      },
      error: null,
      message: `Folder renamed to "${trimmedName}" successfully`
    });
    
  } catch (error) {
    console.error('PATCH folders error:', error);
    return NextResponse.json({ 
      success: false, 
      data: null,
      error: "Internal server error: " + error.message
    }, { status: 500 });
  }
}