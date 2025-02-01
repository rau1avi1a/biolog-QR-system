// app/api/chemicals/[id]/audit/route.js
import { NextResponse } from 'next/server';
import ChemicalAudit from '@/models/ChemicalAudit';
import Chemical from '@/models/Chemical';
import { withAuth } from '@/lib/api-auth';

async function getAuditHistory(request, context) {
  try {
    const { id } = await Promise.resolve(context.params);

    // First verify the chemical exists
    const chemical = await Chemical.findById(id);
    if (!chemical) {
      return NextResponse.json(
        { message: 'Chemical not found' },
        { status: 404 }
      );
    }

    // Get audit history
    const history = await ChemicalAudit.find({
      'chemical.BiologNumber': chemical.BiologNumber
    })
    .sort({ createdAt: -1 }) // Most recent first
    .limit(50); // Limit to last 50 transactions

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching audit history:', error);
    return NextResponse.json(
      { message: 'Error fetching audit history', error: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAuditHistory);