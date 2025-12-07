import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { initializePermissionTableIds } from '@/lib/permission-tables';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const userId = await verifyAuthAndGetUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Check if user is admin
    // For now, allow all authenticated users to initialize

    const tableIds = await initializePermissionTableIds();
    
    return NextResponse.json({ 
      success: true,
      tableIds,
      message: 'Permission table IDs initialized. Make sure tables exist in Fillout.',
    });
  } catch (error: any) {
    console.error('Error initializing permission tables:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

