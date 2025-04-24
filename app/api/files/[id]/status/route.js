import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import File, { FILE_STATUSES } from "@/models/File";

export const dynamic = "force-dynamic";

/* PATCH  /api/files/:id/status  */
export async function PATCH(request, { params }) {
  await connectMongoDB();
  const { id } = await params;                 // ←–––– async params

  const { status } = await request.json();
  if (!status || !FILE_STATUSES.includes(status))
    return NextResponse.json(
      { error: `status must be one of: ${FILE_STATUSES.join(", ")}` },
      { status: 400 }
    );

  const updated = await File.findByIdAndUpdate(
    id,
    { status },
    { new: true, lean: true }
  ).select("-pdf");

  if (!updated)
    return NextResponse.json({ error: "File not found" }, { status: 404 });

  return NextResponse.json({
    file: updated,
    message: `File status set to "${status}"`,
  });
}
