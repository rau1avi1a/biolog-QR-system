import Chemical from "@/models/Chemical"
import connectMongoDB from "@/lib/mongo/index.js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/chemicals
 * Returns an array of chemicals, each with embedded lots.
 * Optionally format each lot's ExpirationDate if you want to store dates in them.
 */
export async function GET() {
  try {
    await connectMongoDB()
    const chemicals = await Chemical.find({})

    // Format each chemical's lots if needed
    const formatted = chemicals.map((chem) => {
      const doc = chem.toObject()
      if (Array.isArray(doc.Lots)) {
        doc.Lots = doc.Lots.map((lot) => {
          // If you have an ExpirationDate field in chemical lots, format it:
          // if (lot.ExpirationDate) {
          //   lot.ExpirationDate = new Date(lot.ExpirationDate)
          //     .toISOString()
          //     .split("T")[0]
          // }
          return lot
        })
      }
      return doc
    })

    return NextResponse.json(formatted, { status: 200 })
  } catch (err) {
    console.error("GET /api/chemicals error:", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}

/**
 * POST /api/chemicals
 * Creates a new chemical with top-level fields + optional lots.
 * Expects JSON body like:
 * {
 *   "BiologNumber": "24-000001",
 *   "ChemicalName": "Acetic Acid",
 *   "CASNumber": "64-19-7",
 *   "Location": "Room Temperature",
 *   "Lots": [
 *     { "LotNumber": "AA-01", "Quantity": 10 }
 *   ]
 * }
 */
export async function POST(request) {
  try {
    await connectMongoDB()

    const body = await request.json()
    const { BiologNumber, ChemicalName, CASNumber, Location, Lots } = body

    if (!BiologNumber || !ChemicalName) {
      return NextResponse.json(
        { message: "Missing required fields (BiologNumber, ChemicalName)" },
        { status: 400 }
      )
    }

    const newChemical = await Chemical.create({
      BiologNumber,
      ChemicalName,
      CASNumber: CASNumber || null,
      Location: Location || null,
      Lots: Lots || [],
    })

    const doc = newChemical.toObject()
    // format lots if you have an ExpirationDate, etc.
    // doc.Lots = doc.Lots.map(...)
    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error("POST /api/chemicals error:", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
