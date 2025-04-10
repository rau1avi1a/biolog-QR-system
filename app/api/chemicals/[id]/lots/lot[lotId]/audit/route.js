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
    let { id, lotId } = params;
    
    console.log('Fetching audit history for:', { id, lotId });
    
    // Clean the lotId by removing any "lot" prefix
    if (lotId && lotId.startsWith('lot')) {
      lotId = lotId.replace(/^lot/, '');
      console.log('Cleaned lot ID by removing "lot" prefix:', lotId);
    }

    // First verify the chemical and lot exist
    const chemical = await Chemical.findById(id);
    if (!chemical) {
      console.log('Chemical not found');
      return NextResponse.json(
        { message: 'Chemical not found' },
        { status: 404 }
      );
    }

    // Use the same robust lot-finding approach we implemented earlier
    let lot = null;
    
    // Try method 1: Using id()
    lot = chemical.Lots.id(lotId);
    console.log('Approach 1 result:', lot ? 'found' : 'not found');
    
    // Try method 2: Using find with toString()
    if (!lot) {
      lot = chemical.Lots.find(l => l._id.toString() === lotId.toString());
      console.log('Approach 2 result:', lot ? 'found' : 'not found');
    }
    
    // Try method 3: Using various string comparisons
    if (!lot) {
      for (const l of chemical.Lots) {
        if (l._id.toString() === lotId || 
            l._id === lotId || 
            String(l._id) === String(lotId)) {
          lot = l;
          console.log('Approach 3 found match');
          break;
        }
      }
    }
    
    // Try method 4: Using ObjectId
    if (!lot) {
      try {
        const objectId = new mongoose.Types.ObjectId(lotId);
        lot = chemical.Lots.find(l => l._id.equals(objectId));
        console.log('Approach 4 result:', lot ? 'found' : 'not found');
      } catch (e) {
        console.error('ObjectId conversion failed:', e);
      }
    }
    
    // Final check
    if (!lot) {
      console.log('Lot not found. Available lots:', chemical.Lots.map(l => l._id.toString()));
      return NextResponse.json(
        { 
          message: 'Lot not found',
          lotIdRequested: lotId,
          availableLots: chemical.Lots.map(l => l._id.toString())
        },
        { status: 404 }
      );
    }

    console.log('Found lot:', lot.LotNumber);

    // Get audit history specific to this lot
    const history = await ChemicalAudit.find({
      'chemical.BiologNumber': chemical.BiologNumber,
      'lot.LotNumber': lot.LotNumber
    })
    .sort({ createdAt: -1 }) // Most recent first
    .limit(50); // Limit to last 50 transactions

    console.log(`Found ${history.length} audit records for lot ${lot.LotNumber}`);
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