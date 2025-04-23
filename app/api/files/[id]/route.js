// app/api/files/[id]/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import File from "@/models/File";

export async function GET(_, { params }) {
  await connectMongoDB();

  const file = await File.findById(params.id).select("+pdf").lean();
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dataUrl =
    file.pdf?.data
      ? `data:${file.pdf.contentType};base64,${file.pdf.data.toString("base64")}`
      : null;

  delete file.pdf;
  return NextResponse.json({ file: { ...file, pdf: dataUrl } });
}
