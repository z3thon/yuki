import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';

import { PUNCH_ALTERATIONS_TABLE_ID, PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * POST /api/hr/alterations/bulk-approve
 * Approve multiple punch alterations at once (requires approve permission)
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { alterationIds, reviewNotes } = body;

    if (!Array.isArray(alterationIds) || alterationIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request - alterationIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const results = {
      approved: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    };

    // Process each alteration
    for (const id of alterationIds) {
      try {
        // Get alteration
        const alteration = await getFilloutRecord(PUNCH_ALTERATIONS_TABLE_ID, id);
        
        if (!alteration) {
          results.failed.push({ id, error: 'Alteration not found' });
          continue;
        }

        if (alteration.fields.status !== 'pending') {
          results.failed.push({ id, error: 'Alteration is not pending' });
          continue;
        }

        // Update alteration status
        await updateFilloutRecord(PUNCH_ALTERATIONS_TABLE_ID, id, {
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || '',
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

        results.approved.push(id);
      } catch (error: any) {
        console.error(`Error approving alteration ${id}:`, error);
        results.failed.push({ id, error: error.message || 'Unknown error' });
      }
    }

    return NextResponse.json({
      success: true,
      approved: results.approved.length,
      failed: results.failed.length,
      results,
    });
  } catch (error: any) {
    console.error('Error bulk approving alterations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
