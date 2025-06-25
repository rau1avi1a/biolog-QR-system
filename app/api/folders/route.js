// =============================================================================
// app/api/folders/route.js - Simple folder operations
// =============================================================================
import { NextResponse } from "next/server";
import db from '@/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const parentId = searchParams.get('parentId') ?? null;

  if (id) {
    // Get specific folder (not used much, but here for completeness)
    const folder = await db.models.Folder.findById(id);
    if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ folder });
  }

  // List folders by parent
  const folders = await db.folders.list(parentId);
  return NextResponse.json({ folders });
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'delete') {
    // DELETE folder: POST /api/folders?action=delete&id=123
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await db.folders.delete(id);
    return NextResponse.json({ success: true });
  }

  // Create folder
  const { name, parentId = null } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  try {
    const folder = await db.folders.create(name, parentId);
    return NextResponse.json({ folder });
  } catch (e) {
    if (e.code === 11000) {
      return NextResponse.json({ error: "Folder already exists here" }, { status: 409 });
    }
    throw e;
  }
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { name } = await request.json();
  
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  
  const folder = await db.folders.update(id, name);
  
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }
  
  return NextResponse.json({ folder });
}