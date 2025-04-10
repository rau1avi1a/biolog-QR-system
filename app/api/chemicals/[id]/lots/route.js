// app/api/chemicals/[id]/lots/route.js
import Chemical from "@/models/Chemical";
import ChemicalAudit from "@/models/ChemicalAudit";
import connectMongoDB from "@lib/index.js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { withRateLimit } from "@/middleware/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST handler for adding a new lot to a chemical
 * @param {Request} request The request object
 * @param {Object} context The context containing params and user info
 */
async function addLot(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;
    const user = context.user;

    console.log("Adding new lot to chemical:", id);

    await connectMongoDB();
    const body = await request.json();
    console.log("Request body:", body);

    const chem = await Chemical.findById(id);
    if (!chem) {
      console.log("Chemical not found");
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    // Create new lot with explicit type conversion
    const newLot = {
      LotNumber: body.LotNumber || "NewLot",
      Quantity: parseFloat(body.Quantity) || 0,
    };
    console.log("New lot data:", newLot);

    // Add lot to chemical
    chem.Lots.push(newLot);
    
    try {
      await chem.save();
      console.log("Chemical saved with new lot");
    } catch (saveErr) {
      console.error("Error saving chemical with new lot:", saveErr);
      return NextResponse.json({ message: saveErr.message }, { status: 500 });
    }

    // Get the newly created lot with its ID
    const addedLot = chem.Lots[chem.Lots.length - 1];
    console.log("Added lot with ID:", addedLot._id);

    // Try to create audit entry for new lot
    try {
      console.log("Creating audit entry");
      
      // IMPORTANT CHANGE: For new lots, set quantityUsed to the initial quantity
      // This ensures the audit entry shows the correct amount being added
      await ChemicalAudit.logUsage({
        chemical: chem,  // Pass the full chemical document
        lotNumber: newLot.LotNumber,
        quantityUsed: newLot.Quantity,  // CHANGED: Use the full quantity for a new lot
        quantityRemaining: newLot.Quantity,
        user: user,
        action: 'ADD',  // Keep the ADD action
        notes: `Added new lot with ${newLot.Quantity} units`,  // More descriptive note
        project: body.project,
        department: body.department
      });
      
      console.log("Audit entry created successfully");
    } catch (auditErr) {
      // Log but don't fail the request
      console.error("Error creating audit entry:", auditErr);
      console.error("Audit validation error details:", auditErr.errors || 'No detailed error info');
    }

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("POST /api/chemicals/[id]/lots error:", err);
    return NextResponse.json({ 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

// Create handler with middleware
const postHandler = withRateLimit(withAuth(addLot));

// Export handler
export { postHandler as POST };