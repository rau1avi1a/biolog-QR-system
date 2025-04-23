// app/api/search/route.js

import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import File from "@/models/File";

export const dynamic = "force-dynamic";

// Search files by filename
export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    
    if (!query?.trim()) {
      return NextResponse.json({ error: "Search query required" }, { status: 400 });
    }
    
    // Simple case-insensitive search
    const files = await File.find({ 
      fileName: { $regex: query, $options: "i" } 
    })
      .select("-pdf")
      .sort({ updatedAt: -1 })
      .lean();
    
    return NextResponse.json({ files });
  } catch (e) {
    console.error("GET /search", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}