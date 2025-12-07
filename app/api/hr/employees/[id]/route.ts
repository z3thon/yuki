import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { getFilloutRecord, updateFilloutRecord, queryFillout, createFilloutRecord } from '@/lib/fillout';
import { 
  EMPLOYEES_TABLE_ID, 
  PAY_RATE_HISTORY_TABLE_ID,
  PAY_RATE_HISTORY_EMPLOYEE_ID_FIELD_ID,
  PAY_RATE_HISTORY_PAY_RATE_FIELD_ID,
  PAY_RATE_HISTORY_START_DATE_FIELD_ID,
  PAY_RATE_HISTORY_END_DATE_FIELD_ID,
  PAY_RATE_HISTORY_CURRENCY_FIELD_ID,
} from '@/lib/fillout-table-ids';
import { EMPLOYEES_NAME_FIELD_ID } from '@/lib/fillout-config.generated';

/**
 * GET /api/hr/employees/[id]
 * Get employee details
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

    // Check permission to read this specific employee
    const canRead = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'employees',
      resourceType: 'employee',
      resourceId: id,
      action: 'read',
    });

    // Also check general read permission
    const canReadGeneral = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'employees',
      resourceType: 'employee',
      action: 'read',
    });

    if (!canRead && !canReadGeneral) {
      return NextResponse.json(
        { error: 'Access denied to this employee' },
        { status: 403 }
      );
    }

    const record = await getFilloutRecord(EMPLOYEES_TABLE_ID, id);
    
    if (!record) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Get active pay rate from Employee Pay Rates table
    let payRate: number | null = null;
    if (PAY_RATE_HISTORY_TABLE_ID && PAY_RATE_HISTORY_TABLE_ID.trim() !== '') {
      try {
        const payRateResponse = await queryFillout({
          tableId: PAY_RATE_HISTORY_TABLE_ID,
          filters: {
            employee_id: { in: [id] },
          },
          limit: 100,
        });

        // Find the active pay rate (end_date is null)
        // If multiple exist, use the one with the latest start_date
        const activePayRates = payRateResponse.records?.filter(
          (r: any) => !r.fields.end_date
        ) || [];

        if (activePayRates.length > 0) {
          // Sort by start_date descending and take the most recent
          activePayRates.sort((a: any, b: any) => {
            const dateA = a.fields.start_date || '';
            const dateB = b.fields.start_date || '';
            return dateB.localeCompare(dateA);
          });
          
          payRate = activePayRates[0].fields.pay_rate || null;
        }
      } catch (error: any) {
        // If pay rate table doesn't exist or query fails, fall back to Employees table
        console.warn('Error fetching pay rate from Employee Pay Rates table:', error.message);
        payRate = record.fields.pay_rate || null;
      }
    } else {
      // Fall back to Employees table if pay rate history table not configured
      payRate = record.fields.pay_rate || null;
    }

    // Debug: Log available fields to diagnose name field issue
    console.log('Employee detail record fields:', Object.keys(record.fields));
    console.log('Sample employee detail record:', JSON.stringify(record.fields, null, 2));
    console.log('Looking for Name field with ID:', EMPLOYEES_NAME_FIELD_ID);
    console.log('Field ID value:', record.fields[EMPLOYEES_NAME_FIELD_ID]);
    
    // Try field ID first (Fillout GET might return fields by ID), then try field names
    // Check for truthy values (not null, undefined, or empty string)
    const getNameValue = (val: any) => val && val.toString().trim() ? val.toString().trim() : null;
    
    const name = getNameValue(record.fields[EMPLOYEES_NAME_FIELD_ID]) // Try field ID first
      || getNameValue(record.fields.Name)
      || getNameValue(record.fields.name)
      || getNameValue(record.fields['Name'])
      || getNameValue(record.fields['name'])
      || getNameValue(record.fields.email)
      || 'Unknown';

    const employee = {
      id: record.id,
      name,
      email: record.fields.email || '',
      companyId: Array.isArray(record.fields.company_id) 
        ? record.fields.company_id[0] 
        : record.fields.company_id,
      departmentId: Array.isArray(record.fields.department_id) 
        ? record.fields.department_id[0] 
        : record.fields.department_id,
      photoUrl: record.fields.photo_url || null,
      payRate,
      employmentType: record.fields.employment_type || null,
      timezoneId: Array.isArray(record.fields.timezone_id) 
        ? record.fields.timezone_id[0] 
        : record.fields.timezone_id,
      createdAt: record.fields.created_at || record.createdTime,
      updatedAt: record.fields.updated_at || record.createdTime,
    };

    return NextResponse.json({ employee });
  } catch (error: any) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr/employees/[id]
 * Update employee (requires write permission)
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
    const canWrite = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'employees',
      resourceType: 'employee',
      resourceId: id,
      action: 'write',
    });

    const canWriteGeneral = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'employees',
      resourceType: 'employee',
      action: 'write',
    });

    if (!canWrite && !canWriteGeneral) {
      return NextResponse.json(
        { error: 'Write permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const fields: Record<string, any> = {};
    const payRateChanged = body.payRate !== undefined;
    const newPayRate = body.payRate;
    const payRateStartDate = body.payRateStartDate || new Date().toISOString().split('T')[0]; // Default to today
    const currency = body.currency || 'USD'; // Default to USD

    // Handle pay rate history if pay rate is being updated and table exists
    if (payRateChanged && PAY_RATE_HISTORY_TABLE_ID && PAY_RATE_HISTORY_TABLE_ID.trim() !== '') {
      try {
        // Find the previous active pay rate history record (end_date is null)
        // Query all records for this employee and filter for null end_date in code
        const existingHistory = await queryFillout({
          tableId: PAY_RATE_HISTORY_TABLE_ID,
          filters: {
            employee_id: { in: [id] },
          },
          limit: 100,
        });

        // Find the active record (end_date is null or empty)
        const activeRecord = existingHistory.records?.find(
          (record: any) => !record.fields?.end_date
        );

        // If there's an existing active record, close it by setting end_date to the new start date
        if (activeRecord) {
          await updateFilloutRecord(PAY_RATE_HISTORY_TABLE_ID, activeRecord.id, {
            [PAY_RATE_HISTORY_END_DATE_FIELD_ID]: payRateStartDate,
          });
        }

        // Always create new pay rate history record with the new start date and rate
        // Use field IDs for linked_record fields (Fillout API requirement)
        await createFilloutRecord(PAY_RATE_HISTORY_TABLE_ID, {
          [PAY_RATE_HISTORY_EMPLOYEE_ID_FIELD_ID]: [id], // linked_record field - must use field ID and array format
          [PAY_RATE_HISTORY_PAY_RATE_FIELD_ID]: newPayRate,
          [PAY_RATE_HISTORY_START_DATE_FIELD_ID]: payRateStartDate,
          [PAY_RATE_HISTORY_END_DATE_FIELD_ID]: null, // Active until next change
          [PAY_RATE_HISTORY_CURRENCY_FIELD_ID]: currency, // Currency (default: USD)
        });
      } catch (error: any) {
        // Log error but don't fail the update if history table doesn't exist yet
        console.error('Error updating pay rate history:', error);
      }
    }

    // Map fields
    if (body.name !== undefined) fields.Name = body.name;
    if (body.email !== undefined) fields.email = body.email;
    if (payRateChanged) fields.pay_rate = newPayRate;
    if (body.employmentType !== undefined) fields.employment_type = body.employmentType;
    if (body.companyId !== undefined) fields.company_id = body.companyId ? [body.companyId] : null;
    if (body.departmentId !== undefined) fields.department_id = body.departmentId ? [body.departmentId] : null;
    if (body.timezoneId !== undefined) fields.timezone_id = body.timezoneId ? [body.timezoneId] : null;
    if (body.photoUrl !== undefined) fields.photo_url = body.photoUrl;

    await updateFilloutRecord(EMPLOYEES_TABLE_ID, id, fields);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

