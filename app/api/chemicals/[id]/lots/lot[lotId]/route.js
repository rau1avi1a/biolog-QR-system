// app/api/chemicals/[id]/lots/[lotId]/route.js
import Chemical from "@/models/Chemical";
import ChemicalAudit from "@/models/ChemicalAudit";
import connectMongoDB from "@lib/index.js";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { withRateLimit } from "@/middleware/rateLimit";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * PUT handler for updating a lot
 */
async function updateLot(request, context) {
  try {
    const params = context.params || {};
    const { id, lotId } = params;
    const user = context.user;
    
    console.log('Update lot request received:', { id, lotId });
    
    await connectMongoDB();
    console.log('MongoDB connected');

    let body;
    try {
      body = await request.json();
      console.log('Request body parsed:', body);
    } catch (err) {
      console.error('Error parsing request body:', err);
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    // Find the chemical
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

    // IMPORTANT FIX: Find lot using alternative method that works in all environments
    let lot;
    try {
      // Try multiple approaches to find the lot
      console.log('Finding lot with ID:', lotId);
      console.log('Lots available:', chem.Lots.length);
      
      // Option 1: Using id() method
      lot = chem.Lots.id(lotId);
      
      // Option 2: If id() fails, try manual find with toString()
      if (!lot) {
        console.log('id() method failed, trying alternative lookup');
        lot = chem.Lots.find(l => l._id.toString() === lotId);
      }
      
      // Option 3: Try with ObjectId conversion
      if (!lot) {
        console.log('Alternative lookup failed, trying with ObjectId conversion');
        try {
          const objectId = new mongoose.Types.ObjectId(lotId);
          lot = chem.Lots.find(l => l._id.equals(objectId));
        } catch (e) {
          console.error('ObjectId conversion failed:', e);
        }
      }
      
      console.log('Lot found:', lot ? 'yes' : 'no');
      
      // Log all lot IDs for debugging
      console.log('Available lot IDs:', chem.Lots.map(l => l._id.toString()));
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