/**
 * Script to find field IDs for Employee Pay Rates table
 * Run with: npx tsx scripts/find-pay-rate-field-ids.ts
 */

import dotenv from 'dotenv';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (value && !key.startsWith('#')) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (err) {
  console.warn('Could not load .env.local, using process.env');
}

config({ path: '.env.local' });

const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1/bases';
const FILLOUT_BASE_ID = process.env.FILLOUT_BASE_ID || 'aa7a307dc0a191a5';
const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';
const PAY_RATE_HISTORY_TABLE_ID = process.env.PAY_RATE_HISTORY_TABLE_ID || 't4Va6eDRwTF';

async function findFieldIds() {
  if (!FILLOUT_API_TOKEN) {
    console.error('❌ FILLOUT_API_TOKEN not found in environment variables');
    process.exit(1);
  }

  try {
    // Get database structure
    const url = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const tables = data.tables || [];

    // Find Employee Pay Rates table
    const payRateTable = tables.find((table: any) => 
      table.id === PAY_RATE_HISTORY_TABLE_ID || 
      table.name?.toLowerCase().includes('pay rate')
    );

    if (!payRateTable) {
      console.error(`❌ Employee Pay Rates table not found (ID: ${PAY_RATE_HISTORY_TABLE_ID})`);
      process.exit(1);
    }

    console.log(`✅ Found table: ${payRateTable.name} (ID: ${payRateTable.id})\n`);
    console.log('Field IDs for Employee Pay Rates table:\n');

    const fields = payRateTable.fields || [];
    fields.forEach((field: any) => {
      const name = field.name || 'Unknown';
      const id = field.id;
      const type = field.type || 'unknown';
      
      console.log(`  ${name}:`);
      console.log(`    Field ID: ${id}`);
      console.log(`    Type: ${type}`);
      if (field.type === 'linked_record') {
        console.log(`    ⚠️  Use this field ID (${id}) when creating/updating records`);
      }
      console.log('');
    });

    // Find employee_id field specifically
    const employeeIdField = fields.find((f: any) => 
      f.name?.toLowerCase().includes('employee') && 
      f.type === 'linked_record'
    );

    if (employeeIdField) {
      console.log('\n📝 Add this to your .env.local file:');
      console.log(`PAY_RATE_HISTORY_EMPLOYEE_ID_FIELD_ID=${employeeIdField.id}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findFieldIds();

