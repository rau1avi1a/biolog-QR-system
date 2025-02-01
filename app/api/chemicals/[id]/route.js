// app/api/chemicals/[id]/route.js
import Chemical from "@/models/Chemical";
import { NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Handler for GET /api/chemicals/[id]
async function getChemical(request, context) {
  try {
    // Use Promise.resolve to handle both Promise and non-Promise params
    const params = await Promise.resolve(context.params);
    const id = params.id;

    // For MongoDB in Vercel, don't use lean() as it can cause issues
    const chem = await Chemical.findById(id);
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    // Convert to plain object manually
    const chemical = chem.toObject();
    return NextResponse.json(chemical, { status: 200 });
  } catch (err) {
    console.error('GET /api/chemicals/[id] error:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// Handler for PUT /api/chemicals/[id]
async function updateChemical(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params.id;
    const body = await request.json();

    const updated = await Chemical.findByIdAndUpdate(
      id, 
      body, 
      { new: true, runValidators: true }
    );
    if (!updated) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    return NextResponse.json(updated.toObject(), { status: 200 });
  } catch (err) {
    console.error('PUT /api/chemicals/[id] error:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// Handler for DELETE /api/chemicals/[id]
async function deleteChemical(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params.id;

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

// Wrap handlers with authentication
export const GET = withAuth(getChemical);
export const PUT = withAuth(updateChemical);
export const DELETE = withRole(withAuth(deleteChemical), ['admin']);