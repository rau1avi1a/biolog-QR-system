// app/api/chemicals/[id]/lots/[lotId]/audit/route.js
import { NextResponse } from 'next/server';
import ChemicalAudit from '@/models/ChemicalAudit';
import Chemical from '@/models/Chemical';
import { withAuth } from '@/lib/api-auth';

async function getLotAuditHistory(request, context) {
  try {
    const params = await Promise.resolve(context.params);
    const { id, lotId } = params;

    // First verify the chemical and lot exist
    const chemical = await Chemical.findById(id);
    if (!chemical) {
      return NextResponse.json(
        { message: 'Chemical not found' },
        { status: 404 }
      );
    }

    const lot = chemical.Lots.id(lotId);
    if (!lot) {
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

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching lot audit history:', error);
    return NextResponse.json(
      { message: 'Error fetching audit history', error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getLotAuditHistory);