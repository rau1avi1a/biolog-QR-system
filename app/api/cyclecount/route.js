import { NextResponse } from 'next/server';
import connectMongoDB from '@/db/index';
import { Item } from '@/db/schemas/Item';
// Removed imports for Chemical and ChemicalAudit models since they don't exist
// import { Chemical } from '@/models/Chemical';
// import { ChemicalAudit } from '@/models/ChemicalAudit';

export async function GET(request) {
  try {
    await connectMongoDB();
    
    // Get chemicals that need cycle counting (using Item model instead)
    const chemicals = await Item.find({ 
      itemType: 'chemical',
      // Add any cycle count criteria here, such as:
      // lastCounted: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // 90 days ago
    })
    .select('_id displayName sku qtyOnHand uom location Lots')
    .lean();

    return NextResponse.json({
      success: true,
      chemicals: chemicals.map(chem => ({
        _id: chem._id,
        displayName: chem.displayName,
        sku: chem.sku,
        qtyOnHand: chem.qtyOnHand || 0,
        uom: chem.uom || 'ea',
        location: chem.location || '',
        lotCount: chem.Lots ? chem.Lots.length : 0,
        needsCycleCount: true // You can add logic here to determine if it needs counting
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch cycle count data',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await connectMongoDB();
    
    const { itemId, countedQuantity, notes } = await request.json();
    
    if (!itemId || countedQuantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'itemId and countedQuantity are required' },
        { status: 400 }
      );
    }

    // Find the chemical item
    const item = await Item.findById(itemId);
    if (!item || item.itemType !== 'chemical') {
      return NextResponse.json(
        { success: false, error: 'Chemical not found' },
        { status: 404 }
      );
    }

    const previousQuantity = item.qtyOnHand || 0;
    const variance = countedQuantity - previousQuantity;

    // Update the item quantity
    item.qtyOnHand = countedQuantity;
    item.lastCountedAt = new Date();
    await item.save();

    // TODO: Create audit record when you have the audit model
    // const audit = await ChemicalAudit.create({
    //   itemId: itemId,
    //   previousQuantity,
    //   countedQuantity,
    //   variance,
    //   notes,
    //   countedAt: new Date(),
    //   countedBy: 'System' // Replace with actual user
    // });

    return NextResponse.json({
      success: true,
      data: {
        itemId,
        previousQuantity,
        countedQuantity,
        variance,
        notes
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to record cycle count',
        message: error.message 
      },
      { status: 500 }
    );
  }
}