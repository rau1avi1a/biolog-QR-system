// app/api/files/[id]/version/[versionId]/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import FileVersion from "@/models/FileVersion";
import { FILE_STATUSES } from "@/models/File";

/* ------------------------------------------------------------------ */
/*  GET  →  /api/files/<id>/version/<versionId>                       */
/*  - Get a specific version of a file                                */
/* ------------------------------------------------------------------ */
export async function GET(_, { params }) {
  try {
    await connectMongoDB();
    
    const { id, versionId } = params;
    
    const version = await FileVersion.findOne({
      _id: versionId,
      fileId: id
    }).select("+pdf").lean();
    
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    
    // Convert PDF buffer to data URL
    const pdfDataUrl = version.pdf?.data 
      ? `data:${version.pdf.contentType || 'application/pdf'};base64,${version.pdf.data.toString('base64')}`
      : null;
    
    // Remove binary data from response
    const { pdf, ...versionData } = version;
    
    return NextResponse.json({
      version: {
        ...versionData,
        pdf: pdfDataUrl
      }
    });
  } catch (e) {
    console.error("GET /files/[id]/version/[versionId]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

