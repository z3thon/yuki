import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout } from '@/lib/fillout';

import { PAY_PERIODS_TABLE_ID, TIME_CARDS_TABLE_ID, PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/pay-periods
 * Get pay period data with aggregates
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('department_id');
    const limit = parseInt(searchParams.get('limit') || '5'); // Default to 5 for initial load
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('Pay periods API called with:', {
      departmentId,
      limit,
      offset,
      allParams: Object.fromEntries(searchParams.entries()),
    });

    // Strategy: Always fetch all records and filter client-side for department
    // Server-side filtering with Fillout API is unreliable for linked_record fields
    console.log('Department ID being filtered:', departmentId || 'None (all departments)');

    // Always fetch a larger set (we'll filter client-side)
    const queryOptions: any = {
      tableId: PAY_PERIODS_TABLE_ID,
      limit: 100, // Fetch more records for client-side filtering
    };
    
    if (offset > 0) {
      queryOptions.offset = offset.toString();
    }

    console.log('Query options:', JSON.stringify(queryOptions, null, 2));

    let payPeriodsResponse;
    try {
      payPeriodsResponse = await queryFillout(queryOptions);
    } catch (error: any) {
      console.error('❌ Fillout API error:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Error type:', error?.constructor?.name);
      // Re-throw with better error message
      const errorMessage = error?.message || error?.toString() || 'Unknown Fillout API error';
      throw new Error(`Failed to query Fillout: ${errorMessage}`);
    }

    console.log('📊 Fillout response:', {
      hasRecords: !!payPeriodsResponse.records,
      recordCount: payPeriodsResponse.records?.length || 0,
    });
    
    // Handle different response formats
    let payPeriodRecords: any[] = [];
    if (Array.isArray(payPeriodsResponse)) {
      payPeriodRecords = payPeriodsResponse;
    } else if (payPeriodsResponse?.records) {
      payPeriodRecords = payPeriodsResponse.records;
    } else {
      // Try accessing as any to handle unexpected formats
      const responseAny = payPeriodsResponse as any;
      if (responseAny?.data?.records) {
        payPeriodRecords = responseAny.data.records;
      }
    }
    
    console.log(`📦 Fetched ${payPeriodRecords.length} pay period records from Fillout`);
    
    // Track original count before filtering (for hasMore calculation)
    const originalRecordCount = payPeriodRecords.length;
    
    // Filter by department_id client-side (more reliable than server-side filtering)
    if (departmentId) {
      const beforeCount = payPeriodRecords.length;
      console.log(`🔍 Filtering ${beforeCount} pay periods for department: ${departmentId}`);
      
      payPeriodRecords = payPeriodRecords.filter((record: any) => {
        const deptField = record.fields?.department_id;
        
        // Log first record for debugging
        if (payPeriodRecords.indexOf(record) === 0) {
          console.log('🔍 First record department_id field:', {
            deptField,
            deptFieldType: typeof deptField,
            isArray: Array.isArray(deptField),
            departmentId,
            departmentIdType: typeof departmentId,
          });
        }
        
        if (deptField === undefined || deptField === null) {
          if (payPeriodRecords.indexOf(record) < 3) {
            console.log(`⚠️ Record ${record.id} has no department_id field`);
          }
          return false;
        }
        
        // Handle array format (linked records are arrays in Fillout)
        // Also handle if it's already a string
        let deptIds: string[] = [];
        if (Array.isArray(deptField)) {
          deptIds = deptField.map(id => String(id).trim());
        } else {
          deptIds = [String(deptField).trim()];
        }
        
        // Normalize department ID for comparison
        // Use exact match - Fillout stores full UUIDs in arrays
        const normalizedDeptId = String(departmentId).trim();
        const matches = deptIds.some(id => {
          const normalizedId = String(id).trim();
          return normalizedId === normalizedDeptId;
        });
        
        if (!matches && payPeriodRecords.indexOf(record) < 3) {
          // Log first few non-matching records for debugging
          console.log(`❌ Record ${record.id} doesn't match:`, {
            department_id_field: deptField,
            deptIds,
            expected: normalizedDeptId,
            comparison: deptIds.map(id => ({
              id,
              exactMatch: id === normalizedDeptId,
              includes: id.includes(normalizedDeptId) || normalizedDeptId.includes(id),
            })),
          });
        }
        
        return matches;
      });
      
      console.log(`✅ Client-side filtered ${beforeCount} records → ${payPeriodRecords.length} matching department ${departmentId}`);
      
      if (payPeriodRecords.length === 0 && beforeCount > 0) {
        // Show sample of unfiltered records to debug why filtering failed
        const sampleRecords = payPeriodsResponse.records?.slice(0, 3) || [];
        console.log('⚠️ No matches found! Sample unfiltered records:', 
          sampleRecords.map((r: any) => ({
            id: r.id,
            deptByName: r.fields?.department_id,
            deptById: r.fields?.['fjnL221aCPk'],
            allFieldKeys: Object.keys(r.fields || {}),
          }))
        );
      }
    }
    
    // Apply limit after filtering (but don't limit before we've done relevance sorting)
    // We'll apply limit after relevance-based selection

    // Format pay periods (simple mapping, no time card aggregation)
    // Aggregation can be done on-demand when viewing a specific pay period
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    console.log('Processing pay periods. Today:', today.toISOString(), 'Total records:', payPeriodRecords.length);
    
    const payPeriods = payPeriodRecords.map((record: any) => {
      // Handle date parsing with error checking
      // Fillout returns dates as strings like "2025-11-26" (YYYY-MM-DD format)
      let startDate: Date;
      let endDate: Date;
      
      try {
        // Parse date strings - if they're in YYYY-MM-DD format, parse as local date
        const startDateStr = record.fields.start_date;
        const endDateStr = record.fields.end_date;
        
        // Handle YYYY-MM-DD format by parsing as local date (not UTC)
        if (typeof startDateStr === 'string' && startDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          const [year, month, day] = startDateStr.split('T')[0].split('-').map(Number);
          startDate = new Date(year, month - 1, day); // month is 0-indexed
        } else {
          startDate = new Date(startDateStr);
        }
        
        if (typeof endDateStr === 'string' && endDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          const [year, month, day] = endDateStr.split('T')[0].split('-').map(Number);
          endDate = new Date(year, month - 1, day); // month is 0-indexed
        } else {
          endDate = new Date(endDateStr);
        }
        
        // Check if dates are valid
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.warn('Invalid date in pay period:', record.id, {
            start_date: record.fields.start_date,
            end_date: record.fields.end_date,
          });
          // Use today as fallback for invalid dates
          startDate = new Date(today);
          endDate = new Date(today);
        }
      } catch (error) {
        console.error('Error parsing dates for pay period:', record.id, error);
        startDate = new Date(today);
        endDate = new Date(today);
      }
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999); // Include entire end date
      
      // Determine relevance: current (today falls within period), upcoming (starts in future), or past
      let relevance: 'current' | 'upcoming' | 'past';
      if (today >= startDate && today <= endDate) {
        relevance = 'current';
      } else if (startDate > today) {
        relevance = 'upcoming';
      } else {
        relevance = 'past';
      }
      
      // Debug logging for first few periods
      if (payPeriodRecords.indexOf(record) < 3) {
        console.log(`📅 Pay period ${record.id}:`, {
          start_date_str: record.fields.start_date,
          end_date_str: record.fields.end_date,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          today: today.toISOString().split('T')[0],
          relevance,
          isCurrent: today >= startDate && today <= endDate,
        });
      }
      
      return {
        id: record.id,
        name: `${record.fields.start_date} - ${record.fields.end_date}`, // Use dates as name
        startDate: record.fields.start_date,
        endDate: record.fields.end_date,
        payoutDate: record.fields.payout_date || null,
        periodType: record.fields.period_type || null,
        totalHours: 0, // Will be calculated below
        timeCardCount: 0, // Will be calculated below
        relevance, // For sorting
      };
    });
    
    // Sort first, then select final periods, then calculate totals only for those
    // Sort by relevance (current first, then upcoming, then past), then by start date
    payPeriods.sort((a, b) => {
      // Priority: current > upcoming > past
      const relevanceOrder = { current: 0, upcoming: 1, past: 2 };
      const relevanceDiff = relevanceOrder[a.relevance] - relevanceOrder[b.relevance];
      
      if (relevanceDiff !== 0) {
        return relevanceDiff;
      }
      
      // Within same relevance, sort by start date
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      
      if (a.relevance === 'current' || a.relevance === 'upcoming') {
        // For current/upcoming: ascending (earliest first)
        return dateA - dateB;
      } else {
        // For past: descending (most recent first)
        return dateB - dateA;
      }
    });
    
    // Strategy: Find current period, then get periods going backwards from there
    // This matches the Python script logic
    const currentPeriod = payPeriods.find(pp => pp.relevance === 'current');
    
    let finalPayPeriods: typeof payPeriods = [];
    
    if (currentPeriod) {
      // Found current period - get it + 4 previous periods
      const currentEndDate = new Date(currentPeriod.endDate);
      currentEndDate.setHours(23, 59, 59, 999);
      
      // Get all periods that end on or before the current period's end date
      // Sort by end date descending (most recent first)
      const periodsUpToCurrent = payPeriods
        .filter(pp => {
          const ppEndDate = new Date(pp.endDate);
          ppEndDate.setHours(23, 59, 59, 999);
          return ppEndDate <= currentEndDate || pp.id === currentPeriod.id;
        })
        .sort((a, b) => {
          const dateA = new Date(a.endDate).getTime();
          const dateB = new Date(b.endDate).getTime();
          return dateB - dateA; // Most recent first
        });
      
      // Take first 5 (current + 4 previous)
      finalPayPeriods = periodsUpToCurrent.slice(0, limit);
      
      console.log('Found current period, selected periods:', {
        currentPeriod: {
          id: currentPeriod.id,
          dates: `${currentPeriod.startDate} - ${currentPeriod.endDate}`,
        },
        totalSelected: finalPayPeriods.length,
        selectedIds: finalPayPeriods.map(pp => pp.id),
      });
    } else {
      // No current period - get the 5 most recent past periods
      const pastPeriods = payPeriods
        .filter(pp => pp.relevance === 'past')
        .sort((a, b) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return dateB - dateA; // Most recent first
        });
      
      finalPayPeriods = pastPeriods.slice(0, limit);
      
      console.log('No current period found, selected most recent past periods:', {
        totalSelected: finalPayPeriods.length,
      });
    }
    
    // Calculate totals only for final selected periods (to improve performance)
    const calculateTotalsForVisiblePeriods = searchParams.get('calculate_totals') === 'true';
    
    if (calculateTotalsForVisiblePeriods && finalPayPeriods.length > 0) {
      console.log(`📊 Calculating totals for ${finalPayPeriods.length} visible pay periods...`);
      
      // Helper function to calculate hours from punch in/out times
      const calculateHours = (punchInTime: string, punchOutTime: string | null): number => {
        if (!punchInTime || !punchOutTime) return 0;
        
        try {
          const inTime = new Date(punchInTime);
          const outTime = new Date(punchOutTime);
          
          if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) {
            return 0;
          }
          
          const diffMs = outTime.getTime() - inTime.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          
          // Ensure non-negative and reasonable (max 24 hours per punch)
          return Math.max(0, Math.min(24, diffHours));
        } catch (error) {
          return 0;
        }
      };
      
      const payPeriodTotals = await Promise.all(
        finalPayPeriods.map(async (payPeriod) => {
          try {
            // Get time cards for this pay period
            const timeCardsResponse = await queryFillout({
              tableId: TIME_CARDS_TABLE_ID,
              filters: { pay_period_id: { in: [payPeriod.id] } },
              limit: 1000,
            });
            
            const timeCardCount = timeCardsResponse.records.length;
            const timeCardIds = new Set(timeCardsResponse.records.map((tc: any) => tc.id));
            
            // Fetch punches within the pay period date range
            let totalHours = 0;
            let offset = 0;
            const limit = 2000;
            let hasMore = true;
            let allPunches: any[] = [];
            
            // Convert date strings to proper format for Fillout API
            // Fillout expects dates in YYYY-MM-DD format for date filtering
            // Extract date part from ISO datetime strings
            const startDateFilter = payPeriod.startDate.split('T')[0];
            const endDateFilter = payPeriod.endDate.split('T')[0];
            
            while (hasMore && offset < 10000) { // Safety limit
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
              
              // Safety check: don't fetch more than 10000 total
              if (allPunches.length >= 10000) {
                console.warn(`⚠️ Reached 10000 punches limit for pay period ${payPeriod.id}`);
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
              
              // If we found linked punches, use them; otherwise use all punches in date range
              if (linkedPunches.length > 0) {
                filteredPunches = linkedPunches;
                console.log(`   ✅ Using ${linkedPunches.length} punches linked to time cards`);
              } else {
                // No linked punches, use all punches in date range (fallback)
                filteredPunches = allPunches;
                console.log(`   ⚠️ No punches linked to time cards, using all ${allPunches.length} punches in date range`);
              }
            }
            
            // Calculate total hours from punches
            let punchesWithHours = 0;
            filteredPunches.forEach((punch: any) => {
              const punchInTime = punch.fields.punch_in_time;
              const punchOutTime = punch.fields.punch_out_time;
              
              // Try duration field first, then calculate from in/out times
              if (punch.fields.duration) {
                const duration = parseFloat(punch.fields.duration);
                if (!isNaN(duration) && duration > 0) {
                  totalHours += duration;
                  punchesWithHours++;
                  return;
                }
              }
              
              // Calculate from punch in/out times
              const hours = calculateHours(punchInTime, punchOutTime);
              if (hours > 0) {
                totalHours += hours;
                punchesWithHours++;
              }
            });
            
            console.log(`   Calculated ${totalHours.toFixed(2)} hours from ${punchesWithHours} punches`);
            
            return {
              id: payPeriod.id,
              totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
              timeCardCount,
            };
          } catch (error: any) {
            console.error(`Error calculating totals for pay period ${payPeriod.id}:`, error);
            return {
              id: payPeriod.id,
              totalHours: 0,
              timeCardCount: 0,
            };
          }
        })
      );
      
      // Merge totals back into final pay periods
      const totalsMap = new Map(payPeriodTotals.map(t => [t.id, t]));
      finalPayPeriods.forEach(pp => {
        const totals = totalsMap.get(pp.id);
        if (totals) {
          pp.totalHours = totals.totalHours;
          pp.timeCardCount = totals.timeCardCount;
        }
      });
      
      console.log(`✅ Calculated totals for ${finalPayPeriods.length} pay periods`);
    } else {
      console.log(`⏭️ Skipping totals calculation (calculate_totals=false or no periods)`);
    }
    
    console.log('Pay periods relevance breakdown:', {
      current: payPeriods.filter(pp => pp.relevance === 'current').length,
      upcoming: payPeriods.filter(pp => pp.relevance === 'upcoming').length,
      past: payPeriods.filter(pp => pp.relevance === 'past').length,
    });
    
    console.log('Final pay periods count:', finalPayPeriods.length);

    // Calculate hasMore: if we got exactly the limit, there might be more
    // We fetched up to 100 records, filtered, then took limit
    // If we got limit items and there were more records fetched, there might be more
    const hasMore = finalPayPeriods.length >= limit && originalRecordCount >= 100;

    return NextResponse.json({
      payPeriods: finalPayPeriods,
      total: finalPayPeriods.length,
      hasMore,
      offset: 0,
    });
  } catch (error: any) {
    console.error('❌ Error fetching pay periods:', error);
    console.error('Error stack:', error.stack);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    
    // Return proper error response with status code
    const errorMessage = error?.message || error?.toString() || 'Internal server error';
    return NextResponse.json(
      {
        error: errorMessage,
        payPeriods: [],
        total: 0,
        hasMore: false,
        offset: 0,
      },
      { status: 500 }
    );
  }
}

