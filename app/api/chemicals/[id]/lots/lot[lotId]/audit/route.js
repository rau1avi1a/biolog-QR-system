// app/api/chemicals/[id]/lots/[lotId]/audit/route.js
import { NextResponse } from 'next/server';
import ChemicalAudit from '@/models/ChemicalAudit';
import Chemical from '@/models/Chemical';
import { withAuth } from '@/lib/api-auth';
import { withRateLimit } from '@/middleware/rateLimit';
import mongoose from 'mongoose'; // Import mongoose for ObjectId handling

/**
 * Get audit history for a specific lot
 * @param {Request} request - The request object
 * @param {Object} context - The context object containing params
 * @returns {Promise<NextResponse>} The response object
 */
async function getLotAuditHistory(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id, lotId } = params;
    
    console.log('Fetching audit history for:', { id, lotId });

    // First verify the chemical and lot exist
    const chemical = await Chemical.findById(id);
    if (!chemical) {
      console.log('Chemical not found');
      return NextResponse.json(
        { message: 'Chemical not found' },
        { status: 404 }
      );
    }

    // Use the same robust lot-finding approach as in the main route
    let lot;
    
    // Try method 1: Using id()
    lot = chemical.Lots.id(lotId);
    
    // Try method 2: Using find with toString()
    if (!lot) {
      lot = chemical.Lots.find(l => l._id.toString() === lotId);
    }
    
    // Try method 3: Using ObjectId conversion
    if (!lot) {
      try {
        const objectId = new mongoose.Types.ObjectId(lotId);
        lot = chemical.Lots.find(l => l._id.equals(objectId));
      } catch (e) {
        console.error('ObjectId conversion failed:', e);
      }
    }
    
    console.log('Lot found:', lot ? 'yes' : 'no');
    
    if (!lot) {
      // Log all available lots for debugging
      console.log('Available lot IDs:', chemical.Lots.map(l => l._id.toString()));
      return NextResponse.json(
        { message: 'Lot not found' },
        { status: 404 }
      );
    }

    // Get audit history specific to this lot
    const history = await ChemicalAudit.find({
      'chemical.BiologNumber': chemical.BiologNumber,
      'lot.LotNumber': lot.LotNumber
    })
    .sort({ createdAt: -1 }) // Most recent first
    .limit(50); // Limit to last 50 transactions

    console.log(`Found ${history.length} audit records`);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching lot audit history:', error);
    return NextResponse.json(
      { message: 'Error fetching audit history', error: error.message },
      { status: 500 }
    );
  }
}

// Export the handler with middleware
const handler = withRateLimit(withAuth(getLotAuditHistory));
export { handler as GET };