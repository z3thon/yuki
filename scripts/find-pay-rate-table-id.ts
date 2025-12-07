/**
 * Script to find the Employee Pay Rates table ID
 * Run with: npx tsx scripts/find-pay-rate-table-id.ts
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

async function findPayRateTable() {
  if (!FILLOUT_API_TOKEN) {
    console.error('❌ FILLOUT_API_TOKEN not found in environment variables');
    process.exit(1);
  }

  try {
    // Get all tables in the database
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

    // Look for tables with "pay" or "rate" in the name
    const payRateTables = tables.filter((table: any) => {
      const name = (table.name || '').toLowerCase();
      return name.includes('pay') && (name.includes('rate') || name.includes('rate'));
    });

    if (payRateTables.length === 0) {
      console.log('❌ No pay rate table found. Searching for all tables...\n');
      console.log('All tables in database:');
      tables.forEach((table: any) => {
        console.log(`  - ${table.name} (ID: ${table.id})`);
      });
    } else {
      console.log('✅ Found Employee Pay Rates table(s):\n');
      payRateTables.forEach((table: any) => {
        console.log(`  Table Name: ${table.name}`);
        console.log(`  Table ID: ${table.id}`);
        console.log(`  Fields:`, table.fields?.map((f: any) => f.name).join(', ') || 'N/A');
        console.log('');
      });
      
      if (payRateTables.length === 1) {
        console.log('📝 Add this to your .env.local file:');
        console.log(`PAY_RATE_HISTORY_TABLE_ID=${payRateTables[0].id}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findPayRateTable();
