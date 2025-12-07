import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { getTablesFromConfig } from '@/lib/fillout-tables';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const userId = await verifyAuthAndGetUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Check if user is admin (for now, allow all authenticated users)
    // In production, add admin check here

    // Use config file for fast, synchronous lookup (no API call needed)
    const tables = getTablesFromConfig();
    
    return NextResponse.json({ tables });
  } catch (error: any) {
    console.error('Error listing tables:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

