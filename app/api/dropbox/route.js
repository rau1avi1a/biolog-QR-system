// app/api/dropbox/route.js
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import getDropboxClient from "@/lib/dropbox";

const FOLDER_PATHS = {
  production: process.env.DROPBOX_PRODUCTION_FOLDER || "/MFG Documents",
  inProgress: process.env.DROPBOX_IN_PROGRESS_FOLDER || "/In Progress",
  review: process.env.DROPBOX_REVIEW_FOLDER || "/Ready for Review",
  completed: process.env.DROPBOX_COMPLETED_FOLDER || "/Completed",
  audit: process.env.DROPBOX_AUDIT_FOLDER || "/Audit Trail",
};

/**
 * List files in a specific folder (GET logic).
 */
async function listFiles(request) {
  try {
    const dbx = getDropboxClient();
    const { searchParams } = new URL(request.url);
    const folderParam = searchParams.get("folder") || "production";

    // If folderParam starts with '/', use it directly; else lookup from FOLDER_PATHS
    const folderPath = folderParam.startsWith("/")
      ? folderParam
      : FOLDER_PATHS[folderParam];

    if (!folderPath) {
      return NextResponse.json(
        { message: "Invalid folder specified" },
        { status: 400 }
      );
    }

    try {
      const response = await dbx.filesListFolder({
        path: folderPath,
        limit: 50,
      });
      return NextResponse.json(response.result.entries);
    } catch (dropboxError) {
      console.error("Dropbox API error:", dropboxError);
      if (dropboxError?.status === 409) {
        return NextResponse.json(
          { message: "Folder not found or inaccessible", path: folderPath },
          { status: 404 }
        );
      }
      throw dropboxError;
    }
  } catch (error) {
    console.error("Error in listFiles:", error);
    return NextResponse.json(
      {
        message: "Failed to list files",
        error: error.message,
        stack:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Download a file from Dropbox (POST logic).
 */
async function downloadFile(request) {
  try {
    const dbx = getDropboxClient();
    const body = await request.json();
    const { path } = body;

    const response = await dbx.filesDownload({ path });
    return NextResponse.json({
      name: response.result.name,
      fileBlob: response.result.fileBinary,
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { message: "Failed to download file", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Upload or move a file in Dropbox (PUT logic).
 */
async function handleFile(request) {
  try {
    const dbx = getDropboxClient();
    const formData = await request.formData();
    const file = formData.get("file");
    const currentPath = formData.get("currentPath");
    const targetFolder = formData.get("targetFolder");
    const filename = formData.get("filename");

    if (currentPath) {
      // Move existing file
      const newPath = `${FOLDER_PATHS[targetFolder]}/${filename}`;
      const response = await dbx.filesMoveV2({
        from_path: currentPath,
        to_path: newPath,
        autorename: true,
      });
      return NextResponse.json(response.result);
    } else {
      // Upload new file
      const fileBuffer = await file.arrayBuffer();
      const targetPath = `${FOLDER_PATHS[targetFolder]}/${filename}`;
      const response = await dbx.filesUpload({
        path: targetPath,
        contents: Buffer.from(fileBuffer),
        mode: { ".tag": "overwrite" },
      });
      return NextResponse.json(response.result);
    }
  } catch (error) {
    console.error("File operation error:", error);
    return NextResponse.json(
      { message: "Failed to process file", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Now export the actual Next.js route functions.
 * We wrap them withAuth() if you want them protected.
 */

export const GET = async (request) => {
  // If your 'withAuth' is synchronous or returns a function, you'd do this:
  return withAuth(listFiles)(request);
};

export const POST = async (request) => {
  return withAuth(downloadFile)(request);
};

export const PUT = async (request) => {
  return withAuth(handleFile)(request);
};
