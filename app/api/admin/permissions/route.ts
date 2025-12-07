import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser, verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { getUserPermissions, createUserPermission } from '@/lib/permission-tables';
import { grantAppAccess, getUserAppAccess } from '@/lib/permission-tables';
import { clearPermissionCache } from '@/lib/permissions';
import { getEmployeeIdForUser } from '@/lib/employee-lookup';

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

    // Get userId from query params (for admin viewing other users)
    const targetUserId = request.nextUrl.searchParams.get('userId') || userId;
    
    // TODO: Check if user is admin or viewing own permissions
    // For now, allow users to view their own permissions

    const permissions = await getUserPermissions(targetUserId);
    const appAccess = await getUserAppAccess(targetUserId);
    
    return NextResponse.json({ 
      permissions,
      appAccess,
    });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify auth
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Check if user is admin
    // For now, allow all authenticated users (restrict in production)

    const body = await request.json();
    
    // Handle app access grant
    if (body.type === 'app_access' && body.targetUserId && body.appId) {
      // Try to find employee ID for the target user
      let employeeId: string | null = null;
      if (body.targetUserEmail) {
        employeeId = await getEmployeeIdForUser(body.targetUserEmail);
      }
      
      await grantAppAccess(body.targetUserId, body.appId, employeeId || undefined);
      clearPermissionCache(body.targetUserId);
      return NextResponse.json({ success: true });
    }
    
    // Handle permission creation
    if (body.userId && body.appId && body.actions) {
      // Try to find employee ID for the user
      let employeeId: string | null = null;
      if (body.userEmail) {
        employeeId = await getEmployeeIdForUser(body.userEmail);
      }
      
      await createUserPermission({
        userId: body.userId,
        employeeId: employeeId || undefined,
        appId: body.appId,
        viewId: body.viewId,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        actions: body.actions,
      });
      clearPermissionCache(body.userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error creating permission:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

