import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';

import { PUNCH_ALTERATIONS_TABLE_ID, PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * POST /api/hr/alterations/[id]/approve
 * Approve a punch alteration (requires approve permission)
 */
export async function POST(
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

    // Check approve permission
    const canApprove = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'punch-alterations',
      resourceType: 'alteration',
      action: 'approve',
    });

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Permission denied - you cannot approve alterations' },
        { status: 403 }
      );
    }

    // Get alteration
    const alteration = await getFilloutRecord(PUNCH_ALTERATIONS_TABLE_ID, id);
    
    if (!alteration) {
      return NextResponse.json(
        { error: 'Alteration not found' },
        { status: 404 }
      );
    }

    if (alteration.fields.status !== 'pending') {
      return NextResponse.json(
        { error: 'Alteration is not pending' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reviewNotes = body.reviewNotes || '';

    // Update alteration status
    await updateFilloutRecord(PUNCH_ALTERATIONS_TABLE_ID, id, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    });

    // Apply alteration to punch if punch_id exists
    const punchId = Array.isArray(alteration.fields.punch_id)
      ? alteration.fields.punch_id[0]
      : alteration.fields.punch_id;

    if (punchId) {
      const punchUpdates: Record<string, any> = {};
      
      // Copy new punch in time if provided
      if (alteration.fields.new_punch_in_time) {
        punchUpdates.punch_in_time = alteration.fields.new_punch_in_time;
      }
      
      // Copy new punch out time if provided (can be null to clear it)
      if (alteration.fields.new_punch_out_time !== undefined) {
        punchUpdates.punch_out_time = alteration.fields.new_punch_out_time;
      }
      
      // Copy new memo if provided
      if (alteration.fields.new_memo !== undefined) {
        punchUpdates.memo = alteration.fields.new_memo;
      }
      
      // Copy new project IDs if provided (overwrites existing projects)
      if (alteration.fields.new_project_ids !== undefined) {
        // Handle both array and single value
        const projectIds = Array.isArray(alteration.fields.new_project_ids)
          ? alteration.fields.new_project_ids
          : alteration.fields.new_project_ids
            ? [alteration.fields.new_project_ids]
            : [];
        punchUpdates.project_ids = projectIds;
      }

      if (Object.keys(punchUpdates).length > 0) {
        await updateFilloutRecord(PUNCHES_TABLE_ID, punchId, punchUpdates);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error approving alteration:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

