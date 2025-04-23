import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import connectMongoDB from "@/lib/index";
import File from "@/models/File";
import FileVersion from "@/models/FileVersion";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  POST  →  /api/files/<id>/versions                                 */
/* ------------------------------------------------------------------ */
export async function POST(request, { params }) {
  await connectMongoDB();

  const { overlayPng = "", actor = "unknown", metadata = {} } =
    await request.json();
  const mustClone = new URL(request.url).searchParams.get("clone") === "true";

  /* 0. load master or working copy */
  let file = await File.findById(params.id).select("+pdf");
  if (!file)
    return NextResponse.json({ error: "File not found" }, { status: 404 });

  /* 1. clone once, tag as In-Progress */
  if (mustClone && (!file.status || file.status === "New")) {
    file = await File.create({
      fileName: file.fileName,
      description: file.description,
      folderId: file.folderId,
      productRef: file.productRef,
      pdf: file.pdf,
      status: "In Progress",
    });
  }

  /* 2. merge overlay */
  const pdfDoc = await PDFDocument.load(file.pdf.data);

  if (overlayPng) {
    const raw   = Buffer.from(overlayPng.split(",")[1], "base64");
    const img   = await pdfDoc.embedPng(raw);

    const page  = pdfDoc.getPage(metadata.page ? metadata.page - 1 : 0);
    const { width: pw, height: ph } = page.getSize();

    /* —— scale the PNG to fit the page exactly —— */
    const scale = Math.min(pw / img.width, ph / img.height);
    const w     = img.width  * scale;
    const h     = img.height * scale;

    const x = (pw - w) / 2;   // centred horizontally
    const y = ph - h;         // stick to the top edge

    page.drawImage(img, { x, y, width: w, height: h });
  }

  const outBuf = Buffer.from(await pdfDoc.save());

  /* 3. add FileVersion */
  await FileVersion.create({
    fileId: file._id,
    pdf: { data: outBuf, contentType: file.pdf.contentType },
    createdBy: actor,
    overlayPng,
    metadata,
    statusSnapshot: file.status ?? "In Progress",
  });

  /* 4. update working copy PDF + status */
  const nextStatus = metadata.forceStatus || file.status || "In Progress";
  await File.updateOne(
    { _id: file._id },
    {
      $set: {
        pdf: { data: outBuf, contentType: file.pdf.contentType },
        status: nextStatus,
      },
    }
  );

  /* 5. return DTO if we cloned */
  let newFile;
  if (mustClone) {
    newFile = dto({
      ...file.toObject(),
      pdf: { data: outBuf, contentType: file.pdf.contentType },
      status: "In Progress",
    });
  }

  return NextResponse.json({ version: true, newFile }, { status: 201 });
}

/* helper – strip buffer, convert to data-URL */
function dto(doc) {
  const { pdf, ...rest } = doc;
  return {
    ...rest,
    pdf:
      pdf?.data
        ? `data:${pdf.contentType};base64,${pdf.data.toString("base64")}`
        : null,
  };
}

/* ------------------------------------------------------------------ */
/*  GET  →  /api/files/<id>/versions                                  */
/* ------------------------------------------------------------------ */
export async function GET(_, { params }) {
  await connectMongoDB();

  const versions = await FileVersion.find({ fileId: params.id })
    .sort({ version: -1 })
    .lean();

  return NextResponse.json({
    versions: versions.map((v) => ({
      _id: v._id.toString(),
      version: v.version,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      metadata: v.metadata,
    })),
  });
}
