// app/api/chemicals/[id]/lots/[lotId]/route.js
import Chemical from "@/models/Chemical";
import ChemicalAudit from "@/models/ChemicalAudit";
import connectMongoDB from "@/lib/mongo/index.js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// PUT => partial update for a single embedded lot
async function updateLot(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id, lotId } = params;
    const user = context.user;

    await connectMongoDB();

    const body = await request.json();

    const chem = await Chemical.findById(id);
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    const lot = chem.Lots.id(lotId);
    if (!lot) {
      return NextResponse.json({ message: "Lot not found" }, { status: 404 });
    }

    // Store old values for audit
    const oldQuantity = lot.Quantity;

    // Update lot fields
    if (body.LotNumber !== undefined) lot.LotNumber = body.LotNumber;
    if (body.Quantity !== undefined) lot.Quantity = body.Quantity;

    await chem.save();

    // Create audit entry if quantity changed
    if (body.Quantity !== undefined && body.Quantity !== oldQuantity) {
      const quantityChange = body.Quantity - oldQuantity;

      // Decide the action (ADD, DEPLETE, USE, etc.)
      const action =
        quantityChange > 0
          ? "ADD"
          : body.Quantity === 0
          ? "DEPLETE"
          : "USE";

      await ChemicalAudit.logUsage({
        chemical: chem,
        lotNumber: lot.LotNumber,
        quantityPrevious: oldQuantity, // store old quantity in the new field
        quantityUsed: Math.abs(quantityChange),
        quantityRemaining: body.Quantity,
        user,
        notes:
          body.notes ||
          `Quantity ${quantityChange > 0 ? "increased" : "decreased"} by ${Math.abs(
            quantityChange
          )}`,
        project: body.project,
        department: body.department,
        action,
      });
    }

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error("Error updating lot:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// DELETE => remove a single lot
async function deleteLot(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id, lotId } = params;
    const user = context.user;

    await connectMongoDB();

    const chem = await Chemical.findById(id);
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    const lot = chem.Lots.id(lotId);
    if (!lot) {
      return NextResponse.json({ message: "Lot not found" }, { status: 404 });
    }

    // Create audit entry for removal
    await ChemicalAudit.logUsage({
      chemical: chem,
      lotNumber: lot.LotNumber,
      quantityUsed: lot.Quantity,
      quantityRemaining: 0,
      user,
      notes: "Lot removed",
      action: "REMOVE",
    });

    // Remove the lot
    chem.Lots = chem.Lots.filter((l) => l._id.toString() !== lotId);
    await chem.save();

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error("Error deleting lot:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export const PUT = withAuth(updateLot);
export const DELETE = withAuth(deleteLot);
