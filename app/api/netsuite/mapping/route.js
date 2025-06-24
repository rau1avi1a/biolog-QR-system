// app/api/netsuite/mapping/route.js - Fixed export
import { NextResponse } from 'next/server';
import { withAuth } from '@/db/lib/api-auth';
import { mapNetSuiteComponents } from '@/db/services/netsuite/mapping.service';

/**
 * POST /api/netsuite/mapping
 * Map NetSuite BOM components to local chemicals and solutions
 */
async function handlePOST(request, context) {
  try {
    const body = await request.json();
    const { components } = body;

    if (!components || !Array.isArray(components)) {
      return NextResponse.json(
        { success: false, message: 'Components array is required' },
        { status: 400 }
      );
    }

    console.log(`Mapping ${components.length} NetSuite components to local chemicals and solutions...`);

    // Use enhanced mapping service that searches both chemicals and solutions
    const mappingResults = await mapNetSuiteComponents(components);

    // Calculate summary statistics
    const summary = {
      totalComponents: mappingResults.length,
      exactMatches: mappingResults.filter(r => r.bestMatch?.confidence === 1.0).length,
      highConfidenceMatches: mappingResults.filter(r => r.bestMatch?.confidence >= 0.8 && r.bestMatch?.confidence < 1.0).length,
      mediumConfidenceMatches: mappingResults.filter(r => r.bestMatch?.confidence >= 0.6 && r.bestMatch?.confidence < 0.8).length,
      componentsWithMatches: mappingResults.filter(r => r.bestMatch).length,
      unmappedComponents: mappingResults.filter(r => !r.bestMatch).length,
      chemicalMatches: mappingResults.filter(r => r.bestMatch?.chemical.itemCategory === 'chemical').length,
      solutionMatches: mappingResults.filter(r => r.bestMatch?.chemical.itemCategory === 'solution').length
    };

    console.log('Mapping completed:', summary);

    return NextResponse.json({
      success: true,
      mappingResults,
      summary,
      message: `Successfully mapped ${summary.componentsWithMatches}/${summary.totalComponents} components (${summary.chemicalMatches} chemicals, ${summary.solutionMatches} solutions)`
    });

  } catch (error) {
    console.error('Error in NetSuite mapping:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: `Mapping failed: ${error.message}`,
        mappingResults: [] // Return empty array so UI doesn't break
      },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
    return withAuth(handlePOST)(request, context);
  }