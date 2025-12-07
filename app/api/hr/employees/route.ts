import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';
import { getUserPermissions } from '@/lib/permission-tables';
import { EMPLOYEES_TABLE_ID, PAY_RATE_HISTORY_TABLE_ID } from '@/lib/fillout-table-ids';
import { EMPLOYEES_NAME_FIELD_ID } from '@/lib/fillout-config.generated';

/**
 * GET /api/hr/employees
 * List employees with permission filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[${requestId}] 🔍 Starting employees API request`);
    
    // SECURITY: Verify auth
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check app access
    const hasAccess = await hasAppAccess(user.uid, 'hr');
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to HR app' },
        { status: 403 }
      );
    }

    // Get user permissions ONCE and reuse (checkPermission also needs it)
    // This avoids multiple calls to getUserPermissions
    const permissions = await getUserPermissions(user.uid);
    const hrPermissions = permissions.filter(p => p.appId === 'hr');
    console.log(`[${requestId}] ⏱️ getUserPermissions took ${Date.now() - startTime}ms`);

    // Check view-level permission (reuse permissions we already fetched)
    // Note: checkPermission will fetch permissions again internally, but that's cached
    const canReadEmployees = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'employees',
      resourceType: 'employee',
      action: 'read',
    });

    if (!canReadEmployees) {
      // Log for debugging - use permissions we already fetched
      console.error(`[${requestId}] Permission denied for user ${user.uid} (${user.email})`);
      console.error(`[${requestId}] Total permissions: ${permissions.length}, HR permissions: ${hrPermissions.length}`);
      if (process.env.NODE_ENV === 'development') {
        console.error(`[${requestId}] HR permissions:`, JSON.stringify(hrPermissions, null, 2));
      }
      
      return NextResponse.json(
        { error: 'Access denied to employees view' },
        { status: 403 }
      );
    }

    // Note: Removed unused getEmployeeIdForUser call - it was making an extra API call but result was never used
    
    // Build filters based on permissions
    const filters: Record<string, any> = {};
    
    // If user has specific employee_id restrictions, filter by those
    // Check if user has limited access (specific employee_ids in permissions)
    const hasLimitedAccess = hrPermissions.some(p => 
      p.viewId === 'employees' && 
      p.resourceType === 'employee' && 
      p.resourceId // If resourceId exists, user has limited access
    );

    if (hasLimitedAccess) {
      // User can only see specific employees
      const allowedEmployeeIds = hrPermissions
        .filter(p => p.viewId === 'employees' && p.resourceType === 'employee' && p.resourceId)
        .map(p => p.resourceId)
        .filter(Boolean) as string[];
      
      if (allowedEmployeeIds.length > 0) {
        filters.id = { in: allowedEmployeeIds };
      } else {
        // No allowed employees, return empty
        return NextResponse.json({ employees: [] });
      }
    }
    // If no limited access, user can see all employees (no filter)

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const companyId = searchParams.get('company_id');
    const departmentId = searchParams.get('department_id');
    const employeeIdsParam = searchParams.get('employee_ids'); // Comma-separated list of IDs
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Add employee IDs filter (for fetching specific employees)
    if (employeeIdsParam) {
      const ids = employeeIdsParam.split(',').filter(Boolean);
      if (ids.length > 0) {
        // If user has limited access, intersect with allowed IDs
        if (hasLimitedAccess) {
          const allowedEmployeeIds = hrPermissions
            .filter(p => p.viewId === 'employees' && p.resourceType === 'employee' && p.resourceId)
            .map(p => p.resourceId)
            .filter(Boolean) as string[];
          const filteredIds = ids.filter(id => allowedEmployeeIds.includes(id));
          if (filteredIds.length > 0) {
            filters.id = { in: filteredIds };
          } else {
            return NextResponse.json({ employees: [] });
          }
        } else {
          filters.id = { in: ids };
        }
      }
    }

    // Add search filter
    if (search) {
      filters.name = { contains: search };
    }

    // Add company filter
    if (companyId) {
      filters.company_id = { in: [companyId] };
    }

    // Add department filter
    if (departmentId) {
      filters.department_id = { in: [departmentId] };
    }

    // Query Fillout
    const response = await queryFillout({
      tableId: EMPLOYEES_TABLE_ID,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit,
      offset: offset > 0 ? offset.toString() : undefined,
    });

    // Get employee IDs to fetch pay rates
    const employeeIds = response.records.map((r: any) => r.id);

    // Fetch active pay rates from Employee Pay Rates table
    const payRateMap = new Map<string, number | null>();
    if (PAY_RATE_HISTORY_TABLE_ID && PAY_RATE_HISTORY_TABLE_ID.trim() !== '' && employeeIds.length > 0) {
      try {
        const payRateStartTime = Date.now();
        // Query all pay rate records for these employees
        const payRateResponse = await queryFillout({
          tableId: PAY_RATE_HISTORY_TABLE_ID,
          filters: {
            employee_id: { in: employeeIds },
          },
          limit: 1000, // Get all pay rate records for these employees
        });
        console.log(`[${requestId}] ⏱️ Pay rate fetch took ${Date.now() - payRateStartTime}ms`);

        // Build map of employee_id -> active pay_rate (end_date is null)
        // Group by employee_id first, then find the most recent active one
        const employeePayRates = new Map<string, { payRate: number; startDate: string }>();
        
        payRateResponse.records?.forEach((record: any) => {
          const empId = Array.isArray(record.fields.employee_id)
            ? record.fields.employee_id[0]
            : record.fields.employee_id;
          
          // Only use active pay rates (end_date is null)
          if (empId && !record.fields.end_date) {
            const payRate = record.fields.pay_rate;
            const startDate = record.fields.start_date || '';
            
            if (payRate !== null && payRate !== undefined) {
              // If we already have a pay rate for this employee, use the one with the latest start_date
              const existing = employeePayRates.get(empId);
              if (!existing || (startDate && startDate > existing.startDate)) {
                employeePayRates.set(empId, { payRate, startDate });
              } else if (!existing) {
                employeePayRates.set(empId, { payRate, startDate });
              }
            }
          }
        });

        // Convert to simple map for lookup
        employeePayRates.forEach((value, empId) => {
          payRateMap.set(empId, value.payRate);
        });
      } catch (error: any) {
        // If pay rate table doesn't exist or query fails, fall back to Employees table
        console.warn('Error fetching pay rates from Employee Pay Rates table:', error.message);
      }
    }

    // Format employees
    const employees = response.records.map((record: any) => {
      const employeeId = record.id;
      
      // Debug logging only in development and only for first record
      if (process.env.NODE_ENV === 'development' && response.records.indexOf(record) === 0) {
        console.log(`[${requestId}] Employee record fields:`, Object.keys(record.fields));
        console.log(`[${requestId}] Looking for Name field with ID:`, EMPLOYEES_NAME_FIELD_ID);
      }
      
      // Get pay rate from Employee Pay Rates table if available, otherwise fall back to Employees table
      const payRate = payRateMap.has(employeeId) 
        ? payRateMap.get(employeeId) 
        : (record.fields.pay_rate || null);

      // Try field ID first (Fillout might return fields by ID), then try field names
      // Check for truthy values (not null, undefined, or empty string)
      // Don't fall back to email here - let UI handle that
      const getNameValue = (val: any) => val && val.toString().trim() ? val.toString().trim() : null;
      
      const name = getNameValue(record.fields[EMPLOYEES_NAME_FIELD_ID]) // Try field ID first
        || getNameValue(record.fields.Name)
        || getNameValue(record.fields.name)
        || getNameValue(record.fields['Name'])
        || getNameValue(record.fields['name'])
        || null; // Return null instead of falling back to email

      return {
        id: employeeId,
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
    });

    console.log(`[${requestId}] ✅ Employees API completed in ${Date.now() - startTime}ms`);
    
    return NextResponse.json({
      employees,
      total: response.records.length,
      hasMore: response.hasMore || false,
      offset: response.offset,
    });
  } catch (error: any) {
    console.error(`[${requestId}] ❌ Error fetching employees:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

