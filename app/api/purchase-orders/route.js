import { NextResponse } from "next/server";
import { poService }    from "@/db/services/app/purchaseOrder.service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ purchaseOrders: await poService.list() });
}

export async function POST(req) {
  const po = await poService.create(await req.json());
  return NextResponse.json({ purchaseOrder: po }, { status: 201 });
}
