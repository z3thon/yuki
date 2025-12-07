import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { checkPermission, PermissionCheck } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify auth and get userId (server-side only)
    const userId = await verifyAuthAndGetUserId(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get permission check from body
    const body = await request.json();
    
    // SECURITY: Override userId from body with verified userId from token
    // This prevents users from checking other users' permissions
    const permissionCheck: PermissionCheck = {
      userId, // Always use verified userId from token
      appId: body.appId,
      viewId: body.viewId,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      action: body.action,
    };

    // Check permission
    const hasPermission = await checkPermission(permissionCheck);

    return NextResponse.json({ hasPermission });
  } catch (error: any) {
    console.error('Permission check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

