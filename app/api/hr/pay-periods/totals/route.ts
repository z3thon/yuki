import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord } from '@/lib/fillout';
import { PAY_PERIODS_TABLE_ID, TIME_CARDS_TABLE_ID, PUNCHES_TABLE_ID, EMPLOYEES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * POST /api/hr/pay-periods/totals
 * Get totals (hours and time card counts) for multiple pay periods
 * Body: { payPeriodIds: string[] }
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

    const body = await request.json();
    const { payPeriodIds, includeEmployeeHours } = body;

    if (!Array.isArray(payPeriodIds) || payPeriodIds.length === 0) {
      return NextResponse.json({ error: 'payPeriodIds must be a non-empty array' }, { status: 400 });
    }

    console.log(`📊 Calculating totals for ${payPeriodIds.length} pay periods${includeEmployeeHours ? ' (with employee hours)' : ''}...`);

    // Fetch pay periods
    const payPeriodsResponse = await queryFillout({
      tableId: PAY_PERIODS_TABLE_ID,
      filters: {
        id: { in: payPeriodIds },
      },
      limit: 100,
    });

    const payPeriods = payPeriodsResponse.records || [];
    console.log(`✅ Fetched ${payPeriods.length} pay periods`);

    // Fetch all pay period records with full details (needed for employee hours)
    const payPeriodRecords = await Promise.all(
      payPeriodIds.map(id => getFilloutRecord(PAY_PERIODS_TABLE_ID, id))
    );

    // Helper function to calculate hours from punch in/out times
    const calculateHours = (punchInTime: string, punchOutTime: string | null): number => {
      if (!punchInTime || !punchOutTime) return 0;
      try {
        const inTime = new Date(punchInTime);
        const outTime = new Date(punchOutTime);
        if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) { return 0; }
        const diffMs = outTime.getTime() - inTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return Math.max(0, Math.min(24, diffHours));
      } catch (error) { return 0; }
    };

    // Calculate totals for each pay period in parallel
    const totalsPromises = payPeriodRecords.map(async (payPeriod: any) => {
      if (!payPeriod) {
        return null;
      }
      
      const payPeriodId = payPeriod.id;
      const startDate = payPeriod.fields.start_date || payPeriod.fields.startDate;
      const endDate = payPeriod.fields.end_date || payPeriod.fields.endDate;

      if (!startDate || !endDate) {
        console.warn(`⚠️ Pay period ${payPeriodId} missing dates`);
        return {
          id: payPeriodId,
          totalHours: 0,
          timeCardCount: 0,
        };
      }

      // Fetch time cards for this pay period
      const timeCardsResponse = await queryFillout({
        tableId: TIME_CARDS_TABLE_ID,
        filters: {
          pay_period_id: { in: [payPeriodId] },
        },
        limit: 2000,
      });

      const timeCards = timeCardsResponse?.records || [];
      const timeCardIds = new Set(timeCards.map((tc: any) => tc.id));
      const timeCardCount = timeCards.length;

      // Fetch punches within date range
      const startDateFilter = startDate.split('T')[0];
      const endDateFilter = endDate.split('T')[0];

      let allPunches: any[] = [];
      let offset = 0;
      const limit = 2000;
      let hasMore = true;

      while (hasMore && offset < 10000) {
        const punchesResponse = await queryFillout({
          tableId: PUNCHES_TABLE_ID,
          filters: {
            punch_in_time: {
              gte: startDateFilter,
              lte: endDateFilter,
            },
          },
          limit,
          offset: offset > 0 ? offset.toString() : undefined,
        });

        const punches = punchesResponse?.records || [];
        allPunches = allPunches.concat(punches);

        hasMore = punchesResponse?.hasMore || false;
        offset += limit;

        if (allPunches.length >= 10000) {
          console.warn(`⚠️ Reached 10000 punches limit for pay period ${payPeriodId}`);
          break;
        }
      }

      // Filter punches by time card ID if time cards exist
      let filteredPunches = allPunches;
      if (timeCardIds.size > 0) {
        const linkedPunches = allPunches.filter((punch: any) => {
          const punchTimeCardId = Array.isArray(punch.fields.time_card_id)
            ? punch.fields.time_card_id[0]
            : punch.fields.time_card_id;
          return punchTimeCardId && timeCardIds.has(punchTimeCardId);
        });

        if (linkedPunches.length > 0) {
          filteredPunches = linkedPunches;
        }
      }

      // Calculate total hours from punches
      let totalHours = 0;
      filteredPunches.forEach((punch: any) => {
        const punchInTime = punch.fields.punch_in_time;
        const punchOutTime = punch.fields.punch_out_time;

        // Try duration field first, then calculate from in/out times
        if (punch.fields.duration) {
          const duration = parseFloat(punch.fields.duration);
          if (!isNaN(duration) && duration > 0) {
            totalHours += duration;
            return;
          }
        }

        // Calculate from punch in/out times
        const hours = calculateHours(punchInTime, punchOutTime);
        if (hours > 0) {
          totalHours += hours;
        }
      });

      const result: any = {
        id: payPeriodId,
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        timeCardCount,
      };

      // If requested, also calculate employee hours
      if (includeEmployeeHours) {
        // Get department ID from pay period
        const deptField = payPeriod.fields?.department_id;
        const departmentId = Array.isArray(deptField) ? deptField[0] : deptField;
        
        // timeCards is already fetched above

        // Group punches by employee
        const employeePunches: Record<string, any[]> = {};
        const employeeIds = new Set<string>();
        
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

        // Get ALL employees in the department
        const employees: Record<string, any> = {};
        
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
        
        // Fetch ALL employees in the department
        if (departmentId) {
          const allDepartmentEmployeesResponse = await queryFillout({
            tableId: EMPLOYEES_TABLE_ID,
            filters: { department_id: { in: [departmentId] } },
            limit: 1000,
          });
          
          allDepartmentEmployeesResponse.records.forEach((emp: any) => {
            if (!employees[emp.id]) {
              employees[emp.id] = {
                id: emp.id,
                name: emp.fields.Name || emp.fields.name || emp.fields.email || 'Unknown',
                email: emp.fields.email || null,
              };
            }
          });
        }

        // Calculate hours for ALL employees
        const allEmployeeIds = Object.keys(employees);
        const employeeHours = allEmployeeIds.map((empId) => {
          const punches = employeePunches[empId] || [];
          
          const empTotalHours = punches.reduce((sum: number, punch: any) => {
            const punchInTime = punch.fields.punch_in_time;
            const punchOutTime = punch.fields.punch_out_time || null;
            
            if (punch.fields.duration && typeof punch.fields.duration === 'number') {
              return sum + punch.fields.duration;
            }
            
            return sum + calculateHours(punchInTime, punchOutTime);
          }, 0);

          const employeeTimeCards = timeCards.filter((tc: any) => {
            const tcEmpId = Array.isArray(tc.fields.employee_id)
              ? tc.fields.employee_id[0]
              : tc.fields.employee_id;
            return tcEmpId === empId;
          });

          return {
            employeeId: empId,
            employeeName: employees[empId]?.name || 'Unknown',
            employeeEmail: employees[empId]?.email || null,
            totalHours: empTotalHours,
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
        
        result.employeeHours = employeeHours;
      }

      return result;
    });

    const totals = await Promise.all(totalsPromises);
    const validTotals = totals.filter(t => t !== null);

    console.log(`✅ Calculated totals for ${validTotals.length} pay periods`);

    return NextResponse.json({ totals: validTotals });
  } catch (error: any) {
    console.error('Error calculating pay period totals:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

