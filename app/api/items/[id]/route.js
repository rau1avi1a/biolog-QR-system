// app/api/items/[id]/route.js
import { NextResponse } from "next/server";
import connectMongoDB  from "@/lib/index";
import { Item }        from "@/models/Item";
import { basicAuth }   from "@/lib/auth";

export const dynamic = "force-dynamic";

/* GET /api/items/:id */
export async function GET(_, { params }) {
  await connectMongoDB();
  const { id } = await params;
  const item = await Item.findById(id).lean();
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

/* PATCH /api/items/:id */
export async function PATCH(req, { params }) {
  await connectMongoDB();

  // optional auth
  await basicAuth("/login");

  const { id } = await params;
  const data  = await req.json();

  // pick only the fields you allow editing
  const allowed = ["displayName", "casNumber", "location"];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }

  const updated = await Item.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, lean: true }
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item: updated });
}
