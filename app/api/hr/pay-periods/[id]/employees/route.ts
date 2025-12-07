import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord } from '@/lib/fillout';
import { PAY_PERIODS_TABLE_ID, TIME_CARDS_TABLE_ID, EMPLOYEES_TABLE_ID, PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/pay-periods/[id]/employees
 * Get employee hours for a specific pay period
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
    const canReadPayPeriods = await checkPermission({
      userId: user.uid,
      appId: 'hr',
      viewId: 'pay-periods',
      resourceType: 'pay-period',
      action: 'read',
    });

    if (!canReadPayPeriods) {
      return NextResponse.json(
        { error: 'Access denied to pay periods view' },
        { status: 403 }
      );
    }

    // Get pay period
    const payPeriod = await getFilloutRecord(PAY_PERIODS_TABLE_ID, id);
    if (!payPeriod) {
      return NextResponse.json(
        { error: 'Pay period not found' },
        { status: 404 }
      );
    }

    // Get pay period dates for filtering punches
    const payPeriodStart = payPeriod.fields.start_date;
    const payPeriodEnd = payPeriod.fields.end_date;
    
    // Get department ID from pay period
    const departmentId = Array.isArray(payPeriod.fields.department_id)
      ? payPeriod.fields.department_id[0]
      : payPeriod.fields.department_id;
    
    console.log(`📅 Pay period dates: ${payPeriodStart} to ${payPeriodEnd}`);
    console.log(`🏢 Department ID: ${departmentId || 'None'}`);

    // Get time cards for this pay period
    const timeCardsResponse = await queryFillout({
      tableId: TIME_CARDS_TABLE_ID,
      filters: { pay_period_id: { in: [id] } },
      limit: 1000,
    });

    // Get all punches within the pay period date range
    // Fillout API max limit is 2000, so we may need to paginate
    // Fillout API filtering by linked_record fields is unreliable, so we filter by date range
    const timeCardIds = new Set(timeCardsResponse.records.map((tc: any) => tc.id));
    
    // Fetch punches with pagination (Fillout max is 2000 per request)
    let allPunches: any[] = [];
    let offset = 0;
    const limit = 2000;
    let hasMore = true;
    
    while (hasMore) {
      const punchesResponse = await queryFillout({
        tableId: PUNCHES_TABLE_ID,
        filters: {
          punch_in_time: {
            gte: payPeriodStart,
            lte: payPeriodEnd,
          },
        },
        limit,
        offset: offset > 0 ? offset.toString() : undefined,
      });
      
      const punches = punchesResponse?.records || [];
      allPunches = allPunches.concat(punches);
      
      hasMore = punchesResponse?.hasMore || false;
      offset += limit;
      
      // Safety check: don't fetch more than 10000 total (5 pages)
      if (allPunches.length >= 10000) {
        console.warn(`⚠️ Reached 10000 punches limit, stopping pagination`);
        break;
      }
    }
    
    console.log(`📦 Fetched ${allPunches.length} punches for pay period`);

    // Helper function to calculate hours from punch in/out times
    // Important: Dates from Fillout are in UTC, we need to parse them correctly
    const calculateHours = (punchInTime: string, punchOutTime: string | null): number => {
      if (!punchInTime) return 0;
      if (!punchOutTime) return 0; // No punch out = 0 hours
      
      try {
        // Parse ISO date strings (Fillout returns UTC timestamps)
        // Example: "2025-11-17T15:24:44.241Z"
        const inTime = new Date(punchInTime);
        const outTime = new Date(punchOutTime);
        
        if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) {
          console.warn(`⚠️ Invalid date: in=${punchInTime}, out=${punchOutTime}`);
          return 0;
        }
        
        // Calculate difference in milliseconds, then convert to hours
        const diffMs = outTime.getTime() - inTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours
        
        // Ensure non-negative and reasonable (max 24 hours per punch)
        const hours = Math.max(0, Math.min(24, diffHours));
        
        return hours;
      } catch (error) {
        console.error('Error calculating hours:', error, { punchInTime, punchOutTime });
        return 0;
      }
    };

    // Group punches by employee and calculate totals
    // If time cards exist but no punches are linked, use all punches in date range
    const employeePunches: Record<string, any[]> = {};
    const employeeIds = new Set<string>();
    
    // Try to filter by time_card_id first
    let filteredPunches = allPunches;
    if (timeCardIds.size > 0) {
      const linkedPunches = allPunches.filter((punch: any) => {
        const punchTimeCardId = Array.isArray(punch.fields.time_card_id)
          ? punch.fields.time_card_id[0]
          : punch.fields.time_card_id;
        return punchTimeCardId && timeCardIds.has(punchTimeCardId);
      });
      
      // If we found linked punches, use them; otherwise use all punches in date range
      if (linkedPunches.length > 0) {
        filteredPunches = linkedPunches;
        console.log(`✅ Using ${linkedPunches.length} punches linked to time cards`);
      } else {
        console.log(`⚠️ No punches linked to time cards, using all ${allPunches.length} punches in date range`);
        filteredPunches = allPunches;
      }
    }
    
    filteredPunches.forEach((punch: any) => {
      const empId = Array.isArray(punch.fields.employee_id)
        ? punch.fields.employee_id[0]
        : punch.fields.employee_id;
      
      if (empId) {
        employeeIds.add(empId);
        if (!employeePunches[empId]) {
          employeePunches[empId] = [];
        }
        employeePunches[empId].push(punch);
      }
    });

    // Get ALL employees in the department (for payroll, we need to show everyone)
    // First get employees with punches, then get all employees in department
    const employees: Record<string, any> = {};
    
    // Fetch employees with punches first
    if (employeeIds.size > 0) {
      const employeesWithPunchesResponse = await queryFillout({
        tableId: EMPLOYEES_TABLE_ID,
        filters: { id: { in: Array.from(employeeIds) } },
        limit: 1000,
      });

      employeesWithPunchesResponse.records.forEach((emp: any) => {
        employees[emp.id] = {
          id: emp.id,
          name: emp.fields.Name || emp.fields.name || emp.fields.email || 'Unknown',
          email: emp.fields.email || null,
        };
      });
    }
    
    // Now fetch ALL employees in the department (for payroll completeness)
    if (departmentId) {
      const allDepartmentEmployeesResponse = await queryFillout({
        tableId: EMPLOYEES_TABLE_ID,
        filters: { department_id: { in: [departmentId] } },
        limit: 1000,
      });
      
      allDepartmentEmployeesResponse.records.forEach((emp: any) => {
        // Only add if not already added (don't overwrite)
        if (!employees[emp.id]) {
          employees[emp.id] = {
            id: emp.id,
            name: emp.fields.Name || emp.fields.name || emp.fields.email || 'Unknown',
            email: emp.fields.email || null,
          };
        }
      });
      
      console.log(`👥 Found ${allDepartmentEmployeesResponse.records.length} total employees in department`);
    } else {
      console.log(`⚠️ No department ID found, only showing employees with punches`);
    }

    // Calculate hours for ALL employees (including those with 0 hours)
    // Use all employee IDs from the employees map, not just those with punches
    const allEmployeeIds = Object.keys(employees);
    
    const employeeHours = allEmployeeIds.map((empId) => {
      const punches = employeePunches[empId] || [];
      
      // Calculate total hours from all punches
      const totalHours = punches.reduce((sum: number, punch: any) => {
        const punchInTime = punch.fields.punch_in_time;
        const punchOutTime = punch.fields.punch_out_time || null;
        
        // Try duration field first, then calculate from in/out times
        if (punch.fields.duration && typeof punch.fields.duration === 'number') {
          return sum + punch.fields.duration;
        }
        
        return sum + calculateHours(punchInTime, punchOutTime);
      }, 0);

      // Get time cards for this employee
      const employeeTimeCards = timeCardsResponse.records.filter((tc: any) => {
        const tcEmpId = Array.isArray(tc.fields.employee_id)
          ? tc.fields.employee_id[0]
          : tc.fields.employee_id;
        return tcEmpId === empId;
      });

      return {
        employeeId: empId,
        employeeName: employees[empId]?.name || 'Unknown',
        employeeEmail: employees[empId]?.email || null,
        totalHours,
        timeCardCount: employeeTimeCards.length,
        timeCards: employeeTimeCards.map((tc: any) => ({
          id: tc.id,
          clientId: Array.isArray(tc.fields.client_id)
            ? tc.fields.client_id[0]
            : tc.fields.client_id,
          totalHours: tc.fields.total_hours || 0,
        })),
      };
    });

    // Sort by employee name
    employeeHours.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    return NextResponse.json({
      payPeriod: {
        id: payPeriod.id,
        name: payPeriod.fields.name || `Pay Period ${payPeriod.id}`,
        startDate: payPeriod.fields.start_date,
        endDate: payPeriod.fields.end_date,
        payoutDate: payPeriod.fields.payout_date || null,
      },
      employeeHours,
      totalEmployees: employeeHours.length,
      totalHours: employeeHours.reduce((sum, eh) => sum + eh.totalHours, 0),
    });
  } catch (error: any) {
    console.error('Error fetching pay period employee hours:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
