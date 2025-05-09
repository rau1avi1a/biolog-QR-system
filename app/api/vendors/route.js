import { NextResponse } from "next/server";
import { vendorService } from "@/services/vendor.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const vendors = await vendorService.list();
  return NextResponse.json({ vendors });
}

export async function POST(req) {
  const vd = await vendorService.create(await req.json());
  return NextResponse.json({ vendor: vd }, { status: 201 });
}
