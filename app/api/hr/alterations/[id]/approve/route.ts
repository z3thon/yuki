import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';

import { PUNCH_ALTERATIONS_TABLE_ID, PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';
import { 
  PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID,
  PUNCH_ALTERATION_REQUESTS_REVIEWED_AT_FIELD_ID,
  PUNCH_ALTERATION_REQUESTS_REVIEW_NOTES_FIELD_ID,
  PUNCH_ALTERATION_REQUESTS_NEW_TIMEZONE_ACTUAL_ID_FIELD_ID,
  PUNCH_ALTERATION_REQUESTS_NEW_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID,
  PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID,
  PUNCHES_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID
} from '@/lib/fillout-config.generated';

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

    // Check status - try both field name and field ID
    const currentStatus = alteration.fields.status 
      || alteration.fields[PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID];
    
    if (currentStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Alteration is not pending' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reviewNotes = body.reviewNotes || '';

    // Update alteration status using field IDs (required after field recreation)
    await updateFilloutRecord(PUNCH_ALTERATIONS_TABLE_ID, id, {
      [PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID]: 'approved',
      [PUNCH_ALTERATION_REQUESTS_REVIEWED_AT_FIELD_ID]: new Date().toISOString(),
      [PUNCH_ALTERATION_REQUESTS_REVIEW_NOTES_FIELD_ID]: reviewNotes,
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
      
      // Copy new punch out time if provided (only if non-empty - empty means they only updated punch in time)
      if (alteration.fields.new_punch_out_time !== undefined && 
          alteration.fields.new_punch_out_time !== null && 
          alteration.fields.new_punch_out_time !== '') {
        punchUpdates.punch_out_time = alteration.fields.new_punch_out_time;
      }
      
      // Copy new memo if provided (only if non-empty - blank means no change)
      if (alteration.fields.new_memo !== undefined && alteration.fields.new_memo !== null && alteration.fields.new_memo !== '') {
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

      // Copy new timezone IDs if provided
      // new_timezone_actual_id goes to timezone_actual_id (punch in timezone)
      // These are relationship arrays - copy the array directly from alteration to punch
      // Try both field name and field ID (Fillout may return either)
      const rawInTimezoneField = alteration.fields.new_timezone_actual_id 
        || alteration.fields[PUNCH_ALTERATION_REQUESTS_NEW_TIMEZONE_ACTUAL_ID_FIELD_ID];
      const rawOutTimezoneField = alteration.fields.new_punch_out_timezone_actual_id 
        || alteration.fields[PUNCH_ALTERATION_REQUESTS_NEW_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID];
      
      if (rawInTimezoneField !== undefined) {
        // Copy the array directly - if it's already an array, use it; if single value, wrap in array
        // Use field ID for punch update (required for linked_record fields)
        if (Array.isArray(rawInTimezoneField)) {
          punchUpdates[PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID] = rawInTimezoneField;
        } else if (rawInTimezoneField) {
          punchUpdates[PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID] = [rawInTimezoneField];
        } else {
          // null/undefined - set as empty array to clear
          punchUpdates[PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID] = [];
        }
        console.log(`[Approve] Copying punch in timezone:`, {
          from: rawInTimezoneField,
          to: punchUpdates[PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID],
          fieldId: PUNCHES_TIMEZONE_ACTUAL_ID_FIELD_ID
        });
      }

      // new_punch_out_timezone_actual_id goes to punch_out_timezone_actual_id (punch out timezone)
      // Only copy if punch out time is also being updated (empty means they only updated punch in time)
      if (rawOutTimezoneField !== undefined && 
          alteration.fields.new_punch_out_time !== undefined && 
          alteration.fields.new_punch_out_time !== null && 
          alteration.fields.new_punch_out_time !== '') {
        // Copy the array directly - if it's already an array, use it; if single value, wrap in array
        // Use field ID for punch update (required for linked_record fields)
        if (Array.isArray(rawOutTimezoneField)) {
          punchUpdates[PUNCHES_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID] = rawOutTimezoneField;
        } else if (rawOutTimezoneField) {
          punchUpdates[PUNCHES_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID] = [rawOutTimezoneField];
        } else {
          // null/undefined - set as empty array to clear
          punchUpdates[PUNCHES_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID] = [];
        }
        console.log(`[Approve] Copying punch out timezone:`, {
          from: rawOutTimezoneField,
          to: punchUpdates[PUNCHES_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID],
          fieldId: PUNCHES_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID
        });
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

