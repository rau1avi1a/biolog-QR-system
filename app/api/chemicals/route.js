// app/api/chemicals/route.js

import Chemical from "@/models/Chemical"
import connectMongoDB from "@/lib/mongo/index.js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/chemicals
 * Returns an array of chemicals, each with embedded lots.
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
          // Format ExpirationDate if applicable
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
 * Expects JSON body.
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
    // Format lots if necessary
    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    console.error("POST /api/chemicals error:", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
