// app/api/chemicals/[id]/audit/route.ts
import { NextResponse } from 'next/server';
import ChemicalAudit from '@/models/ChemicalAudit';
import Chemical from '@/models/Chemical';
import { withAuth } from '@/lib/api-auth';
import { withRateLimit } from '@/middleware/rateLimit';

async function getAuditHistory(
  request,
  context
) {
  try {
    const params = await Promise.resolve(context.params);
    const { id } = params;

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
    .sort({ createdAt: -1 })
    .limit(50);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching audit history:', error);
    return NextResponse.json(
      { message: 'Error fetching audit history', error: String(error) },
      { status: 500 }
    );
  }
}

// Compose middleware in the correct order
export const GET = withRateLimit(withAuth(getAuditHistory));