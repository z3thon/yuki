import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { hasAppAccess } from '@/lib/permissions';

/**
 * GET /api/hr/clients
 * List clients (currently returns empty array as clients feature is not yet implemented)
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check app access
    const hasAccess = await hasAppAccess(user.uid, 'hr');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to HR app' },
        { status: 403 }
      );
    }

    // Clients feature not yet implemented - return empty array
    return NextResponse.json({
      clients: [],
    });
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
