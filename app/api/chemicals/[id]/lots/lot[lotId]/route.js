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
    // Instead of destructuring params immediately, await it first
    const params = await Promise.resolve(context.params);
    let { id, lotId } = params;  // Now it's safe to destructure
    const user = context.user;
    
    console.log('Update lot request received (raw params):', { id, lotId });
    
    // IMPORTANT: Clean the lotId by removing any "lot" prefix
    if (lotId && lotId.startsWith('lot')) {
      lotId = lotId.replace(/^lot/, '');
      console.log('Cleaned lot ID by removing "lot" prefix:', lotId);
    }
    
    console.log('Using cleaned params:', { id, lotId });
    
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

    // Find the lot using our improved lot finding logic
    let lot = null;
    try {
      // Same lot-finding logic as before...
      // APPROACH 1: Try direct subdocument access with id()
      lot = chem.Lots.id(lotId);
      
      // APPROACH 2: If id() fails, try manual find with toString()
      if (!lot) {
        lot = chem.Lots.find(l => l._id.toString() === lotId);
      }
      
      // Additional approaches as needed...
      
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

    // Save changes
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
        // IMPORTANT CHANGE: Determine the correct action based on the quantity change
        const action = quantityChange > 0 
          ? 'ADD'       // For increasing quantity
          : body.Quantity === 0 
            ? 'DEPLETE' // For reducing to zero
            : 'USE';    // For decreasing quantity
        
        console.log('Selected audit action:', action);
        
        await ChemicalAudit.logUsage({
          chemical: chem,
          lotNumber: lot.LotNumber,
          quantityUsed: Math.abs(quantityChange),
          quantityRemaining: body.Quantity,
          user,
          notes: body.notes || `${quantityChange > 0 ? 'Added' : 'Removed'} ${Math.abs(quantityChange)} units`,
          project: body.project,
          department: body.department,
          action: action  // Use the determined action
        });
        console.log('Audit entry created');
      } catch (err) {
        console.error('Error creating audit entry:', err);
        // Continue even if audit fails, don't return error
      }
    }

    // Return the updated chemical
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
  try {
    const params = await Promise.resolve(context.params);
    const { id, lotId } = params;
    const user = context.user;
    
    console.log('Delete lot request received:', { id, lotId });
    
    await connectMongoDB();
    console.log('MongoDB connected');

    const chem = await Chemical.findById(id);
    if (!chem) {
      console.log('Chemical not found');
      return NextResponse.json({ message: "Chemical not found" }, { status: 404 });
    }

    // IMPROVED LOT FINDING - same approach as in updateLot
    let lot = null;
    
    // APPROACH 1: Try direct subdocument access with id()
    lot = chem.Lots.id(lotId);
    console.log('Approach 1 result:', lot ? 'found' : 'not found');
    
    // APPROACH 2: Try manual find with direct comparison
    if (!lot) {
      lot = chem.Lots.find(l => l._id.toString() === lotId.toString());
      console.log('Approach 2 result:', lot ? 'found' : 'not found');
    }
    
    // APPROACH 3: Try with various string comparisons
    if (!lot) {
      for (const l of chem.Lots) {
        if (l._id.toString() === lotId || 
            l._id === lotId || 
            String(l._id) === String(lotId)) {
          lot = l;
          console.log('Approach 3 found match');
          break;
        }
      }
    }
    
    // APPROACH 4: Try with ObjectId
    if (!lot) {
      try {
        const objectId = new mongoose.Types.ObjectId(lotId);
        lot = chem.Lots.find(l => l._id.equals(objectId));
        console.log('Approach 4 result:', lot ? 'found' : 'not found');
      } catch (e) {
        console.error('ObjectId conversion failed:', e);
      }
    }
    
    // APPROACH 5: Last resort - try case-insensitive if strings
    if (!lot) {
      lot = chem.Lots.find(l => 
        l._id.toString().toLowerCase() === lotId.toString().toLowerCase()
      );
      console.log('Approach 5 result:', lot ? 'found' : 'not found');
    }

    if (!lot) {
      console.log('Lot not found. Available lots:', chem.Lots.map(l => l._id.toString()));
      return NextResponse.json({ 
        message: "Lot not found",
        lotIdRequested: lotId,
        availableLots: chem.Lots.map(l => l._id.toString()) 
      }, { status: 404 });
    }

    // Create audit entry for removal
    try {
      await ChemicalAudit.logUsage({
        chemical: chem,
        lotNumber: lot.LotNumber,
        quantityUsed: lot.Quantity,
        quantityRemaining: 0,
        user,
        notes: 'Lot removed',
        action: 'REMOVE'
      });
      console.log('Audit entry created for lot removal');
    } catch (err) {
      console.error('Error creating audit entry for removal:', err);
      // Continue even if audit fails
    }

    // Remove the lot - IMPROVED: use filter with multiple comparison methods
    chem.Lots = chem.Lots.filter((l) => {
      return !(
        l._id.toString() === lotId.toString() ||
        l._id === lotId ||
        String(l._id) === String(lotId)
      );
    });
    
    await chem.save();
    console.log('Chemical saved after lot removal');

    const doc = chem.toObject();
    return NextResponse.json(doc, { status: 200 });
  } catch (err) {
    console.error('Error deleting lot:', err);
    return NextResponse.json({ 
      message: err.message || "Internal server error",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

// Create handlers with middleware
const putHandler = withRateLimit(withAuth(updateLot));
const deleteHandler = withRateLimit(withAuth(deleteLot));

// Export handlers
export { putHandler as PUT, deleteHandler as DELETE };