import { NextResponse } from "next/server";
import { vendorService } from "@/services/vendor.service";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  const { id: vendorId, itemId } = await params;
  const payload = await req.json();        // { vendorSKU, lastPrice, preferred }
  const vi = await vendorService.linkItem(vendorId, itemId, payload);
  return NextResponse.json({ vendorItem: vi });
}
