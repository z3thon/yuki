import { queryFillout, createFilloutRecord, updateFilloutRecord, deleteFilloutRecord, getFilloutRecord } from './fillout';
import { filloutConfig, getTableId, getFieldId } from './fillout-config.generated';

const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1/bases';
const FILLOUT_BASE_ID = process.env.FILLOUT_BASE_ID || '';
const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';

/**
 * Get all tables from the config file (synchronous, optimized)
 * Returns table metadata from the generated config
 */
export function getTablesFromConfig() {
  return Object.entries(filloutConfig.tables).map(([name, config]) => ({
    id: config.id,
    name,
    fields: Object.entries(config.fields).map(([fieldName, fieldId]) => ({
      id: fieldId,
      name: fieldName,
    })),
  }));
}

/**
 * Get table ID by name from config (synchronous, optimized)
 * Use this instead of querying the API
 */
export function getTableIdByName(tableName: string): string | undefined {
  return getTableId(tableName);
}

/**
 * Get field ID by table and field name from config (synchronous, optimized)
 * Use this instead of querying the API
 */
export function getFieldIdByName(tableName: string, fieldName: string): string | undefined {
  return getFieldId(tableName, fieldName);
}

/**
 * Find a table by name from config (synchronous, optimized)
 * Use this instead of querying the API
 */
export function findTableByNameSync(tableName: string) {
  const tableId = getTableId(tableName);
  if (!tableId) return undefined;
  
  const tableConfig = filloutConfig.tables[tableName];
  if (!tableConfig) return undefined;
  
  return {
    id: tableId,
    name: tableName,
    fields: Object.entries(tableConfig.fields).map(([fieldName, fieldId]) => ({
      id: fieldId,
      name: fieldName,
    })),
  };
}

/**
 * Get all tables in the database (async, queries API)
 * Use getTablesFromConfig() for better performance in most cases
 * This is kept for admin/debugging purposes or when fresh data is needed
 */
export async function getDatabaseTables() {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fillout API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.tables || [];
}

/**
 * Get a specific table by ID (async, queries API)
 * Use findTableByNameSync() for better performance in most cases
 * This is kept for admin/debugging purposes or when fresh data is needed
 */
export async function getTable(tableId: string) {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fillout API error: ${response.statusText}`);
  }

  const data = await response.json();
  const table = data.tables?.find((t: any) => t.id === tableId);
  
  if (!table) {
    throw new Error(`Table ${tableId} not found`);
  }

  return table;
}

/**
 * Create a new table in Fillout
 * Note: This requires admin access and may need to be done via Fillout UI
 * This function is for reference/documentation purposes
 */
export async function createTable(tableName: string, fields: Array<{
  name: string;
  type: string;
  required?: boolean;
  options?: any;
}>) {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: tableName,
      fields: fields.map(field => ({
        name: field.name,
        type: field.type,
        template: field.options || {},
        required: field.required || false,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Fillout API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Find a table by name (case-insensitive, synchronous, optimized)
 * Use this instead of the async version for better performance
 */
export function findTableByName(tableName: string) {
  // Try exact match first
  let table = findTableByNameSync(tableName);
  if (table) return table;
  
  // Try case-insensitive match
  const tableNames = Object.keys(filloutConfig.tables);
  const matchedName = tableNames.find(name => 
    name.toLowerCase() === tableName.toLowerCase()
  );
  
  if (matchedName) {
    return findTableByNameSync(matchedName);
  }
  
  return undefined;
}

/**
 * Find a table by name (async, queries API)
 * Use findTableByName() for better performance in most cases
 * This is kept for scripts that need fresh data
 */
export async function findTableByNameAsync(tableName: string) {
  const tables = await getDatabaseTables();
  return tables.find((t: any) => 
    t.name.toLowerCase() === tableName.toLowerCase()
  );
}

/**
 * Get or create a table (idempotent)
 * Returns existing table if found, creates new one if not
 * Uses config file for lookup first, then queries API if not found
 */
export async function getOrCreateTable(
  tableName: string,
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    options?: any;
  }>
) {
  // Try config first (fast, synchronous)
  const existing = findTableByName(tableName);
  if (existing) {
    return existing;
  }

  // Fallback to API query (for scripts that create new tables)
  const existingAsync = await findTableByNameAsync(tableName);
  if (existingAsync) {
    return existingAsync;
  }

  return createTable(tableName, fields);
}

