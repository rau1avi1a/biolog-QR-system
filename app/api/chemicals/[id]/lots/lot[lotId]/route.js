import Chemical from "@/models/Chemical"
import connectMongoDB from "@/lib/mongo/index.js"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// PUT => partial update for a single embedded lot
export async function PUT(request, { params }) {
  const { id, lotId } = params
  await connectMongoDB()

  const body = await request.json() // { LotNumber, Quantity, ... }
  try {
    const chem = await Chemical.findById(id)
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 })
    }

    const lot = chem.Lots.id(lotId)
    if (!lot) {
      return NextResponse.json({ message: "Lot not found" }, { status: 404 })
    }

    if (body.LotNumber !== undefined) lot.LotNumber = body.LotNumber
    if (body.Quantity !== undefined) lot.Quantity = body.Quantity
    // if (body.ExpirationDate !== undefined) lot.ExpirationDate = body.ExpirationDate

    await chem.save()
    const doc = chem.toObject()
    return NextResponse.json(doc, { status: 200 })
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}

// DELETE => remove a single lot
export async function DELETE(request, { params }) {
    const { id, lotId } = params; // `id` is the chemical ID, `lotId` is the lot ID
    await connectMongoDB();
  
    try {
      // Find the chemical by its ID
      const chem = await Chemical.findById(id);
      if (!chem) {
        return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
      }
  
      // Check if the lot exists
      const lot = chem.Lots.id(lotId);
      if (!lot) {
        return NextResponse.json({ message: "Lot not found" }, { status: 404 });
      }
  
      // Remove the lot by filtering it out of the Lots array
      chem.Lots = chem.Lots.filter((lot) => lot._id.toString() !== lotId);
  
      // Save the updated chemical document
      await chem.save();
  
      // Return the updated chemical object
      const doc = chem.toObject();
      return NextResponse.json(doc, { status: 200 });
    } catch (err) {
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }
  
