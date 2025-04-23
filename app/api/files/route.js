//app/api/files/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import File   from "@/models/File";
import Folder from "@/models/Folder";

export const dynamic = "force-dynamic";

/* small helper – extract the <input type=file> part */
async function parseUpload(req) {
  const form = await req.formData();
  const blob   = form.get("file");           // File object (edge‑runtime)
  if (!blob)  throw new Error("file missing");

  const array  = await blob.arrayBuffer();
  return {
    buffer:      Buffer.from(array),
    fileName:    form.get("fileName")    || blob.name,
    folderId:    form.get("folderId")    || null,
    description: form.get("description") || "",
  };
}

/* ----------  GET  (list OR single)  ---------- */
export async function GET(req) {
  await connectMongoDB();
  const { searchParams } = new URL(req.url);
  const id      = searchParams.get("id");          // ?id=xxxxx
  const partial = searchParams.get("partial");     // ?partial=YT F11
  const folder  = searchParams.get("folderId");    // ?folderId=xxxxx

  /* --- single by id --- */
  if (id) {
    const f = await File.findById(id).select("+pdf").lean();
    if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const pdf =
      f.pdf?.data
        ? `data:${f.pdf.contentType};base64,${f.pdf.data.toString("base64")}`
        : null;
    delete f.pdf;
    return NextResponse.json({ file: { ...f, pdf } });
  }

  /* --- single by partial filename --- */
  if (partial) {
    const tokens = partial.split(/\s+/).filter(Boolean);
    const and    = tokens.map((t) => ({
      fileName: { $regex: `\\b${t}\\b`, $options: "i" },
    }));
    const f = await File.findOne({ $and: and }).select("+pdf").lean();
    if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const pdf =
      f.pdf?.data
        ? `data:${f.pdf.contentType};base64,${f.pdf.data.toString("base64")}`
        : null;
    delete f.pdf;
    return NextResponse.json({ file: { ...f, pdf } });
  }

  /* --- list (optionally inside a folder) --- */
  const files = await File.find({
      folderId: folder ?? null,
      $or: [
        { status: { $exists: false } },   // legacy rows
        { status: "New" }                 // only “New” for explorer
      ]
    })
      .select("-pdf")
      .sort({ createdAt: -1 })
      .lean();
  return NextResponse.json({ files });
}

/* ----------  POST  (upload)  ---------- */
export async function POST(req) {
  try {
    await connectMongoDB();
    const { buffer, fileName, folderId, description } = await parseUpload(req);

    /* folder guard */
    if (folderId && !(await Folder.exists({ _id: folderId }))) {
      return NextResponse.json(
        { error: "folderId does not exist" },
        { status: 400 }
      );
    }

    const file = await File.create({
      fileName,
      description,
      folderId: folderId || null,
      pdf: { data: buffer, contentType: "application/pdf" },
    });

    /* do NOT include the PDF buffer back */
    return NextResponse.json({ file: { ...file.toObject(), pdf: undefined } });
  } catch (e) {
    console.error("POST /files", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
