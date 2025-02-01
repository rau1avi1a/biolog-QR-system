// app/api/chemicals/[id]/lots/route.js
import Chemical from "@/models/Chemical";
import ChemicalAudit from "@/models/ChemicalAudit";
import connectMongoDB from "@/lib/mongo/index.js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function addLot(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;
    const user = context.user;
    
    await connectMongoDB();
    const body = await request.json();

    const chem = await Chemical.findById(id);
    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    // Create new lot
    const newLot = {
      LotNumber: body.LotNumber ?? "NewLot",
      Quantity: body.Quantity ?? 0,
      // Add any other lot fields here
    };

    chem.Lots.push(newLot);
    await chem.save();

    // Create audit entry for new lot
    await ChemicalAudit.create({
      chemical: {
        BiologNumber: chem.BiologNumber,
        ChemicalName: chem.ChemicalName,
        CASNumber: chem.CASNumber,
        Location: chem.Location
      },
      lot: {
        LotNumber: newLot.LotNumber,
        QuantityUsed: newLot.Quantity,  // Initial quantity is "used" amount
        QuantityRemaining: newLot.Quantity
      },
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      },
      action: "ADD",  // New action type
      notes: `New lot created with initial quantity ${newLot.Quantity}`,
      project: body.project,
      department: body.department
    });

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("POST /api/chemicals/[id]/lots error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export const POST = withAuth(addLot);