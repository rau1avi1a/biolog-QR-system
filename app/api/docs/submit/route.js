// app/api/docs/submit/route.js
import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/index';
import SubSheets from '@/models/SubSheets';
import DocumentAuditTrail from '@/models/DocumentAuditTrail';

export async function POST(request) {
  try {
    await connectMongoDB();
    const { docId, newStatus } = await request.json();

    if (!docId || !newStatus) {
      return NextResponse.json(
        { error: "docId and newStatus are required" },
        { status: 400 }
      );
    }

    // Update the document's status.
    const document = await SubSheets.findByIdAndUpdate(
      docId,
      { status: newStatus },
      { new: true }
    );

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Create an audit trail entry.
    const auditEntry = await DocumentAuditTrail.create({
      documentId: docId,
      status: newStatus,
      // Store any saved annotation image from the document (or empty string if not available).
      annotations: document.annotationImage || "",
      metadata: {}, // Add any metadata if needed.
      timestamp: new Date()
    });

    return NextResponse.json({
      message: `Document status updated to ${newStatus}`,
      document,
      auditEntry
    });
  } catch (error) {
    console.error("Error updating document status:", error);
    return NextResponse.json(
      { error: "Failed to update document status" },
      { status: 500 }
    );
  }
}
