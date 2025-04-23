// app/api/files/status/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import File from "@/models/File";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  GET  →  /api/files/status                                         */
/*  - Get files by status                                             */
/* ------------------------------------------------------------------ */
export async function GET(request) {
  await connectMongoDB();
  
  try {
    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    
    if (!status) {
      return NextResponse.json({ error: "Status required" }, { status: 400 });
    }
    
    console.log(`Searching for files with status: "${status}"`);
    
    // Find all files with the specified status
    const files = await File.find({ status: status })
      .select("-pdf")
      .sort({ updatedAt: -1 })
      .lean();
    
    console.log(`Found ${files.length} files with status: "${status}"`);
    
    return NextResponse.json({ files });
  } catch (e) {
    console.error("GET /files/status error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}