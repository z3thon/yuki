import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';

import { PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/punches/[id]
 * Get a single punch with permission check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check app access
    const hasAccess = await hasAppAccess(user.uid, 'hr');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to HR app' },
        { status: 403 }
      );
    }

    // Check view-level permission
    const canReadPunches = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'time-tracking',
      resourceType: 'punch',
      action: 'read',
    });

    if (!canReadPunches) {
      return NextResponse.json(
        { error: 'Access denied to time tracking view' },
        { status: 403 }
      );
    }

    // Get punch
    const punch = await getFilloutRecord(PUNCHES_TABLE_ID, id);
    
    if (!punch) {
      return NextResponse.json(
        { error: 'Punch not found' },
        { status: 404 }
      );
    }

    // Format punch
    const formattedPunch = {
      id: punch.id,
      employeeId: Array.isArray(punch.fields.employee_id) 
        ? punch.fields.employee_id[0] 
        : punch.fields.employee_id,
      clientId: Array.isArray(punch.fields.client_id) 
        ? punch.fields.client_id[0] 
        : punch.fields.client_id,
      punchInTime: punch.fields.punch_in_time,
      punchOutTime: punch.fields.punch_out_time || null,
      duration: punch.fields.duration || null,
      notes: punch.fields.memo || null,
      createdAt: punch.fields.created_at || punch.createdTime,
      updatedAt: punch.fields.updated_at || punch.createdTime,
    };

    return NextResponse.json({ punch: formattedPunch });
  } catch (error: any) {
    console.error('Error fetching punch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr/punches/[id]
 * Update a punch (requires write permission)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check app access
    const hasAccess = await hasAppAccess(user.uid, 'hr');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to HR app' },
        { status: 403 }
      );
    }

    // Check write permission
    const canWritePunches = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'time-tracking',
      resourceType: 'punch',
      action: 'write',
    });

    if (!canWritePunches) {
      return NextResponse.json(
        { error: 'Permission denied - you cannot edit punches' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Build update fields
    const updateFields: Record<string, any> = {};
    
    if (body.punchInTime !== undefined) {
      updateFields.punch_in_time = body.punchInTime;
    }
    
    if (body.punchOutTime !== undefined) {
      updateFields.punch_out_time = body.punchOutTime || null;
    }
    
    if (body.notes !== undefined) {
      updateFields.memo = body.notes || null;
    }

    // Update punch
    await updateFilloutRecord(PUNCHES_TABLE_ID, id, updateFields);

    // Get updated punch
    const updatedPunch = await getFilloutRecord(PUNCHES_TABLE_ID, id);
    
    const formattedPunch = {
      id: updatedPunch.id,
      employeeId: Array.isArray(updatedPunch.fields.employee_id) 
        ? updatedPunch.fields.employee_id[0] 
        : updatedPunch.fields.employee_id,
      clientId: Array.isArray(updatedPunch.fields.client_id) 
        ? updatedPunch.fields.client_id[0] 
        : updatedPunch.fields.client_id,
      punchInTime: updatedPunch.fields.punch_in_time,
      punchOutTime: updatedPunch.fields.punch_out_time || null,
      duration: updatedPunch.fields.duration || null,
      notes: updatedPunch.fields.memo || null,
      createdAt: updatedPunch.fields.created_at || updatedPunch.createdTime,
      updatedAt: updatedPunch.fields.updated_at || updatedPunch.createdTime,
    };

    return NextResponse.json({ punch: formattedPunch });
  } catch (error: any) {
    console.error('Error updating punch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

