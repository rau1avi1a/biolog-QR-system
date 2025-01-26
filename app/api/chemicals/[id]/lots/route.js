import Chemical from "@/models/Chemical"
import connectMongoDB from "@/lib/mongo/index.js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * POST /api/chemicals/[id]/lots
 * Adds a new lot to that chemical's "Lots" array.
 */
export async function POST(request, { params }) {
  try {
    await connectMongoDB()
    const { id } = params
    const body = await request.json() // { LotNumber, Quantity, etc. }

    const chem = await Chemical.findById(id)
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 })
    }

    chem.Lots.push({
      LotNumber: body.LotNumber ?? "NewLot",
      Quantity: body.Quantity ?? 0,
      // if you have ExpirationDate for chemical lots:
      // ExpirationDate: body.ExpirationDate ?? null
    })

    await chem.save()

    const doc = chem.toObject()
    // format lots if needed
    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error("POST /api/chemicals/[id]/lots error:", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
