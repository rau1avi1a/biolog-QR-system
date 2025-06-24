// app/api/roles/seed/route.js
import { NextResponse } from 'next/server';
import connectMongoDB from '@/db/index';
import Role from '@/db/schemas/Role';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await connectMongoDB();
    
    // Seed the default roles
    await Role.seedDefaultRoles();
    
    // Get all roles to return
    const roles = await Role.find().lean();
    
    return NextResponse.json({
      success: true,
      message: 'Default roles seeded successfully',
      roles: roles
    });
    
  } catch (error) {
    console.error('Role seeding error:', error);
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}