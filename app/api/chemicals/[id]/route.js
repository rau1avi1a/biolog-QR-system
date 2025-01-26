import Chemical from "@/models/Chemical"
import connectMongoDB from "@/lib/mongo/index.js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/chemicals/[id] => fetch single chemical doc
export async function GET(request, { params }) {
  try {
    await connectMongoDB()
    const { id } = params
    const chem = await Chemical.findById(id)
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 })
    }

    // format if needed
    const doc = chem.toObject()
    // doc.Lots = ...
    return NextResponse.json(doc, { status: 200 })
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}

// PUT => update top-level fields (BiologNumber, ChemicalName, etc.)
export async function PUT(request, { params }) {
  try {
    await connectMongoDB()
    const { id } = params
    const body = await request.json()

    const updated = await Chemical.findByIdAndUpdate(id, body, { new: true })
    if (!updated) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 })
    }

    const doc = updated.toObject()
    // doc.Lots = ...
    return NextResponse.json(doc, { status: 200 })
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}

// DELETE => remove entire chemical doc
export async function DELETE(request, { params }) {
  try {
    await connectMongoDB()
    const { id } = params

    const deleted = await Chemical.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 })
    }
    return NextResponse.json({ message: "Chemical deleted" }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
