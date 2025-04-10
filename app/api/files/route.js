import { NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/index';
import Files from '@/models/Files';

// List files and folders
export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const currentPath = searchParams.get('path') || '';
    const fileId = searchParams.get('fileId');

    if (fileId) {
      // If fileId is provided, return the specific file with its data
      const file = await Files.findById(fileId);
      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    // Otherwise, list files and folders without the data field
    const items = await Files.find(
      { path: currentPath },
      { data: 0 } // Exclude the data field
    );
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

// Upload files and create folders
export async function POST(request) {
  try {
    await connectMongoDB();
    const formData = await request.formData();
    const operation = formData.get('operation');

    // Handle file upload
    if (operation === 'upload') {
      const files = formData.getAll('files');
      const folderPath = formData.get('path') || '';

      const savedFiles = [];
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save file info and data to database
        const fileDoc = await Files.create({
          name: file.name,
          type: 'file',
          path: folderPath,
          size: file.size,
          mimeType: file.type,
          data: buffer,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Return file info without the data
        const { data, ...fileInfo } = fileDoc.toObject();
        savedFiles.push(fileInfo);
      }

      return NextResponse.json({ files: savedFiles });
    }

    // Handle folder creation
    if (operation === 'createFolder') {
      const folderPath = formData.get('path') || '';
      const folderName = formData.get('name');

      // Save folder info to database
      const folder = await Files.create({
        name: folderName,
        type: 'folder',
        path: folderPath,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return NextResponse.json({ folder });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}

// Delete files or folders
export async function DELETE(request) {
  try {
    await connectMongoDB();
    const { path: itemPath, type } = await request.json();

    if (type === 'folder') {
      // Delete folder and all its contents from database
      await Files.deleteMany({
        $or: [
          { path: itemPath },
          { path: new RegExp(`^${itemPath}/`) }
        ]
      });
    } else {
      // Delete single file from database
      await Files.deleteOne({
        path: itemPath.substring(0, itemPath.lastIndexOf('/')),
        name: itemPath.substring(itemPath.lastIndexOf('/') + 1)
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}

// Update file or folder (rename)
export async function PATCH(request) {
  try {
    await connectMongoDB();
    const { oldPath, newName, type } = await request.json();
    const oldName = oldPath.split('/').pop();
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));

    if (type === 'folder') {
      // Get all items in and under this folder
      const items = await Files.find({
        $or: [
          { path: oldPath },
          { path: new RegExp(`^${oldPath}/`) }
        ]
      });

      // Update each item's path
      for (const item of items) {
        const newPath = item.path.replace(oldPath, `${parentPath}/${newName}`);
        await Files.updateOne(
          { _id: item._id },
          {
            $set: {
              path: newPath,
              name: item.path === oldPath ? newName : item.name,
              updatedAt: new Date()
            }
          }
        );
      }
    } else {
      // Update single file
      await Files.updateOne(
        {
          path: parentPath,
          name: oldName
        },
        {
          $set: {
            name: newName,
            updatedAt: new Date()
          }
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}