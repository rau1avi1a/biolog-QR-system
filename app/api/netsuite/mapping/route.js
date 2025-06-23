// app/api/netsuite/mapping/route.js - Map NetSuite components to local chemicals
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import connectMongoDB from '@/lib/index';
import User from '@/models/User';
import { Item } from '@/models/Item';

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

    return user;

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

// Fuzzy matching function for chemical names
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Word-based matching
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matchingWords = 0;
  const totalWords = Math.max(words1.length, words2.length);
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matchingWords++;
        break;
      }
    }
  }
  
  return matchingWords / totalWords;
}

// Find potential local chemical matches for NetSuite components
async function findChemicalMatches(netsuiteComponents) {
  await connectMongoDB();
  
  // Get all local chemicals
  const localChemicals = await Item.find({ itemType: 'chemical' })
    .select('_id displayName sku casNumber netsuiteInternalId')
    .lean();
  
  const mappingResults = [];
  
  for (const component of netsuiteComponents) {
    const matches = [];
    
    // Try to match by NetSuite Internal ID first (most reliable)
    if (component.itemId) {
      const exactMatch = localChemicals.find(chem => 
        chem.netsuiteInternalId === component.itemId
      );
      
      if (exactMatch) {
        matches.push({
          chemical: exactMatch,
          confidence: 1.0,
          matchType: 'netsuite_id'
        });
      }
    }
    
    // If no exact NetSuite ID match, try fuzzy matching by name
    if (matches.length === 0 && component.ingredient) {
      const nameMatches = localChemicals.map(chem => ({
        chemical: chem,
        confidence: calculateSimilarity(component.ingredient, chem.displayName),
        matchType: 'name'
      }))
      .filter(match => match.confidence > 0.3) // Only include reasonable matches
      .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
      .slice(0, 3); // Top 3 matches
      
      matches.push(...nameMatches);
    }
    
    mappingResults.push({
      netsuiteComponent: component,
      matches: matches
    });
  }
  
  return mappingResults;
}

export async function POST(request) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    
    const body = await request.json();
    const { components } = body;
    
    if (!components || !Array.isArray(components)) {
      return NextResponse.json({
        success: false,
        message: 'Components array is required'
      }, { status: 400 });
    }
    
    // Find matches for each component
    const mappingResults = await findChemicalMatches(components);
    
    return NextResponse.json({
      success: true,
      mappingResults: mappingResults,
      summary: {
        totalComponents: components.length,
        componentsWithMatches: mappingResults.filter(r => r.matches.length > 0).length,
        exactMatches: mappingResults.filter(r => 
          r.matches.some(m => m.matchType === 'netsuite_id')
        ).length
      }
    });

  } catch (error) {
    console.error('NetSuite mapping error:', error);
    return NextResponse.json({ 
      success: false,
      message: error.message 
    }, { status: 500 });
  }
}