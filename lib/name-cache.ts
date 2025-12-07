/**
 * Simple server-side cache for employee and client names
 * Just queries tables and caches ID -> name mappings
 */

import { queryFillout } from './fillout';
import { EMPLOYEES_TABLE_ID, CLIENTS_TABLE_ID, CLIENT_EMPLOYEE_ACCESS_TABLE_ID } from './fillout-table-ids';
import { EMPLOYEES_NAME_FIELD_ID } from './fillout-config.generated';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface NameCache {
  employeeNames: Map<string, string>; // employeeId -> name
  clientNames: Map<string, string>; // clientId -> name
}

// In-memory cache: companyId -> CacheEntry<NameCache>
const cache = new Map<string, CacheEntry<NameCache>>();

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheValid(entry: CacheEntry<NameCache>): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Fetch all employees for a company - simple query
 */
async function fetchEmployeesForCompany(companyId: string): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  
  try {
    console.log(`📡 Fetching employees for company ${companyId}...`);
    const response = await queryFillout({
      tableId: EMPLOYEES_TABLE_ID,
      filters: {
        company_id: { eq: companyId },
      },
      limit: 1000,
    });

    if (response?.records) {
      response.records.forEach((record: any) => {
        const fields = record.fields || {};
        const name = fields[EMPLOYEES_NAME_FIELD_ID] || fields.Name || fields.name || fields.email || record.id;
        nameMap.set(record.id, String(name).trim());
      });
      console.log(`✅ Cached ${nameMap.size} employee names`);
    }
  } catch (error: any) {
    console.error(`❌ Error fetching employees:`, error.message);
  }
  
  return nameMap;
}

/**
 * Fetch all clients accessible to employees in a company
 */
async function fetchClientsForCompany(companyId: string): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  
  try {
    // Step 1: Get employee IDs for this company
    const employeesResponse = await queryFillout({
      tableId: EMPLOYEES_TABLE_ID,
      filters: {
        company_id: { eq: companyId },
      },
      limit: 1000,
    });

    if (!employeesResponse?.records || employeesResponse.records.length === 0) {
      return nameMap;
    }

    const employeeIds = employeesResponse.records.map((r: any) => r.id);

    // Step 2: Get Client Employee Access records
    const accessResponse = await queryFillout({
      tableId: CLIENT_EMPLOYEE_ACCESS_TABLE_ID,
      filters: {
        employee_id: { in: employeeIds },
      },
      limit: 1000,
    });

    if (!accessResponse?.records) {
      return nameMap;
    }

    // Step 3: Extract unique client IDs (filter inactive)
    const clientIds = new Set<string>();
    const now = new Date();
    
    accessResponse.records.forEach((record: any) => {
      const fields = record.fields || {};
      const endDate = fields.end_date;
      if (!endDate || new Date(endDate) > now) {
        const clientId = fields.client_id;
        if (clientId) {
          const id = Array.isArray(clientId) ? clientId[0] : clientId;
          if (id) clientIds.add(String(id));
        }
      }
    });

    if (clientIds.size === 0) {
      return nameMap;
    }

    // Step 4: Fetch client names
    console.log(`📡 Fetching ${clientIds.size} clients...`);
    const clientsResponse = await queryFillout({
      tableId: CLIENTS_TABLE_ID,
      filters: {
        id: { in: Array.from(clientIds) },
        is_active: { eq: true },
      },
      limit: 1000,
    });

    if (clientsResponse?.records) {
      clientsResponse.records.forEach((record: any) => {
        const fields = record.fields || {};
        const name = fields.Name || fields.name || record.id;
        nameMap.set(record.id, String(name).trim());
      });
      console.log(`✅ Cached ${nameMap.size} client names`);
    }
  } catch (error: any) {
    console.error(`❌ Error fetching clients:`, error.message);
  }
  
  return nameMap;
}

/**
 * Get or fetch name cache for a company
 */
