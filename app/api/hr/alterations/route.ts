import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord, updateFilloutRecord } from '@/lib/fillout';
import { getUserPermissions } from '@/lib/permission-tables';

import { PUNCH_ALTERATIONS_TABLE_ID, PUNCHES_TABLE_ID, EMPLOYEES_TABLE_ID, TIMEZONES_ACTUAL_TABLE_ID } from '@/lib/fillout-table-ids';
import { EMPLOYEES_NAME_FIELD_ID, TIMEZONES_ACTUAL_IANA_NAME_FIELD_ID, PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID } from '@/lib/fillout-config.generated';

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
    // Use field ID for status field (required after field recreation)
    const filters: Record<string, any> = {
      [PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID]: { in: [status] },
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

    // Helper function to parse a date string as UTC
    // Ensures we always get UTC timestamp regardless of input format
    // CRITICAL: All times in Fillout are stored as UTC, so we must parse them as UTC
    const parseAsUTC = (dateStr: string): number => {
      if (!dateStr || typeof dateStr !== 'string') {
        throw new Error(`Invalid date string: ${dateStr}`);
      }
      
      // Normalize the string - remove any trailing spaces
      const normalized = dateStr.trim();
      
      // If already has 'Z' suffix, parse directly as UTC
      if (normalized.endsWith('Z')) {
        const date = new Date(normalized);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid UTC date with Z: ${normalized}`);
        }
        return date.getTime();
      }
      
      // If has timezone offset (+HH:MM or -HH:MM), parse it (will convert to UTC automatically)
      const offsetMatch = normalized.match(/([+-])(\d{2}):(\d{2})$/);
      if (offsetMatch) {
        const date = new Date(normalized);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date with offset: ${normalized}`);
        }
        return date.getTime(); // getTime() always returns UTC milliseconds
      }
      
      // If no timezone info, treat as UTC by appending 'Z'
      // This handles formats like "2025-12-06T21:44:00" or "2025-12-06T21:44:00.000"
      // IMPORTANT: Without 'Z', JavaScript would interpret as local time, which is wrong
      const utcStr = normalized + 'Z';
      const date = new Date(utcStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format (after adding Z): ${utcStr} (original: ${normalized})`);
      }
      return date.getTime();
    };

    // Helper function to calculate duration in minutes
    // CRITICAL: This function calculates duration from UTC values stored in the database
    // It completely ignores any timezone information - duration is based purely on UTC timestamps
    // This ensures that 1 minute difference in UTC = 1 minute duration, regardless of display timezone
    const calculateDuration = (punchInTime: string | null, punchOutTime: string | null): number | null => {
      if (!punchInTime || !punchOutTime) return null;
      
      try {
        // Parse both dates as UTC timestamps (milliseconds since epoch)
        const inTime = parseAsUTC(punchInTime);
        const outTime = parseAsUTC(punchOutTime);
        
        if (isNaN(inTime) || isNaN(outTime)) {
          console.error('Invalid date values:', { 
            punchInTime, 
            punchOutTime,
            inTime,
            outTime
          });
          return null;
        }
        
        // Calculate difference in minutes
        // This is the actual time difference in UTC, independent of any timezone display
        const diffMs = outTime - inTime;
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        
        // Debug logging (can be removed in production)
        if (Math.abs(diffMinutes) > 60) {
          console.log('Duration calculation:', {
            punchInTime,
            punchOutTime,
            inTimeUTC: new Date(inTime).toISOString(),
            outTimeUTC: new Date(outTime).toISOString(),
            diffMs,
            diffMinutes
          });
        }
        
        return diffMinutes;
      } catch (error) {
        console.error('Error calculating duration:', error, { punchInTime, punchOutTime });
        return null;
      }
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

    // Cache for timezone IANA names and display names to avoid repeated API calls
    const timezoneIanaCache = new Map<string, string | null>();
    const timezoneNameCache = new Map<string, string | null>();
    
    // Helper function to get timezone IANA name from timezone_actual_id
    const getTimezoneIanaName = async (timezoneActualId: string | null | undefined): Promise<string | null> => {
      if (!timezoneActualId) return null;
      
      // Check cache first
      if (timezoneIanaCache.has(timezoneActualId)) {
        return timezoneIanaCache.get(timezoneActualId) || null;
      }
      
      try {
        const timezoneActual = await getFilloutRecord(TIMEZONES_ACTUAL_TABLE_ID, timezoneActualId);
        if (!timezoneActual) {
          timezoneIanaCache.set(timezoneActualId, null);
          return null;
        }
        
        // Try multiple field name variations for IANA name
        const ianaName = timezoneActual.fields[TIMEZONES_ACTUAL_IANA_NAME_FIELD_ID] 
          || timezoneActual.fields.iana_name
          || timezoneActual.fields['iana_name']
          || timezoneActual.fields['Iana Name']
          || timezoneActual.fields['IANA Name'];
        
        const resolvedIana = ianaName ? ianaName.toString().trim() : null;
        
        // Also cache the display name for potential fallback
        const displayName = timezoneActual.fields.name 
          || timezoneActual.fields.Name
          || timezoneActual.fields['name']
          || timezoneActual.fields['Name'];
        if (displayName) {
          timezoneNameCache.set(timezoneActualId, displayName.toString().trim());
        }
        
        // Cache the result
        timezoneIanaCache.set(timezoneActualId, resolvedIana);
        
        // Log if IANA name is missing but we have a display name
        if (!resolvedIana && displayName) {
          console.warn('Timezone IANA name missing, but display name available:', {
            timezoneActualId,
            displayName: displayName.toString().trim()
          });
        }
        
        return resolvedIana;
      } catch (err) {
        console.error('Error fetching timezone:', err, { timezoneActualId });
        timezoneIanaCache.set(timezoneActualId, null);
        return null;
      }
    };
    
    // Helper to get timezone display name (for fallback abbreviation generation)
    const getTimezoneDisplayName = (timezoneActualId: string | null | undefined): string | null => {
      if (!timezoneActualId) return null;
      return timezoneNameCache.get(timezoneActualId) || null;
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
              
              // Get timezone IDs
              const punchInTimezoneId = Array.isArray(punch.fields.timezone_actual_id)
                ? punch.fields.timezone_actual_id[0]
                : punch.fields.timezone_actual_id;
              const punchOutTimezoneId = Array.isArray(punch.fields.punch_out_timezone_actual_id)
                ? punch.fields.punch_out_timezone_actual_id[0]
                : punch.fields.punch_out_timezone_actual_id;
              
              // Get timezone IANA names
              const punchInTimezoneIana = await getTimezoneIanaName(punchInTimezoneId);
              const punchOutTimezoneIana = await getTimezoneIanaName(punchOutTimezoneId || punchInTimezoneId);
              
              punchDetails = {
                id: punch.id,
                employeeId,
                punchInTime: punch.fields.punch_in_time,
                punchOutTime: punch.fields.punch_out_time,
                punchInTimezoneIana: punchInTimezoneIana,
                punchOutTimezoneIana: punchOutTimezoneIana,
              };

              // Get employee name
              employeeName = await getEmployeeName(employeeId);

              // Calculate previous duration
              // IMPORTANT: Use raw UTC values from database - ignore timezone fields
              // Duration is calculated from UTC timestamps, not timezone-converted display values
              previousDuration = calculateDuration(
                punch.fields.punch_in_time,  // UTC value from DB
                punch.fields.punch_out_time  // UTC value from DB
              );
            }
          } catch (err) {
            console.error('Error fetching punch details:', err);
          }
        }

        // Calculate new duration if new times are provided
        // IMPORTANT: Use raw UTC values from database - ignore timezone fields
        // Duration is calculated from UTC timestamps, not timezone-converted display values
        const newPunchInTime = record.fields.new_punch_in_time || null;
        const newPunchOutTime = record.fields.new_punch_out_time || null;
        if (newPunchInTime && newPunchOutTime) {
          // Calculate duration directly from UTC values stored in DB
          // The timezone fields (new_timezone_actual_id) are only for display, not calculation
          newDuration = calculateDuration(newPunchInTime, newPunchOutTime);
        }

        // Get timezone IDs for new times
        // These are linked_record fields, so they come as arrays or single values
        // Try both field name and field ID (Fillout may return either)
        const PUNCH_ALTERATION_NEW_TIMEZONE_ACTUAL_ID_FIELD_ID = 'fkQQPqaGsj3';
        const PUNCH_ALTERATION_NEW_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID = 'fkBQ6kQwhjp';
        
        // Try field name first, then field ID
        const rawInTimezoneField = record.fields.new_timezone_actual_id 
          || record.fields[PUNCH_ALTERATION_NEW_TIMEZONE_ACTUAL_ID_FIELD_ID];
        const rawOutTimezoneField = record.fields.new_punch_out_timezone_actual_id 
          || record.fields[PUNCH_ALTERATION_NEW_PUNCH_OUT_TIMEZONE_ACTUAL_ID_FIELD_ID];
        
        const newPunchInTimezoneId = Array.isArray(rawInTimezoneField)
          ? rawInTimezoneField[0]
          : rawInTimezoneField;
        const newPunchOutTimezoneId = Array.isArray(rawOutTimezoneField)
          ? rawOutTimezoneField[0]
          : rawOutTimezoneField;
        
        // Get timezone IANA names for new times
        // IMPORTANT: Each time can have its own timezone - don't fall back to punch-in timezone for punch-out
        // If punch-out timezone is not specified, use null (don't assume it's the same as punch-in)
        const newPunchInTimezoneIana = await getTimezoneIanaName(newPunchInTimezoneId);
        const newPunchOutTimezoneIana = newPunchOutTimezoneId 
          ? await getTimezoneIanaName(newPunchOutTimezoneId)
          : null; // Don't fall back - if not specified, it's null
        
        // Get display names (these are cached during getTimezoneIanaName calls)
        const newPunchInTimezoneName = getTimezoneDisplayName(newPunchInTimezoneId);
        const newPunchOutTimezoneName = getTimezoneDisplayName(newPunchOutTimezoneId);
        
        // Debug: Log what we're returning (temporary - remove after fixing)
        if (newPunchInTime || newPunchOutTime) {
          console.log('Alteration timezone resolution:', {
            alterationId: record.id,
            newPunchInTimezoneId,
            newPunchOutTimezoneId,
            newPunchInTimezoneIana,
            newPunchOutTimezoneIana,
            newPunchInTimezoneName,
            newPunchOutTimezoneName
          });
        }

        // Read status field - try both field name and field ID (Fillout may return either)
        const statusValue = record.fields.status 
          || record.fields[PUNCH_ALTERATION_REQUESTS_STATUS_FIELD_ID];
        
        return {
          id: record.id,
          punchId,
          punchDetails,
          employeeName,
          requestedAt: record.fields.requested_at,
          newPunchInTime: newPunchInTime,
          newPunchOutTime: newPunchOutTime,
          newPunchInTimezoneIana: newPunchInTimezoneIana,
          newPunchOutTimezoneIana: newPunchOutTimezoneIana,
          // Also include display names for fallback abbreviation generation
          newPunchInTimezoneName: getTimezoneDisplayName(newPunchInTimezoneId),
          newPunchOutTimezoneName: getTimezoneDisplayName(newPunchOutTimezoneId),
          newMemo: record.fields.new_memo || null,
          reason: record.fields.reason || null,
          status: statusValue,
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

