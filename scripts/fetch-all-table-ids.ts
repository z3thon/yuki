/**
 * Script to fetch all table IDs from Fillout database
 * Run with: npx tsx scripts/fetch-all-table-ids.ts
 * This will output all table IDs that should be added to .env.local
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

async function fetchAllTables() {
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

    console.log('📋 All Tables in Fillout Database:\n');
    console.log('# Fillout Table IDs (Database ID: aa7a307dc0a191a5)');
    console.log('# Generated automatically - do not edit manually\n');

    // Group tables by category
    const hrTables: Array<{ name: string; id: string }> = [];
    const permissionTables: Array<{ name: string; id: string }> = [];
    const otherTables: Array<{ name: string; id: string }> = [];

    tables.forEach((table: any) => {
      const name = table.name || 'Unknown';
      const id = table.id;
      
      // C';
      
      // Categorize tables
      if (name.toLowerCase().includes('permission') || 
          name.toLowerCase().includes('user') && name.toLowerCase().includes('access') ||
          name.toLowerCase().includes('view')) {
        permissionTables.push({ name, id });
      } else if (name.toLowerCase().includes('employee') || 
                 name.toLowerCase().includes('punch') ||
                 name.toLowerCase().includes('pay') ||
                 name.toLowerCase().includes('time') ||
                 name.toLowerCase().includes('client') ||
                 name.toLowerCase().includes('project') ||
                 name.toLowerCase().includes('company') ||
                 name.toLowerCase().includes('department') ||
                 name.toLowerCase().includes('timezone')) {
        hrTables.push({ name, id });
      } else {
        otherTables.push({ name, id });
      }
    });

    // Generate environment variable names
    function toEnvVarName(tableName: string): string {
      return tableName
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .toUpperCase()
        .replace(/EMPLOYEE_PAY_RATES/g, 'PAY_RATE_HISTORY')
        .replace(/EMPLOYEE_PAY_RATE/g, 'PAY_RATE_HISTORY')
        .replace(/PAY_RATES/g, 'PAY_RATE_HISTORY');
    }

    // Output HR tables
    if (hrTables.length > 0) {
      console.log('# HR App Tables');
      hrTables.forEach(table => {
        const envVar = toEnvVarName(table.name) + '_TABLE_ID';
        console.log(`${envVar}=${table.id}`);
      });
      console.log('');
    }

    // Output permission tables
    if (permissionTables.length > 0) {
      console.log('# Permission Tables');
      permissionTables.forEach(table => {
        const envVar = toEnvVarName(table.name) + '_TABLE_ID';
        console.log(`${envVar}=${table.id}`);
      });
      console.log('');
    }

    // Output other tables
    if (otherTables.length > 0) {
      console.log('# Other Tables');
      otherTables.forEach(table => {
        const envVar = toEnvVarName(table.name) + '_TABLE_ID';
        console.log(`${envVar}=${table.id}`);
      });
      console.log('');
    }

    // Also output a summary
    console.log('\n📊 Summary:');
    console.log(`Total tables found: ${tables.length}`);
    console.log(`HR tables: ${hrTables.length}`);
    console.log(`Permission tables: ${permissionTables.length}`);
    console.log(`Other tables: ${otherTables.length}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchAllTables();
