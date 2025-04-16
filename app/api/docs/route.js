// app/api/docs/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import SubSheets from "@/models/SubSheets";
import DocumentVersion from "@/models/DocumentVersion";

export async function GET(request) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");       // e.g. ?docId=...
    const fileNameParam = searchParams.get("fileName"); // e.g. ?fileName=yt f11
    const status = searchParams.get("status");         // e.g. ?status=new
    const product = searchParams.get("product");       // e.g. ?product=1005
    const original = searchParams.get("original") === "true"; // our flag for loading mother copy
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    /**
     * 1) Single-document mode by docId.
     * If the "original" flag is NOT set, then check for a modified version (DocumentVersion)
     */
    if (docId) {
      if (!original) {
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
              ? `data:application/pdf;base64,${existingVersion.pdf.data.toString("base64")}`
              : null,
          });
        }
      }

      // Always load mother document from SubSheets (clean copy)
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
    }

    /**
     * 2) Single-document mode by partial fileName (multi-token)
     */
    if (fileNameParam) {
      const tokens = fileNameParam.split(/\s+/).filter(Boolean);
      const andClauses = tokens.map((tok) => ({
        fileName: { $regex: `\\b${tok}\\b`, $options: "i" },
      }));
      const doc = await SubSheets.findOne({ $and: andClauses }).lean();
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
    }

    /**
     * 3) Otherwise, list mode (status/product pagination)
     */
    const query = {};
    if (status) {
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
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
