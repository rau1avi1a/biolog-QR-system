// app/api/netsuite/bom/route.js - Updated with search support
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/db/index';
import User from '@/db/schemas/User';
import { createBOMService } from '@/db/services/netsuite/index.js';

export const dynamic = 'force-dynamic';

// Helper function to get user from JWT token
async function getUserFromRequest(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    await connectMongoDB();
    const user = await User.findById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.hasNetSuiteAccess()) {
      throw new Error('NetSuite access not configured');
    }

    return user;

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

export async function GET(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const assemblyItemId = searchParams.get('assemblyItemId');
    const searchQuery = searchParams.get('q');

    const bomService = createBOMService(user);

    switch (action) {
      case 'search':
        // Search for assembly items/solutions
        if (!searchQuery || searchQuery.trim().length < 2) {
          return NextResponse.json({
            success: true,
            items: [],
            message: 'Search query too short'
          });
        }

        try {
          const assemblyItems = await bomService.searchAssemblyItems(searchQuery.trim());
          
          return NextResponse.json({
            success: true,
            items: assemblyItems || [],
            query: searchQuery,
            count: assemblyItems?.length || 0
          });
        } catch (searchError) {
          console.error('Assembly item search error:', searchError);
          return NextResponse.json({
            success: false,
            message: `Search failed: ${searchError.message}`,
            items: []
          });
        }

      case 'getBOM':
        // Get BOM for specific assembly item
        if (!assemblyItemId) {
          return NextResponse.json({
            success: false,
            message: 'Assembly Item ID is required for getBOM action'
          }, { status: 400 });
        }

        try {
          const bomData = await bomService.getAssemblyBOM(assemblyItemId);
          const recipe = bomService.formatBOMAsRecipe(bomData);
          
          return NextResponse.json({
            success: true,
            bom: bomData,
            recipe: recipe
          });
        } catch (bomError) {
          console.error('BOM fetch error:', bomError);
          return NextResponse.json({
            success: false,
            message: `Failed to fetch BOM: ${bomError.message}`
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Use "search" or "getBOM"'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('NetSuite BOM API Error:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Authentication or configuration error',
      error: error.message 
    }, { status: 500 });
  }
}