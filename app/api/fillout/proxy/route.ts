import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUserId } from '@/lib/auth-helpers';
import { checkPermission } from '@/lib/permissions';
import { queryFillout, getFilloutRecord, createFilloutRecord, updateFilloutRecord, deleteFilloutRecord } from '@/lib/fillout';

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

    const body = await request.json();
    const { method, tableId, recordId, appId, action, ...options } = body;

    // Check permission based on action
    const permissionAction = method === 'GET' ? 'read' : method === 'DELETE' ? 'delete' : 'write';
    
    if (appId) {
      const hasPermission = await checkPermission({
        userId,
        appId,
        resourceType: 'table',
        resourceId: tableId,
        action: permissionAction,
      });

      if (!hasPermission) {
        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    // Execute Fillout operation
    let result;
    switch (method) {
      case 'GET':
        if (recordId) {
          result = await getFilloutRecord(tableId, recordId);
        } else {
          result = await queryFillout({ tableId, ...options });
        }
        break;
      case 'POST':
        result = await createFilloutRecord(tableId, options.fields);
        break;
      case 'PATCH':
        if (!recordId) {
          return NextResponse.json(
            { error: 'recordId required for PATCH' },
            { status: 400 }
          );
        }
        result = await updateFilloutRecord(tableId, recordId, options.fields);
        break;
      case 'DELETE':
        if (!recordId) {
          return NextResponse.json(
            { error: 'recordId required for DELETE' },
            { status: 400 }
          );
        }
        await deleteFilloutRecord(tableId, recordId);
        result = { success: true };
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid method' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Fillout proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

