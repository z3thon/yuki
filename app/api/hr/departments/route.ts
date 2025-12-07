import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout } from '@/lib/fillout';
import { DEPARTMENTS_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/departments
 * Get all departments with their pay period settings
 */
export async function GET(request: NextRequest) {
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

    // Get departments
    const departmentsResponse = await queryFillout({
      tableId: DEPARTMENTS_TABLE_ID,
      limit: 1000,
    });

    const departments = departmentsResponse.records.map((record: any) => ({
      id: record.id,
      name: record.fields.Name || record.fields.name || `Department ${record.id}`,
      companyId: Array.isArray(record.fields.company_id)
        ? record.fields.company_id[0]
        : record.fields.company_id,
      payPeriodType: record.fields.pay_period_type || null,
      payPeriodStartDays: record.fields.pay_period_start_days || null,
      payPeriodEndDays: record.fields.pay_period_end_days || null,
      payoutDays: record.fields.payout_days || null,
      payPeriodMemo: record.fields.pay_period_memo || null,
      allowMemoChangesWithoutApproval: record.fields.allow_memo_changes_without_approval || false,
      createdAt: record.fields.created_at || record.createdTime,
      updatedAt: record.fields.updated_at || record.createdTime,
    }));

    return NextResponse.json({ departments });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

