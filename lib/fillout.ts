import { FilloutResponse, FilloutRecord } from '@/types';

const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1/bases';
const FILLOUT_BASE_ID = process.env.FILLOUT_BASE_ID || 'aa7a307dc0a191a5'; // Primary database
// Support both FILLOUT_API_TOKEN and FILLOUT_API_KEY for compatibility
const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';

export interface FilloutQueryOptions {
  tableId: string;
  filters?: Record<string, any>;
  sort?: Array<{ fieldId: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: string;
  fields?: string[];
}

export async function queryFillout(options: FilloutQueryOptions): Promise<FilloutResponse> {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${options.tableId}/records/list`;
  
  const body: any = {
    filters: options.filters,
    sort: options.sort,
    limit: options.limit || 100,
  };
  
  // Convert offset to number if provided (Fillout API expects number)
  if (options.offset !== undefined) {
    body.offset = typeof options.offset === 'string' ? parseInt(options.offset, 10) : options.offset;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Fillout API error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage += ` - ${JSON.stringify(errorData.error)}`;
      } else if (errorData.message) {
        errorMessage += ` - ${errorData.message}`;
      }
    } catch {
      // If response isn't JSON, use statusText
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getFilloutRecord(tableId: string, recordId: string): Promise<FilloutRecord> {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${tableId}/records/${recordId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fillout API error: ${response.statusText}`);
  }

  return response.json();
}

export async function createFilloutRecord(tableId: string, fields: Record<string, any>): Promise<FilloutRecord> {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${tableId}/records`;
  
  // Discovery: API requires {"record": {field_name: value, ...}} format
  // Fields go directly under "record", NOT nested in "fields"
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ record: fields }),
  });

  if (!response.ok) {
    throw new Error(`Fillout API error: ${response.statusText}`);
  }

  return response.json();
}

export async function updateFilloutRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<FilloutRecord> {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${tableId}/records/${recordId}`;
  
  // Discovery: Update also requires {"record": {fields}} format (same as create)
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ record: fields }),
  });

  if (!response.ok) {
    throw new Error(`Fillout API error: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteFilloutRecord(tableId: string, recordId: string): Promise<void> {
  const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${tableId}/records/${recordId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fillout API error: ${response.statusText}`);
  }
}

