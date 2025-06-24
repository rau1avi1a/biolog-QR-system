// app/api/items/[id]/transactions/stats/route.js
import { NextResponse } from "next/server";
import connectMongoDB  from "@/db/index";
import { txnService }  from "@/db/services/app/txn.service";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate");
    const endDate   = searchParams.get("endDate");

    const stats = await txnService.getItemStats(id, startDate, endDate);
    return NextResponse.json({ stats });
  } catch (err) {
    return NextResponse.json(
      { stats: [], error: err.message },
      { status: 500 }
    );
  }
}
