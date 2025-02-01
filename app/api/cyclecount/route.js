// app/api/cyclecount/route.js
import dbConnect from "@/lib/index";
import { NextResponse } from "next/server";
import Chemical from "@/models/Chemical";
import CycleCount from "@/models/CycleCount";
import ChemicalAudit from "@/models/ChemicalAudit";

/**
 * POST /api/cyclecount
 *
 * Body shape:
 * {
 *   "action": "generate" | "submit",
 *   -- For generate: no extra fields needed
 *   -- For submit: cycleCountId, updatedItems
 * }
 *
 */
export async function POST(request) {
  try {
    // 1) Connect to the DB
    await dbConnect();

    // 2) Parse JSON body
    const body = await request.json();
    const { action } = body;

    if (action === "generate") {
      // == Equivalent to your old generate.js logic ==

      // Sample 50 chemicals randomly
      const chemicals = await Chemical.aggregate([{ $sample: { size: 50 } }]);

      // Build cycle count items array
      const items = chemicals.reduce((acc, chem) => {
        if (chem.Lots && chem.Lots.length > 0) {
          // pick the first lot (or randomize if you prefer)
          const chosenLot = chem.Lots[0];
          acc.push({
            chemical: chem._id,
            BiologNumber: chem.BiologNumber,
            ChemicalName: chem.ChemicalName,
            LotNumber: chosenLot.LotNumber,
            previousQuantity: chosenLot.Quantity,
          });
        }
        return acc;
      }, []);

      // Create the cycle count document
      const cycleCount = await CycleCount.create({ items });

      return NextResponse.json({ cycleCount }, { status: 200 });
    }

    if (action === "submit") {
      // == Equivalent to your old submit.js logic ==

      const { cycleCountId, updatedItems } = body;
      if (!cycleCountId || !updatedItems) {
        return NextResponse.json(
          { error: "Missing cycleCountId or updatedItems." },
          { status: 400 }
        );
      }

      // Find the cycle count document
      const cycleCount = await CycleCount.findById(cycleCountId);
      if (!cycleCount || !cycleCount.isActive) {
        return NextResponse.json(
          { error: "No active cycle count found or it's already completed." },
          { status: 400 }
        );
      }

      // In a real app, you'd get user from session/auth
      const user = {
        _id: "userIdHere",
        name: "John Doe",
        email: "john.doe@example.com",
      };

      // Process each updated item
      for (const item of updatedItems) {
        const { chemicalId, LotNumber, countedQuantity } = item;
        if (!chemicalId || !LotNumber || countedQuantity == null) continue;

        const chem = await Chemical.findById(chemicalId);
        if (!chem) continue;

        // Find the matching lot
        const lotIndex = chem.Lots.findIndex(
          (lot) => lot.LotNumber === LotNumber
        );
        if (lotIndex === -1) continue;

        // Save the previous quantity
        const previousQuantity = chem.Lots[lotIndex].Quantity;

        // Update with new count
        chem.Lots[lotIndex].Quantity = countedQuantity;
        await chem.save();

        // Log the adjustment in ChemicalAudit
        await ChemicalAudit.create({
          chemical: {
            BiologNumber: chem.BiologNumber,
            ChemicalName: chem.ChemicalName,
            CASNumber: chem.CASNumber,
            Location: chem.Location,
          },
          lot: {
            LotNumber,
            QuantityPrevious: previousQuantity,
            QuantityUsed: previousQuantity - countedQuantity, // difference
            QuantityRemaining: countedQuantity,
          },
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
          action: "ADJUST",
          notes: "Cycle count adjustment",
          department: "manufacturing",
        });
      }

      // Mark the cycle count as completed
      cycleCount.isActive = false;
      await cycleCount.save();

      return NextResponse.json(
        { message: "Cycle count submitted successfully." },
        { status: 200 }
      );
    }

    // If action is not recognized, return error
    return NextResponse.json(
      { error: "Invalid action. Use 'generate' or 'submit'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("CycleCount API error:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
