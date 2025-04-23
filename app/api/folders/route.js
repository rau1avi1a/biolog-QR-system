// app/api/folders/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import Folder from "@/models/Folder";

export const dynamic = "force-dynamic";

/* ------------  GET  ------------  */
export async function GET(req) {
  await connectMongoDB();
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get("parentId") ?? null;

  const folders = await Folder.find({ parentId }).sort({ name: 1 }).lean();
  return NextResponse.json({ folders });
}

/* ------------  POST ------------- */
export async function POST(req) {
  try {
    await connectMongoDB();
    const { name, parentId = null } = await req.json();

    if (!name?.trim())
      return NextResponse.json({ error: "Name required" }, { status: 400 });

    const folder = await Folder.create({ name: name.trim(), parentId });
    return NextResponse.json({ folder });
  } catch (e) {
    if (e.code === 11000)
      return NextResponse.json(
        { error: "Folder already exists here" },
        { status: 409 }
      );
    console.error("POST /folders", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
