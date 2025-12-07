import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord } from '@/lib/fillout';
import { getUserPermissions } from '@/lib/permission-tables';
import { getNameMapsForUser } from '@/lib/name-cache';

import { PUNCHES_TABLE_ID } from '@/lib/fillout-table-ids';
import { PUNCHES_PUNCH_IN_TIME_FIELD_ID } from '@/lib/fillout-config.generated';

/**
 * GET /api/hr/punches
 * List punches with permission filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  // LOG IMMEDIATELY - even before try/catch
  console.log('\n' + '='.repeat(80));
  console.log(`🚨 PUNCHES API CALLED - Request ID: ${requestId}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   URL: ${request.url}`);
  console.log(`   Method: ${request.method}`);
  console.log('='.repeat(80));
  
  try {
    console.log(`[${requestId}] 🔍 Starting punches API request at ${new Date().toISOString()}`);
    console.log(`[${requestId}] 📍 Step 1: Verifying auth...`);
    
    const authStartTime = Date.now();
    // Wrap verifyAuthAndGetUser with timeout
    const user = await Promise.race([
      verifyAuthAndGetUser(request),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          console.error(`[${requestId}] ⏰ TIMEOUT: verifyAuthAndGetUser took longer than 5 seconds`);
          resolve(null);
        }, 5000);
      }),
    ]);
    console.log(`[${requestId}] ⏱️ verifyAuthAndGetUser took ${Date.now() - authStartTime}ms`);
    
    if (!user) {
      console.log(`[${requestId}] ❌ No user found - returning 401`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${requestId}] ✅ User authenticated: ${user.uid}, email: ${user.email || 'no email'}`);
    console.log(`[${requestId}] ⏱️ Auth check took ${Date.now() - startTime}ms`);

    // Get user permissions once (used for both access check and filtering)
    console.log(`[${requestId}] 📍 Step 2: Getting user permissions...`);
    const permStartTime = Date.now();
    let permissions;
    try {
      // Add timeout wrapper
      const permPromise = getUserPermissions(user.uid);
      const permTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('getUserPermissions timeout after 5 seconds')), 5000);
      });
      permissions = await Promise.race([permPromise, permTimeoutPromise]);
      console.log(`[${requestId}] ⏱️ getUserPermissions took ${Date.now() - permStartTime}ms`);
    } catch (permError: any) {
      console.error(`[${requestId}] ❌ Error getting permissions:`, permError?.message);
      // Return error instead of hanging
      return NextResponse.json(
        { error: 'Failed to get permissions: ' + (permError?.message || 'Timeout') },
        { status: 500 }
      );
    }
    const hrPermissions = permissions.filter(p => p.appId === 'hr');
    console.log(`[${requestId}] ✅ Got ${permissions.length} total permissions, ${hrPermissions.length} HR permissions`);
    
    // Check app access
    console.log(`[${requestId}] 📍 Step 3: Checking app access...`);
    const appAccessStartTime = Date.now();
    let hasAccess;
    try {
      // Add timeout wrapper
      const accessPromise = hasAppAccess(user.uid, 'hr');
      const accessTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('hasAppAccess timeout after 5 seconds')), 5000);
      });
      hasAccess = await Promise.race([accessPromise, accessTimeoutPromise]);
      console.log(`[${requestId}] ⏱️ hasAppAccess took ${Date.now() - appAccessStartTime}ms`);
    } catch (accessError: any) {
      console.error(`[${requestId}] ❌ Error checking app access:`, accessError?.message);
      return NextResponse.json(
        { error: 'Failed to check app access: ' + (accessError?.message || 'Timeout') },
        { status: 500 }
      );
    }
    if (!hasAccess) {
      console.log(`[${requestId}] ❌ No app access - returning 403`);
      return NextResponse.json(
        { error: 'Access denied to HR app' },
        { status: 403 }
      );
    }
    console.log(`[${requestId}] ✅ App access granted`);

    // Check view-level permission using the proper checkPermission function
    console.log(`[${requestId}] 📍 Step 4: Checking view permission...`);
    const viewPermStartTime = Date.now();
    let canReadPunches = false;
    try {
      // Add timeout wrapper
      const permCheckPromise = checkPermission({
        userId: user.uid,
        appId: 'hr',
        viewId: 'time-tracking',
        resourceType: 'punch',
        action: 'read',
      });
      const permCheckTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('checkPermission timeout after 5 seconds')), 5000);
      });
      canReadPunches = await Promise.race([permCheckPromise, permCheckTimeoutPromise]);
      console.log(`[${requestId}] ⏱️ checkPermission took ${Date.now() - viewPermStartTime}ms`);
    } catch (permissionError: any) {
      console.error(`[${requestId}] ❌ Error checking permission:`, permissionError);
      console.error(`[${requestId}] Permission error stack:`, permissionError?.stack);
      console.error(`[${requestId}] Permission error message:`, permissionError?.message);
      return NextResponse.json(
        { error: 'Error checking permissions: ' + (permissionError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    if (!canReadPunches) {
      console.log(`[${requestId}] ❌ No view permission - returning 403`);
      return NextResponse.json(
        { error: 'Access denied to time tracking view' },
        { status: 403 }
      );
    }

    console.log(`[${requestId}] ✅ Permissions check passed`);
    
    // Build filters based on permissions
    const filters: Record<string, any> = {};
    
    // Check if user has limited access (specific employee_ids in permissions)
    const hasLimitedAccess = hrPermissions.some(p => 
      p.viewId === 'time-tracking' && 
      p.resourceType === 'punch' && 
      p.resourceId // If resourceId exists, user has limited access
    );

    if (hasLimitedAccess) {
      // User can only see punches for specific employees
      const allowedEmployeeIds = hrPermissions
        .filter(p => p.viewId === 'time-tracking' && p.resourceType === 'punch' && p.resourceId)
        .map(p => p.resourceId)
        .filter(Boolean) as string[];
      
      if (allowedEmployeeIds.length > 0) {
        filters.employee_id = { in: allowedEmployeeIds };
      } else {
        return NextResponse.json({ punches: [] });
      }
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employee_id');
    const clientId = searchParams.get('client_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offsetParam = searchParams.get('offset');
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    // Add filters
    if (employeeId) {
      filters.employee_id = { in: [employeeId] };
    }

    if (clientId) {
      filters.client_id = { in: [clientId] };
    }

    // Default to last 30 days if no date range specified (major performance improvement)
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filters.punch_in_time = {
        gte: thirtyDaysAgo.toISOString().split('T')[0], // YYYY-MM-DD format
      };
    } else {
      if (startDate || endDate) {
        filters.punch_in_time = {};
        if (startDate) filters.punch_in_time.gte = startDate;
        if (endDate) filters.punch_in_time.lte = endDate;
      }
    }

    // Query Fillout with sorting (server-side sorting is faster)
    // Note: Fillout API requires 'fieldId' (not 'field') and field IDs (not field names) for sorting
    console.log(`[${requestId}] 📍 Step 5: Querying Fillout API...`);
    console.log(`[${requestId}] 📡 Query params:`, {
      tableId: PUNCHES_TABLE_ID,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sort: [{ fieldId: PUNCHES_PUNCH_IN_TIME_FIELD_ID, direction: 'desc' }],
      limit,
      offset: offset > 0 ? offset.toString() : undefined,
    });
    const filloutStartTime = Date.now();
    
    let response;
    try {
      // Add timeout wrapper to prevent hanging
      const filloutPromise = queryFillout({
        tableId: PUNCHES_TABLE_ID,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        sort: [{ fieldId: PUNCHES_PUNCH_IN_TIME_FIELD_ID, direction: 'desc' }], // Sort by most recent first (using fieldId and field ID)
        limit,
        offset: offset > 0 ? offset.toString() : undefined,
      });
      
      const filloutTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Fillout API timeout after 10 seconds`));
        }, 10000); // 10 second timeout
      });
      
      response = await Promise.race([filloutPromise, filloutTimeoutPromise]);
      console.log(`[${requestId}] ⏱️ queryFillout took ${Date.now() - filloutStartTime}ms`);
    } catch (filloutError: any) {
      console.error(`[${requestId}] ❌ Fillout API error:`, filloutError);
      console.error(`[${requestId}] Fillout error message:`, filloutError?.message);
      console.error(`[${requestId}] Fillout error stack:`, filloutError?.stack);
      // Return empty array instead of throwing - don't break the page
      return NextResponse.json({
        punches: [],
        total: 0,
        hasMore: false,
        offset: 0,
        error: filloutError?.message || 'Failed to fetch punches',
      });
    }
    
    console.log(`[${requestId}] ✅ Got response from Fillout:`, {
      hasRecords: !!response?.records,
      recordCount: response?.records?.length || 0,
      hasMore: response?.hasMore,
      offset: response?.offset,
    });

    console.log(`[${requestId}] 📍 Step 6: Validating response...`);
    if (!response || !response.records) {
      console.warn(`[${requestId}] ⚠️ Unexpected response format from Fillout:`, JSON.stringify(response, null, 2));
      return NextResponse.json({
        punches: [],
        total: 0,
        hasMore: false,
        offset: 0,
      });
    }

    // Early return if no records
    if (response.records.length === 0) {
      console.log(`[${requestId}] ⚠️ No punch records found - returning empty array`);
      return NextResponse.json({
        punches: [],
        total: 0,
        hasMore: false,
        offset: 0,
      });
    }

    console.log(`[${requestId}] 📍 Step 7: Getting name maps from cache (with 3s timeout)...`);
    const nameCacheStartTime = Date.now();
    let employeeNameMap = new Map<string, string>();
    let clientNameMap = new Map<string, string>();
    
    try {
      // Try to get names from cache with a SHORT timeout - don't wait forever
      const nameFetchPromise = getNameMapsForUser(user.uid, user.email || '');
      const nameTimeoutPromise = new Promise<{ employeeNames: Map<string, string>; clientNames: Map<string, string> }>((resolve) => {
        setTimeout(() => {
          console.warn(`[${requestId}] ⏱️ Name cache timeout (3s) - continuing with empty maps (IDs will show instead of names)`);
          resolve({
            employeeNames: new Map(),
            clientNames: new Map(),
          });
        }, 3000); // Very short 3 second timeout
      });

      const nameMaps = await Promise.race([nameFetchPromise, nameTimeoutPromise]);
      employeeNameMap = nameMaps.employeeNames;
      clientNameMap = nameMaps.clientNames;
      
      const nameCacheTime = Date.now() - nameCacheStartTime;
      console.log(`[${requestId}] ⏱️ Name cache took ${nameCacheTime}ms`);
      console.log(`[${requestId}] ✅ Got ${employeeNameMap.size} employee names and ${clientNameMap.size} client names from cache`);
      
      // Log sample of cached names
      if (employeeNameMap.size > 0) {
        const sampleEmployees = Array.from(employeeNameMap.entries()).slice(0, 3);
        console.log(`[${requestId}] 📋 Sample employee names:`, sampleEmployees);
      }
      if (clientNameMap.size > 0) {
        const sampleClients = Array.from(clientNameMap.entries()).slice(0, 3);
        console.log(`[${requestId}] 📋 Sample client names:`, sampleClients);
      }
    } catch (error: any) {
      console.error(`[${requestId}] ⚠️ Error getting name maps, continuing with empty maps:`, error?.message);
      console.error(`[${requestId}] Error stack:`, error?.stack);
      // Continue with empty maps - IDs will be displayed instead of names
    }
    
    console.log(`[${requestId}] 📍 Step 8: Proceeding to process punches (will use IDs if names not available)...`);

    console.log(`[${requestId}] 📍 Step 8: Processing ${response.records.length} punch records...`);
    const processStartTime = Date.now();

    // Format punches with names from maps
    console.log(`[${requestId}] 📍 Step 8: Mapping records to punches...`);
    let processedCount = 0;
    let errorCount = 0;
    
    const punches = response.records.map((record: any, index: number) => {
      try {
        const fields = record.fields || {};
        const employeeId = Array.isArray(fields.employee_id) 
          ? fields.employee_id[0] 
          : fields.employee_id;
        const clientId = Array.isArray(fields.client_id) 
          ? fields.client_id[0] 
          : fields.client_id;
        
        // Get names from maps (lookup fields don't work, so we fetch separately)
        // Convert IDs to strings for consistent lookup
        // Fallback to showing the ID if name not found
        const employeeName = employeeId 
          ? (employeeNameMap.get(String(employeeId).trim()) || String(employeeId)) 
          : 'No Employee';
        const clientName = clientId 
          ? (clientNameMap.get(String(clientId).trim()) || String(clientId)) 
          : 'No Client';
        
        processedCount++;
        if (index < 3) {
          console.log(`[${requestId}]   Punch ${index + 1}: id=${record.id}, emp=${employeeId}, client=${clientId}`);
        }
        
        return {
          id: record.id,
          employeeId: employeeId || null,
          employeeName,
          clientId: clientId || null,
          clientName,
          punchInTime: fields.punch_in_time,
          punchOutTime: fields.punch_out_time || null,
          duration: fields.duration || null,
          notes: fields.memo || null,
          createdAt: fields.created_at || record.createdTime,
          updatedAt: fields.updated_at || record.createdTime,
        };
      } catch (recordError: any) {
        errorCount++;
        console.error(`[${requestId}] ❌ Error processing punch record ${index}:`, recordError);
        console.error(`[${requestId}] Record data:`, JSON.stringify(record, null, 2));
        // Return a minimal record so we don't break the whole response
        return {
          id: record.id || 'unknown',
          employeeId: null,
          employeeName: 'Error',
          clientId: null,
          clientName: 'Error',
          punchInTime: '',
          punchOutTime: null,
          duration: null,
          notes: null,
          createdAt: record.createdTime || new Date().toISOString(),
          updatedAt: record.createdTime || new Date().toISOString(),
        };
      }
    });

    console.log(`[${requestId}] ⏱️ Processing took ${Date.now() - processStartTime}ms`);
    console.log(`[${requestId}] ✅ Processed ${processedCount} punches successfully, ${errorCount} errors`);
    console.log(`[${requestId}] 📊 Final stats: ${punches.length} total punches, ${employeeNameMap.size} employees, ${clientNameMap.size} clients`);

    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] 📍 Step 9: Returning response (total time: ${totalTime}ms)...`);

    const jsonResponse = {
      punches,
      total: punches.length,
      hasMore: response.hasMore || false,
      offset: response.offset || offset,
    };
    
    console.log(`[${requestId}] ✅ Successfully returning ${punches.length} punches after ${totalTime}ms`);
    
    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ ERROR in punches API after ${totalTime}ms:`);
    console.error(`[${requestId}] Error type:`, error?.constructor?.name);
    console.error(`[${requestId}] Error message:`, error?.message);
    console.error(`[${requestId}] Error stack:`, error?.stack);
    console.error(`[${requestId}] Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return NextResponse.json(
      { 
        error: error?.message || 'Internal server error',
        requestId,
        duration: totalTime,
      },
      { status: 500 }
    );
  }
}

