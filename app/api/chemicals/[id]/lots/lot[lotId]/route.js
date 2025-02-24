// app/api/chemicals/[id]/lots/[lotId]/route.js
import Chemical from "@/models/Chemical";
import ChemicalAudit from "@/models/ChemicalAudit";
import connectMongoDB from "@lib/index.js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { withRateLimit } from "@/middleware/rateLimit";

export const dynamic = "force-dynamic";

/**
 * PUT handler for updating a lot
 */
async function updateLot(request, context) {
  try {
    // Ensure params is always resolved correctly
    const params = context.params || {};
    const { id, lotId } = params;
    const user = context.user;
    
    // Add console logging to help debug production issues
    console.log('Update lot request received:', { id, lotId });
    
    await connectMongoDB();
    console.log('MongoDB connected');

    // Use try-catch for body parsing
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed:', body);
    } catch (err) {
      console.error('Error parsing request body:', err);
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    // Validate required fields
    if (body.Quantity === undefined && body.Quantity !== 0) {
      console.error('Missing required field: Quantity');
      return NextResponse.json({ message: "Quantity is required" }, { status: 400 });
    }

    // Find the chemical using a try-catch to catch potential MongoDB errors
    let chem;
    try {
      chem = await Chemical.findById(id);
      console.log('Chemical found:', chem ? 'yes' : 'no');
    } catch (err) {
      console.error('Error finding chemical:', err);
      return NextResponse.json({ message: "Error finding chemical" }, { status: 500 });
    }

    if (!chem) {
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    // Find the lot using a try-catch and handle potential errors 
    // with chem.Lots.id method not existing
    let lot;
    try {
      lot = chem.Lots.id(lotId);
      console.log('Lot found:', lot ? 'yes' : 'no');
    } catch (err) {
      console.error('Error finding lot:', err);
      return NextResponse.json({ message: "Error finding lot" }, { status: 500 });
    }

    if (!lot) {
      return NextResponse.json({ message: "Lot not found" }, { status: 404 });
    }

    // Store old values for audit
    const oldQuantity = lot.Quantity;
    console.log('Old quantity:', oldQuantity);

    // Update lot fields
    if (body.LotNumber !== undefined) lot.LotNumber = body.LotNumber;
    if (body.Quantity !== undefined) lot.Quantity = parseFloat(body.Quantity);

    // Use try-catch for saving
    try {
      await chem.save();
      console.log('Chemical saved');
    } catch (err) {
      console.error('Error saving chemical:', err);
      return NextResponse.json({ message: "Error saving chemical" }, { status: 500 });
    }

    // Create audit entry if quantity changed
    if ((body.Quantity !== undefined || body.Quantity === 0) && body.Quantity !== oldQuantity) {
      const quantityChange = parseFloat(body.Quantity) - oldQuantity;
      console.log('Quantity changed by:', quantityChange);
      
      try {
        await ChemicalAudit.logUsage({
          chemical: chem,
          lotNumber: lot.LotNumber,
          quantityUsed: Math.abs(quantityChange),
          quantityRemaining: body.Quantity,
          user,
          notes: body.notes || `Quantity ${quantityChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(quantityChange)}`,
          project: body.project,
          department: body.department,
          action: quantityChange > 0 ? 'ADJUST' : body.Quantity === 0 ? 'DEPLETE' : 'USE'
        });
        console.log('Audit entry created');
      } catch (err) {
        console.error('Error creating audit entry:', err);
        // Continue even if audit fails, don't return error
      }
    }

    // Use try-catch for serializing the response
    let doc;
    try {
      doc = chem.toObject();
    } catch (err) {
      console.error('Error converting to object:', err);
      return NextResponse.json({ message: "Error processing response" }, { status: 500 });
    }

    console.log('Request completed successfully');
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error('Error updating lot:', err);
    return NextResponse.json({ message: err.message || "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE handler for removing a lot
 */
async function deleteLot(request, context) {
  // [DELETE function remains unchanged]
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
      notes: 'Lot removed',
      action: 'REMOVE'
    });

    // Remove the lot
    chem.Lots = chem.Lots.filter((l) => l._id.toString() !== lotId);
    await chem.save();

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error('Error deleting lot:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

// Create handlers with middleware
const putHandler = withRateLimit(withAuth(updateLot));
const deleteHandler = withRateLimit(withAuth(deleteLot));

// Export handlers
export { putHandler as PUT, deleteHandler as DELETE };