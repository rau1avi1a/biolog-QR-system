import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import SubSheets from "@/models/SubSheets";
import DocumentVersion from "@/models/DocumentVersion";

export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");
    const status = searchParams.get("status"); // e.g. "new"
    const product = searchParams.get("product"); // e.g. "1030"
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    if (docId) {
      // Single-document mode (including version handling)
      const existingVersion = await DocumentVersion.findOne({
        originalDocumentId: docId,
        status: { $ne: "completed" },
      }).lean();

      if (existingVersion) {
        return NextResponse.json({
          _id: existingVersion._id.toString(),
          originalDocumentId: existingVersion.originalDocumentId.toString(),
          fileName: existingVersion.fileName,
          status: existingVersion.status,
          version: existingVersion.version,
          currentAnnotations: existingVersion.currentAnnotations,
          metadata: existingVersion.metadata,
          pdf: existingVersion.pdf
            ? `data:application/pdf;base64,${existingVersion.pdf.data.toString(
                "base64"
              )}`
            : null,
        });
      }

      const doc = await SubSheets.findById(docId).lean();
      if (!doc) {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
      let pdfDataUri = null;
      if (doc.pdf && doc.pdf.data) {
        const base64 = doc.pdf.data.toString("base64");
        pdfDataUri = `data:${doc.pdf.contentType};base64,${base64}`;
      }
      console.log("Returning document:", {
        _id: doc._id.toString(),
        fileName: doc.fileName,
        product: doc.product,
      });
      return NextResponse.json({
        _id: doc._id.toString(),
        fileName: doc.fileName,
        solutionName: doc.SolutionName,
        status: doc.status || "new",
        product: {
          catalogNumber: doc.product?.catalogNumber || null,
          productName: doc.product?.productName || null,
          productReference: doc.product?.productReference
            ? doc.product.productReference.toString()
            : null,
        },
        currentAnnotations: doc.currentAnnotations || [],
        pdf: pdfDataUri,
      });
    } else {
      // List mode – build query for pagination and optional product filter
      const query = {};
      if (status) {
        // For "new", include documents without a status field
        if (status === "new") {
          query.$or = [{ status: "new" }, { status: { $exists: false } }];
        } else {
          query.status = status;
        }
      }
      if (product) {
        query["product.catalogNumber"] = product.trim();
      }
      console.log("List query:", query);

      // Use an aggregation pipeline with disk use enabled (in case of large datasets)
      const docsAgg = await SubSheets.aggregate([
        { $match: query },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]).allowDiskUse(true);

      const totalDocs = await SubSheets.countDocuments(query);
      console.log("Total docs found:", totalDocs);

      const docsList = docsAgg.map((doc) => ({
        _id: doc._id.toString(),
        fileName: doc.fileName,
        solutionName: doc.SolutionName,
        status: doc.status || "new",
        product: {
          catalogNumber: doc.product?.catalogNumber || null,
          productName: doc.product?.productName || null,
          productReference: doc.product?.productReference
            ? doc.product.productReference.toString()
            : null,
        },
        createdAt: doc.createdAt,
      }));

      return NextResponse.json({
        docs: docsList,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalDocs / limit),
          totalDocs,
          hasNextPage: skip + docsList.length < totalDocs,
          hasPrevPage: page > 1,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
