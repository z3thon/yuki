import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';

import { PUNCH_ALTERATIONS_TABLE_ID } from '@/lib/fillout-table-ids';
import { 
  PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID,
  PUNCH_ALTERATION_REQUESTS_REVIEWED_AT_FIELD_ID,
  PUNCH_ALTERATION_REQUESTS_REVIEW_NOTES_FIELD_ID
} from '@/lib/fillout-config.generated';

/**
 * POST /api/hr/alterations/[id]/decline
 * Decline a punch alteration (requires approve permission)
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

    // Check approve permission (same as approve - you need approve permission to decline)
    const canApprove = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'punch-alterations',
      resourceType: 'alteration',
      action: 'approve',
    });

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Permission denied - you cannot decline alterations' },
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
      [PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID]: 'rejected',
      [PUNCH_ALTERATION_REQUESTS_REVIEWED_AT_FIELD_ID]: new Date().toISOString(),
      [PUNCH_ALTERATION_REQUESTS_REVIEW_NOTES_FIELD_ID]: reviewNotes,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error declining alteration:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

