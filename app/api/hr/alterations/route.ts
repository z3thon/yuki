import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';
import { getUserPermissions } from '@/lib/permission-tables';

import { PUNCH_ALTERATIONS_TABLE_ID, PUNCHES_TABLE_ID, EMPLOYEES_TABLE_ID } from '@/lib/fillout-table-ids';
import { EMPLOYEES_NAME_FIELD_ID } from '@/lib/fillout-config.generated';

/**
 * GET /api/hr/alterations
 * List punch alterations with permission filtering
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

    // Check view-level permission
    const canReadAlterations = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'punch-alterations',
      resourceType: 'alteration',
      action: 'read',
    });

    if (!canReadAlterations) {
      return NextResponse.json(
        { error: 'Access denied to punch alterations view' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const employeeId = searchParams.get('employee_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build filters
    // For select fields, use 'in' operator with array (even for single value)
    const filters: Record<string, any> = {
      status: { in: [status] },
    };

    // Note: Nested filtering (punch_id.employee_id) may not be supported by Fillout API
    // We'll filter by employee_id after fetching if needed
    // For now, we'll fetch all alterations and filter client-side if employeeId is provided

    // Query Fillout
    // Note: For select fields, use 'in' operator with array
    // Offset should be a string (as per FilloutQueryOptions interface)
    const queryOptions: any = {
      tableId: PUNCH_ALTERATIONS_TABLE_ID,
      limit,
      filters,
    };

    // Only add offset if it's greater than 0 (Fillout may not like "0" as string)
    if (offset > 0) {
      queryOptions.offset = offset.toString();
    }

    const response = await queryFillout(queryOptions);

    // Helper function to calculate duration in minutes
    const calculateDuration = (punchInTime: string | null, punchOutTime: string | null): number | null => {
      if (!punchInTime || !punchOutTime) return null;
      const inTime = new Date(punchInTime).getTime();
      const outTime = new Date(punchOutTime).getTime();
      if (isNaN(inTime) || isNaN(outTime)) return null;
      return Math.round((outTime - inTime) / (1000 * 60)); // Convert to minutes
    };

    // Helper function to get employee name
    const getEmployeeName = async (employeeId: string | null | undefined): Promise<string | null> => {
      if (!employeeId) return null;
      try {
        const employee = await getFilloutRecord(EMPLOYEES_TABLE_ID, employeeId);
        if (!employee) return null;
        
        const getNameValue = (val: any) => val && val.toString().trim() ? val.toString().trim() : null;
        return getNameValue(employee.fields[EMPLOYEES_NAME_FIELD_ID])
          || getNameValue(employee.fields.Name)
          || getNameValue(employee.fields.name)
          || getNameValue(employee.fields['Name'])
          || getNameValue(employee.fields['name'])
          || getNameValue(employee.fields.email)
          || null;
      } catch (err) {
        console.error('Error fetching employee name:', err);
        return null;
      }
    };

    // Format alterations
    let alterations = await Promise.all(
      response.records.map(async (record: any) => {
        // Get punch details if punch_id exists
        let punchDetails = null;
        let employeeName = null;
        let previousDuration = null;
        let newDuration = null;
        
        const punchId = Array.isArray(record.fields.punch_id)
          ? record.fields.punch_id[0]
          : record.fields.punch_id;

        if (punchId) {
          try {
            const punch = await getFilloutRecord(PUNCHES_TABLE_ID, punchId);
            if (punch) {
              const employeeId = Array.isArray(punch.fields.employee_id)
                ? punch.fields.employee_id[0]
                : punch.fields.employee_id;
              
              punchDetails = {
                id: punch.id,
                employeeId,
                punchInTime: punch.fields.punch_in_time,
                punchOutTime: punch.fields.punch_out_time,
              };

              // Get employee name
              employeeName = await getEmployeeName(employeeId);

              // Calculate previous duration
              previousDuration = calculateDuration(
                punch.fields.punch_in_time,
                punch.fields.punch_out_time
              );
            }
          } catch (err) {
            console.error('Error fetching punch details:', err);
          }
        }

        // Calculate new duration if new times are provided
        const newPunchInTime = record.fields.new_punch_in_time || null;
        const newPunchOutTime = record.fields.new_punch_out_time || null;
        if (newPunchInTime && newPunchOutTime) {
          newDuration = calculateDuration(newPunchInTime, newPunchOutTime);
        }

        return {
          id: record.id,
          punchId,
          punchDetails,
          employeeName,
          requestedAt: record.fields.requested_at,
          newPunchInTime: newPunchInTime,
          newPunchOutTime: newPunchOutTime,
          newMemo: record.fields.new_memo || null,
          reason: record.fields.reason || null,
          status: record.fields.status,
          reviewedAt: record.fields.reviewed_at || null,
          reviewNotes: record.fields.review_notes || null,
          createdAt: record.fields.created_at || record.createdTime,
          updatedAt: record.fields.updated_at || record.createdTime,
          previousDuration, // Duration in minutes
          newDuration, // Duration in minutes
        };
      })
    );

    // Filter by employee_id if provided (client-side filtering since nested filters may not work)
    if (employeeId) {
      alterations = alterations.filter(alt => 
        alt.punchDetails?.employeeId === employeeId
      );
    }

    return NextResponse.json({
      alterations,
      total: alterations.length,
      hasMore: response.hasMore || false,
      offset: response.offset,
    });
  } catch (error: any) {
    console.error('Error fetching alterations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

