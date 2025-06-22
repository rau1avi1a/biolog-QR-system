// app/api/netsuite/bom/route.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/lib/index';
import User from '@/models/User';
import { createBOMService } from '@/services/netsuite/index.js';

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
    const assemblyItemId = searchParams.get('assemblyItemId');
    const action = searchParams.get('action');

    if (!assemblyItemId) {
      return NextResponse.json(
        { success: false, message: 'Assembly Item ID is required' },
        { status: 400 }
      );
    }

    const bomService = createBOMService(user);

    switch (action) {
      case 'getBOM':
        const bomData = await bomService.getAssemblyBOM(assemblyItemId);
        const recipe = bomService.formatBOMAsRecipe(bomData);
        
        return NextResponse.json({
          success: true,
          bom: bomData,
          recipe: recipe
        });

      case 'search':
        // For searching assembly items when user needs to pick a solution
        const searchTerm = searchParams.get('q') || '';
        const assemblyItems = await bomService.searchAssemblyItems(searchTerm);
        
        return NextResponse.json({
          success: true,
          items: assemblyItems
        });

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action. Use getBOM or search' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('BOM API Error:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Failed to fetch BOM data',
      error: error.message 
    }, { status: 500 });
  }
}