async function getNameCacheForCompany(companyId: string): Promise<NameCache> {
  // Check cache
  const cached = cache.get(companyId);
  if (cached && isCacheValid(cached)) {
    console.log(`✅ Cache HIT for company ${companyId}: ${cached.data.employeeNames.size} employees, ${cached.data.clientNames.size} clients`);
    
    // Print employee cache contents - MAKE IT VERY VISIBLE
    console.log('\n' + '='.repeat(80));
    console.log(`📊 EMPLOYEE CACHE (${cached.data.employeeNames.size} entries):`);
    console.log('='.repeat(80));
    const employeeEntries = Array.from(cached.data.employeeNames.entries());
    employeeEntries.forEach(([id, name], index) => {
      console.log(`  ${index + 1}. ID: ${id} -> Name: ${name}`);
    });
    console.log('='.repeat(80));
    
    // Print client cache contents - MAKE IT VERY VISIBLE
    console.log(`\n📊 CLIENT CACHE (${cached.data.clientNames.size} entries):`);
    console.log('='.repeat(80));
    const clientEntries = Array.from(cached.data.clientNames.entries());
    clientEntries.forEach(([id, name], index) => {
      console.log(`  ${index + 1}. ID: ${id} -> Name: ${name}`);
    });
    console.log('='.repeat(80) + '\n');
    
    return cached.data;
  }

  // Cache miss - fetch fresh data
  console.log(`📦 Cache MISS for company ${companyId} - fetching...`);
  
  const [employeeNames, clientNames] = await Promise.all([
    fetchEmployeesForCompany(companyId),
    fetchClientsForCompany(companyId),
  ]);

  const nameCache: NameCache = {
    employeeNames,
    clientNames,
  };

  // Store in cache
  cache.set(companyId, {
    data: nameCache,
    timestamp: Date.now(),
  });

  console.log(`✅ Cached ${employeeNames.size} employees and ${clientNames.size} clients for company ${companyId}`);
  
  // Print employee cache contents - MAKE IT VERY VISIBLE
  console.log('\n' + '='.repeat(80));
  console.log(`📊 EMPLOYEE CACHE (${employeeNames.size} entries):`);
  console.log('='.repeat(80));
  const employeeEntries = Array.from(employeeNames.entries());
  employeeEntries.forEach(([id, name], index) => {
    console.log(`  ${index + 1}. ID: ${id} -> Name: ${name}`);
  });
  console.log('='.repeat(80));
  
  // Print client cache contents - MAKE IT VERY VISIBLE
  console.log(`\n📊 CLIENT CACHE (${clientNames.size} entries):`);
  console.log('='.repeat(80));
  const clientEntries = Array.from(clientNames.entries());
  clientEntries.forEach(([id, name], index) => {
    console.log(`  ${index + 1}. ID: ${id} -> Name: ${name}`);
  });
  console.log('='.repeat(80) + '\n');
  
  return nameCache;
}

/**
 * Get company_id from user's employee record
 * Simple: query employees table by email, get company_id
 * Includes timeout to prevent hanging
 */
async function getUserCompanyId(userId: string, userEmail: string): Promise<string | null> {
  try {
    console.log(`🔍 Getting company_id for user ${userId} (email: ${userEmail})...`);
    
    // Wrap in timeout to prevent hanging
    const timeoutPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => {
        console.warn('⏱️ getUserCompanyId timeout (2s) - returning null');
        resolve(null);
      }, 2000); // 2 second timeout
    });

    const fetchPromise = (async () => {
      // Simple approach: query employees table by email
      const { queryFillout } = await import('./fillout');
      const { EMPLOYEES_TABLE_ID } = await import('./fillout-table-ids');
      
      const response = await queryFillout({
        tableId: EMPLOYEES_TABLE_ID,
        filters: {
          email: { eq: userEmail?.toLowerCase().trim() },
        },
        limit: 1,
      });
      
      if (response?.records && response.records.length > 0) {
        const employee = response.records[0];
        const fields = employee.fields || {};
        const companyId = Array.isArray(fields.company_id)
          ? fields.company_id[0]
          : fields.company_id;
        
        if (companyId) {
          console.log(`✅ Found company_id: ${companyId} for employee ${employee.id}`);
          return String(companyId);
        }
      }
      
      console.warn(`⚠️ No employee found for email ${userEmail}`);
      return null;
    })();

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    console.error('❌ Error getting company_id:', error.message);
    return null;
  }
}

/**
 * Get employee and client name maps for a user's company
 */
export async function getNameMapsForUser(
  userId: string,
  userEmail: string
): Promise<{ employeeNames: Map<string, string>; clientNames: Map<string, string> }> {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 getNameMapsForUser CALLED');
  console.log(`   userId: ${userId}`);
  console.log(`   userEmail: ${userEmail}`);
  console.log('='.repeat(80));
  
  try {
    const companyId = await getUserCompanyId(userId, userEmail);
    
    if (!companyId) {
      console.warn(`⚠️ No company_id found for user ${userId}`);
      console.log('='.repeat(80) + '\n');
      return {
        employeeNames: new Map(),
        clientNames: new Map(),
      };
    }

    console.log(`✅ Found company_id: ${companyId}`);
    const cache = await getNameCacheForCompany(companyId);
    
    console.log('='.repeat(80) + '\n');
    return {
      employeeNames: cache.employeeNames,
      clientNames: cache.clientNames,
    };
  } catch (error: any) {
    console.error('❌ Error in getNameMapsForUser:', error.message);
    console.error('Error stack:', error.stack);
    console.log('='.repeat(80) + '\n');
    return {
      employeeNames: new Map(),
      clientNames: new Map(),
    };
  }
}

/**
 * Clear cache for a specific company (or all if companyId not provided)
 */
export function clearNameCache(companyId?: string): void {
  if (companyId) {
    cache.delete(companyId);
    console.log(`🗑️ Cleared cache for company ${companyId}`);
  } else {
    cache.clear();
    console.log('🗑️ Cleared all caches');
  }
}
