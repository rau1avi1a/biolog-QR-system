// app/api/chemicals/[id]/route.js
import Chemical from "@/models/Chemical";
import connectMongoDB from "@/lib/mongo/index.js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { withRateLimit } from "@/middleware/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET handler for retrieving a single chemical
 */
async function getChemical(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;

    await connectMongoDB();
    const chem = await Chemical.findById(id);
    
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error('GET /api/chemicals/[id] error:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

/**
 * PUT handler for updating a chemical
 */
async function updateChemical(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;
    const body = await request.json();

    await connectMongoDB();

    const updated = await Chemical.findByIdAndUpdate(
      id,
      body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    const doc = updated.toObject();
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error('PUT /api/chemicals/[id] error:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

/**
 * DELETE handler for removing a chemical
 */
async function deleteChemical(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;

    await connectMongoDB();

    const deleted = await Chemical.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Chemical deleted" }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/chemicals/[id] error:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// Create handlers with middleware
const getHandler = withRateLimit(withAuth(getChemical));
const putHandler = withRateLimit(withAuth(updateChemical));
const deleteHandler = withRateLimit(withAuth(deleteChemical));

// Export handlers
export {
  getHandler as GET,
  putHandler as PUT,
  deleteHandler as DELETE
};