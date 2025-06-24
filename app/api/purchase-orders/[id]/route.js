import { NextResponse } from "next/server";
import { poService }    from "@/db/services/app/purchaseOrder.service";

export const dynamic = "force-dynamic";

export async function GET(_, { params }) {
  const { id } = await params;
  const po = await poService.get(id);
  if (!po) return NextResponse.json({ error:"Not found" }, { status:404 });
  return NextResponse.json({ purchaseOrder: po });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const { status } = await req.json();                // 'open' | 'received' …
  const po = await poService.updateStatus(id, status);
  if (!po) return NextResponse.json({ error:"Not found" }, { status:404 });
  return NextResponse.json({ purchaseOrder: po });
}
