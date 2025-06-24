import { NextResponse } from "next/server";
import { poService }    from "@/db/services/app/purchaseOrder.service";

export const dynamic = "force-dynamic";

/* body: { actor:"Raul", lines:[{ itemId, lotNumber, qty }] } */
export async function POST(req, { params }) {
  const { id } = await params;
  const { actor, lines } = await req.json();
  try {
    const po = await poService.receive(id, lines, actor);
    return NextResponse.json({ purchaseOrder: po });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
