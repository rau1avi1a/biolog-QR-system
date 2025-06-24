import { NextResponse } from "next/server";
import { vendorService } from "@/db/services/app/vendor.service";

export const dynamic = "force-dynamic";

export async function GET(_, { params }) {
  const { id } = await params;
  const vd = await vendorService.get(id);
  if (!vd) return NextResponse.json({ error:"Not found" }, { status:404 });
  return NextResponse.json({ vendor: vd });
}
