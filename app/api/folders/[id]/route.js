// app/api/folders/[id]/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import Folder from "@/models/Folder";
import File from "@/models/File";

export const dynamic = "force-dynamic";

// Update folder name
export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();
    const { name } = await req.json();
    
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    
    const folder = await Folder.findByIdAndUpdate(
      params.id,
      { name: name.trim() },
      { new: true }
    );
    
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    
    return NextResponse.json({ folder });
  } catch (e) {
    console.error("PATCH /folders/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Delete folder and all files inside it
export async function DELETE(_, { params }) {
  try {
    await connectMongoDB();
    
    // Find the folder
    const folder = await Folder.findById(params.id);
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    
    // First delete all files in the folder
    await File.deleteMany({ folderId: params.id });
    
    // Then delete the folder itself
    await Folder.findByIdAndDelete(params.id);
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /folders/[id]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}