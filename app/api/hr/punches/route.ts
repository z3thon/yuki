import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthAndGetUser } from '@/lib/auth-helpers';
import { checkPermission, hasAppAccess } from '@/lib/permissions';
import { queryFillout, getFilloutRecord } from '@/lib/fillout';
import { getUserPermissions } from '@/lib/permission-tables';
import { EMPLOYEES_TABLE_ID, CLIENTS_TABLE_ID } from '@/lib/fillout-table-ids';
import { PUNCHES_PUNCH_IN_TIME_FIELD_ID, EMPLOYEES_NAME_FIELD_ID, CLIENTS_NAME_FIELD_ID, PUNCHES_INVOICE_ID_FIELD_ID, CLIENT_INVOICES_NAME_FIELD_ID } from '@/lib/fillout-config.generated';
import { PUNCHES_TABLE_ID, CLIENT_INVOICES_TABLE_ID } from '@/lib/fillout-table-ids';

/**
 * GET /api/hr/punches
 * List punches with permission filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[${requestId}] 🔍 Starting punches API request at ${new Date().toISOString()}`);
    console.log(`[${requestId}] 📍 Step 1: Verifying auth...`);
    
    const user = await verifyAuthAndGetUser(request);
    
    if (!user) {
      console.log(`[${requestId}] ❌ No user found - returning 401`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${requestId}] ✅ User authenticated: ${user.uid}, email: ${user.email || 'no email'}`);
    console.log(`[${requestId}] ⏱️ Auth check took ${Date.now() - startTime}ms`);

    // Get user permissions once (used for both access check and filtering)
    console.log(`[${requestId}] 📍 Step 2: Getting user permissions...`);
    const permStartTime = Date.now();
    const permissions = await getUserPermissions(user.uid);
    console.log(`[${requestId}] ⏱️ getUserPermissions took ${Date.now() - permStartTime}ms`);
    const hrPermissions = permissions.filter(p => p.appId === 'hr');
    console.log(`[${requestId}] ✅ Got ${permissions.length} total permissions, ${hrPermissions.length} HR permissions`);
    
    // Check app access
    console.log(`[${requestId}] 📍 Step 3: Checking app access...`);
    const appAccessStartTime = Date.now();
    const hasAccess = await hasAppAccess(user.uid, 'hr');
    console.log(`[${requestId}] ⏱️ hasAppAccess took ${Date.now() - appAccessStartTime}ms`);
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
      canReadPunches = await checkPermission({
        userId: user.uid,
        appId: 'hr',
        viewId: 'time-tracking',
        resourceType: 'punch',
        action: 'read',
      });
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

    // Add filters from query parameters
    // Note: If user has limited access, employee_id filter is already set above
    // Query param employee_id will further restrict (must be within allowedEmployeeIds)
    if (employeeId) {
      // If we already have employee_id filter from permissions, intersect them
      if (filters.employee_id && Array.isArray(filters.employee_id.in)) {
        const allowedIds = filters.employee_id.in;
        if (allowedIds.includes(employeeId)) {
          // Query param employee_id is within allowed list, use it
          filters.employee_id = { in: [employeeId] };
          console.log(`[${requestId}] ✅ Filtering by employee_id ${employeeId} (within allowed list)`);
        } else {
          // Query param employee_id is NOT in allowed list, return empty
          console.log(`[${requestId}] ⚠️ Requested employee_id ${employeeId} not in allowed list ${allowedIds.join(', ')}, returning empty`);
          return NextResponse.json({ punches: [], total: 0, hasMore: false, offset: 0 });
        }
      } else {
        // No permission restriction, use query param as-is
        filters.employee_id = { in: [employeeId] };
        console.log(`[${requestId}] ✅ Filtering by employee_id ${employeeId} (no permission restriction)`);
      }
    }

    if (clientId) {
      filters.client_id = { in: [clientId] };
    }

    // Apply date filters if provided
    if (startDate || endDate) {
      filters.punch_in_time = {};
      if (startDate) filters.punch_in_time.gte = startDate;
      if (endDate) filters.punch_in_time.lte = endDate;
    }
    // Note: Removed default 30-day filter to show all punches by default
    // Users can add date filters if needed for performance

    // Query Fillout with sorting (server-side sorting is faster)
    // Note: Fillout API requires 'fieldId' (not 'field') and field IDs (not field names) for sorting
    console.log(`[${requestId}] 📍 Step 5: Querying Fillout API...`);
    console.log(`[${requestId}] 📊 Filters being applied:`, JSON.stringify(filters, null, 2));
    console.log(`[${requestId}] 📊 Query params from URL:`, {
      employeeId: employeeId || '(none)',
      clientId: clientId || '(none)',
      startDate: startDate || '(none)',
      endDate: endDate || '(none)',
      limit,
      offset,
    });
    
    // Build query options - match employees route pattern exactly
    const queryOptions: any = {
      tableId: PUNCHES_TABLE_ID,
      sort: [{ fieldId: PUNCHES_PUNCH_IN_TIME_FIELD_ID, direction: 'desc' }],
      limit,
    };
    
    // Only add filters if we have any (empty filters object might cause issues)
    if (Object.keys(filters).length > 0) {
      queryOptions.filters = filters;
      console.log(`[${requestId}] ✅ Adding ${Object.keys(filters).length} filter(s) to query:`, Object.keys(filters));
    } else {
      console.log(`[${requestId}] ℹ️ No filters applied - querying all punches`);
    }
    
    // Only add offset if > 0
    if (offset > 0) {
      queryOptions.offset = offset.toString();
    }
    
    console.log(`[${requestId}] 📡 Final query options being sent:`, JSON.stringify(queryOptions, null, 2));
    
    const filloutStartTime = Date.now();
    
    let response;
    try {
      console.log(`[${requestId}] 📤 Sending query to Fillout API...`);
      console.log(`[${requestId}] 📤 Query body:`, JSON.stringify(queryOptions, null, 2));
      response = await queryFillout(queryOptions);
      console.log(`[${requestId}] ⏱️ queryFillout took ${Date.now() - filloutStartTime}ms`);
      console.log(`[${requestId}] 📥 Raw Fillout response type:`, typeof response);
      console.log(`[${requestId}] 📥 Raw Fillout response keys:`, response ? Object.keys(response) : 'null');
    } catch (filloutError: any) {
      console.error(`[${requestId}] ❌ Fillout API error:`, filloutError);
      console.error(`[${requestId}] Fillout error message:`, filloutError?.message);
      console.error(`[${requestId}] Fillout error stack:`, filloutError?.stack);
      console.error(`[${requestId}] Fillout error details:`, JSON.stringify(filloutError, Object.getOwnPropertyNames(filloutError), 2));
      throw filloutError;
    }
    
    console.log(`[${requestId}] ✅ Got response from Fillout:`, {
      hasRecords: !!response?.records,
      recordCount: response?.records?.length || 0,
      hasMore: response?.hasMore,
      offset: response?.offset,
      responseType: typeof response,
      responseKeys: response ? Object.keys(response) : [],
      recordsType: typeof response?.records,
      recordsIsArray: Array.isArray(response?.records),
    });
    
    // Log full response structure for debugging (truncated)
    if (response) {
      const responseStr = JSON.stringify(response, null, 2);
      console.log(`[${requestId}] 📋 Full response (first 1000 chars):`, responseStr.substring(0, 1000));
    }

    console.log(`[${requestId}] 📍 Step 6: Validating response...`);
    if (!response) {
      console.error(`[${requestId}] ❌ No response from Fillout API`);
      return NextResponse.json({
        punches: [],
        total: 0,
        hasMore: false,
        offset: 0,
      });
    }
    
    // Use response.records directly (matching employees route pattern)
    // FilloutResponse type: { records: FilloutRecord[], offset?: string, hasMore?: boolean }
    const records = response.records || [];
    console.log(`[${requestId}] ✅ Found ${records.length} records in response.records`);
    
    if (!Array.isArray(records)) {
      console.error(`[${requestId}] ❌ response.records is not an array:`, typeof records, records);
      return NextResponse.json({
        punches: [],
        total: 0,
        hasMore: false,
        offset: 0,
      });
    }

    // Early return if no records
    if (records.length === 0) {
      console.log(`[${requestId}] ⚠️ No punch records found - returning empty array`);
      console.log(`[${requestId}]   Applied filters:`, JSON.stringify(filters, null, 2));
      console.log(`[${requestId}]   Query options sent:`, JSON.stringify(queryOptions, null, 2));
      console.log(`[${requestId}]   Response structure:`, {
        hasRecords: !!response?.records,
        recordsLength: response?.records?.length || 0,
        responseKeys: response ? Object.keys(response) : [],
        fullResponse: JSON.stringify(response, null, 2).substring(0, 500), // First 500 chars
      });
      
      // Log a test query without filters to see if we can get ANY punches
      console.log(`[${requestId}] 🧪 Testing unfiltered query to verify API works...`);
      try {
        const testResponse = await queryFillout({
          tableId: PUNCHES_TABLE_ID,
          limit: 5,
        });
        const testRecords = testResponse?.records || [];
        console.log(`[${requestId}] 🧪 Test query returned ${testRecords.length} records`);
        if (testRecords.length > 0) {
          console.log(`[${requestId}] 🧪 Sample record fields:`, Object.keys(testRecords[0]?.fields || {}));
          console.log(`[${requestId}] 🧪 Sample record:`, JSON.stringify(testRecords[0], null, 2).substring(0, 300));
        } else {
          console.log(`[${requestId}] 🧪 Test query also returned 0 records - likely no punches in database`);
        }
      } catch (testError: any) {
        console.error(`[${requestId}] 🧪 Test query failed:`, testError?.message);
        console.error(`[${requestId}] 🧪 Test error stack:`, testError?.stack);
      }
      
      return NextResponse.json({
        punches: [],
        total: 0,
        hasMore: false,
        offset: 0,
      });
    }
    
    console.log(`[${requestId}] ✅ Found ${records.length} punch records to process`);

    console.log(`[${requestId}] 📍 Step 7: Collecting unique employee and client IDs...`);
    const processStartTime = Date.now();
    
    // Collect all unique employee_ids, client_ids, and invoice_ids from punches
    const employeeIds = new Set<string>();
    const clientIds = new Set<string>();
    const invoiceIds = new Set<string>();
    
    records.forEach((record: any) => {
      const fields = record.fields || {};
      const employeeId = Array.isArray(fields.employee_id) 
        ? fields.employee_id[0] 
        : fields.employee_id;
      const clientId = Array.isArray(fields.client_id) 
        ? fields.client_id[0] 
        : fields.client_id;
      // Fillout may return linked_record fields by name OR field ID (inconsistent!)
      // Check both to be safe
      const invoiceIdRaw = fields.invoice_id || fields[PUNCHES_INVOICE_ID_FIELD_ID];
      const invoiceId = Array.isArray(invoiceIdRaw) 
        ? invoiceIdRaw[0] 
        : invoiceIdRaw;
      
      if (employeeId) employeeIds.add(String(employeeId).trim());
      if (clientId) clientIds.add(String(clientId).trim());
      if (invoiceId) invoiceIds.add(String(invoiceId).trim());
    });
    
    console.log(`[${requestId}] 📊 Found ${employeeIds.size} unique employee IDs, ${clientIds.size} unique client IDs, and ${invoiceIds.size} unique invoice IDs`);

    // Fetch employee names in bulk
    console.log(`[${requestId}] 📍 Step 8: Fetching employee names...`);
    const employeeNameMap = new Map<string, string>();
    if (employeeIds.size > 0) {
      try {
        const employeesStartTime = Date.now();
        const employeesResponse = await queryFillout({
          tableId: EMPLOYEES_TABLE_ID,
          filters: { id: { in: Array.from(employeeIds) } },
          limit: 1000,
        });
        console.log(`[${requestId}] ⏱️ Employee fetch took ${Date.now() - employeesStartTime}ms`);
        
        employeesResponse.records.forEach((emp: any) => {
          const getNameValue = (val: any) => val && val.toString().trim() ? val.toString().trim() : null;
          const name = getNameValue(emp.fields[EMPLOYEES_NAME_FIELD_ID])
            || getNameValue(emp.fields.Name)
            || getNameValue(emp.fields.name)
            || getNameValue(emp.fields.email)
            || 'Unknown';
          employeeNameMap.set(String(emp.id).trim(), name);
        });
        console.log(`[${requestId}] ✅ Loaded ${employeeNameMap.size} employee names`);
      } catch (employeeError: any) {
        console.error(`[${requestId}] ❌ Error fetching employees:`, employeeError);
        // Continue with empty map - names will show as "Unknown"
      }
    }

    // Fetch client names in bulk
    console.log(`[${requestId}] 📍 Step 9: Fetching client names...`);
    const clientNameMap = new Map<string, string>();
    if (clientIds.size > 0) {
      try {
        const clientsStartTime = Date.now();
        const clientsResponse = await queryFillout({
          tableId: CLIENTS_TABLE_ID,
          filters: { id: { in: Array.from(clientIds) } },
          limit: 1000,
        });
        console.log(`[${requestId}] ⏱️ Client fetch took ${Date.now() - clientsStartTime}ms`);
        
        clientsResponse.records.forEach((client: any) => {
          const getNameValue = (val: any) => val && val.toString().trim() ? val.toString().trim() : null;
          const name = getNameValue(client.fields[CLIENTS_NAME_FIELD_ID])
            || getNameValue(client.fields.Name)
            || getNameValue(client.fields.name)
            || 'Unknown';
          clientNameMap.set(String(client.id).trim(), name);
        });
        console.log(`[${requestId}] ✅ Loaded ${clientNameMap.size} client names`);
      } catch (clientError: any) {
        console.error(`[${requestId}] ❌ Error fetching clients:`, clientError);
        // Continue with empty map - names will show as "Unknown"
      }
    }

    // Fetch invoice names in bulk
    console.log(`[${requestId}] 📍 Step 10: Fetching invoice names...`);
    const invoiceNameMap = new Map<string, string>();
    if (invoiceIds.size > 0) {
      try {
        const invoicesStartTime = Date.now();
        const invoicesResponse = await queryFillout({
          tableId: CLIENT_INVOICES_TABLE_ID,
          filters: { id: { in: Array.from(invoiceIds) } },
          limit: 1000,
        });
        console.log(`[${requestId}] ⏱️ Invoice fetch took ${Date.now() - invoicesStartTime}ms`);
        
        if (invoicesResponse?.records) {
          invoicesResponse.records.forEach((invoice: any) => {
            try {
              const getNameValue = (val: any) => val && val.toString().trim() ? val.toString().trim() : null;
              const name = getNameValue(invoice.fields?.[CLIENT_INVOICES_NAME_FIELD_ID])
                || getNameValue(invoice.fields?.Name)
                || getNameValue(invoice.fields?.name)
                || 'Unknown';
              invoiceNameMap.set(String(invoice.id).trim(), name);
            } catch (invoiceRecordError: any) {
              console.error(`[${requestId}] ❌ Error processing invoice record ${invoice.id}:`, invoiceRecordError);
            }
          });
          console.log(`[${requestId}] ✅ Loaded ${invoiceNameMap.size} invoice names`);
        } else {
          console.warn(`[${requestId}] ⚠️ Invoice response missing records array`);
        }
      } catch (invoiceError: any) {
        console.error(`[${requestId}] ❌ Error fetching invoices:`, invoiceError);
        console.error(`[${requestId}] Invoice error message:`, invoiceError?.message);
        console.error(`[${requestId}] Invoice error stack:`, invoiceError?.stack);
        // Continue with empty map - punches will show without invoice info
      }
    } else {
      console.log(`[${requestId}] ℹ️ No invoice IDs found, skipping invoice fetch`);
    }

    // Format punches with names from maps
    console.log(`[${requestId}] 📍 Step 11: Mapping records to punches...`);
    let processedCount = 0;
    let errorCount = 0;
    
    const punches = records.map((record: any, index: number) => {
      try {
        const fields = record.fields || {};
        const employeeId = Array.isArray(fields.employee_id) 
          ? fields.employee_id[0] 
          : fields.employee_id;
        const clientId = Array.isArray(fields.client_id) 
          ? fields.client_id[0] 
          : fields.client_id;
        // Fillout may return linked_record fields by name OR field ID (inconsistent!)
        // Check both to be safe
        const invoiceIdRaw = fields.invoice_id || fields[PUNCHES_INVOICE_ID_FIELD_ID];
        const invoiceId = Array.isArray(invoiceIdRaw) 
          ? invoiceIdRaw[0] 
          : invoiceIdRaw;
        
        // Get names from maps (lookup fields don't work, so we fetch separately)
        // Convert IDs to strings for consistent lookup
        const employeeName = employeeId ? (employeeNameMap.get(String(employeeId).trim()) || 'Unknown') : 'Unknown';
        const clientName = clientId ? (clientNameMap.get(String(clientId).trim()) || 'Unknown') : 'Unknown';
        const invoiceNumber = invoiceId ? (invoiceNameMap.get(String(invoiceId).trim()) || null) : null;
        
        processedCount++;
        if (index < 3) {
          console.log(`[${requestId}]   Punch ${index + 1}: id=${record.id}, emp=${employeeId}, client=${clientId}, invoice=${invoiceId}`);
        }
        
        return {
          id: record.id,
          employeeId: employeeId || null,
          employeeName,
          clientId: clientId || null,
          clientName,
          invoiceId: invoiceId || null,
          invoiceNumber,
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
          invoiceId: null,
          invoiceNumber: null,
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
    console.log(`[${requestId}] 📊 Final stats: ${punches.length} total punches, ${employeeNameMap.size} employees, ${clientNameMap.size} clients, ${invoiceNameMap.size} invoices`);

    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] 📍 Step 12: Returning response (total time: ${totalTime}ms)...`);

    const jsonResponse = {
      punches,
      total: punches.length,
      hasMore: response?.hasMore || false,
      offset: response?.offset || offset,
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

