// app/api/docs/route.js
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/index";
import SubSheets from "@/models/SubSheets";
import DocumentVersion from "@/models/DocumentVersion";

export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    if (docId) {
      // Single document fetch - no change needed
      const existingVersion = await DocumentVersion.findOne({
        originalDocumentId: docId,
        status: { $ne: "completed" }
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
          pdf: existingVersion.pdf ? `data:application/pdf;base64,${existingVersion.pdf.data.toString('base64')}` : null
        });
      }

      const doc = await SubSheets.findById(docId).lean();
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      return NextResponse.json({
        _id: doc._id.toString(),
        fileName: doc.fileName,
        solutionName: doc.SolutionName,
        status: "new",
        product: {
          catalogNumber: doc.product?.catalogNumber || null,
          productReference: doc.product?.productReference?.toString() || null,
        },
        pdf: doc.pdf?.data ? `data:application/pdf;base64,${doc.pdf.data.toString('base64')}` : null
      });
    } else {
      // List documents with pagination
      const query = {};
      
      if (status === "new") {
        // Only fetch original docs that don't have active versions
        const activeVersionDocs = await DocumentVersion.distinct('originalDocumentId', { 
          status: { $ne: "completed" } 
        });
        query._id = { $nin: activeVersionDocs };
      }

      // First get total count for pagination
      const totalDocs = await SubSheets.countDocuments(query);

      // Then get the actual documents for current page
      const docs = await SubSheets.find(query, {
        fileName: 1,
        'product.catalogNumber': 1,
        SolutionName: 1,
        createdAt: 1
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true) // Add this option
        .lean();

      const docsList = docs.map(d => ({
        _id: d._id.toString(),
        fileName: d.fileName,
        solutionName: d.SolutionName,
        status: "new",
        product: {
          catalogNumber: d.product?.catalogNumber || null,
        },
      }));

      // If not looking for new docs, get versions
      if (status !== "new") {
        const versionDocs = await DocumentVersion.find(
          { status },
          {
            fileName: 1,
            status: 1,
            version: 1,
            originalDocumentId: 1,
            'metadata.product.catalogNumber': 1
          }
        )
          .populate('originalDocumentId', 'product.catalogNumber')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .allowDiskUse(true) // Add this option
          .lean();

        docsList = versionDocs.map(v => ({
          _id: v._id.toString(),
          fileName: v.fileName,
          originalDocumentId: v.originalDocumentId._id.toString(),
          status: v.status,
          version: v.version,
          product: {
            catalogNumber: v.originalDocumentId?.product?.catalogNumber || null,
          },
        }));
      }

      return NextResponse.json({
        docs: docsList,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalDocs / limit),
          totalDocs,
          hasNextPage: skip + docs.length < totalDocs,
          hasPrevPage: page > 1
        }
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