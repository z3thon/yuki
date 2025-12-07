/**
 * Script to add department_id field to Pay Periods table and update existing records
 * Run with: npx tsx scripts/add-department-to-pay-periods.ts
 */

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

const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1/bases';
const FILLOUT_BASE_ID = process.env.FILLOUT_BASE_ID || 'aa7a307dc0a191a5';
const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';
const PAY_PERIODS_TABLE_ID = process.env.PAY_PERIODS_TABLE_ID || 'tk8fyCDXQ8H';
const DEPARTMENTS_TABLE_ID = process.env.DEPARTMENTS_TABLE_ID || 'tviEhSR8rfg';

async function addDepartmentFieldToPayPeriods() {
  if (!FILLOUT_API_TOKEN) {
    console.error('❌ FILLOUT_API_TOKEN not found in environment variables');
    process.exit(1);
  }

  try {
    console.log('🔍 Checking Pay Periods table structure...');
    
    // Get database structure to check if field already exists
    const dbUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}`;
    const dbResponse = await fetch(dbUrl, {
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      },
    });

    if (!dbResponse.ok) {
      throw new Error(`Failed to fetch database: ${dbResponse.statusText}`);
    }

    const database = await dbResponse.json();
    const payPeriodsTable = database.tables?.find((t: any) => t.id === PAY_PERIODS_TABLE_ID);
    
    if (!payPeriodsTable) {
      throw new Error(`Pay Periods table not found (ID: ${PAY_PERIODS_TABLE_ID})`);
    }

    // Check if department_id field already exists
    const existingField = payPeriodsTable.fields?.find((f: any) => 
      f.name === 'department_id' || f.name === 'Department'
    );

    let departmentFieldId: string;

    if (existingField) {
      console.log(`✅ Department field already exists: ${existingField.name} (${existingField.id})`);
      departmentFieldId = existingField.id;
    } else {
      console.log('📝 Creating department_id field...');
      
      // Create the field
      const fieldUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${PAY_PERIODS_TABLE_ID}/fields`;
      const fieldResponse = await fetch(fieldUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'department_id',
          type: 'linked_record',
          template: {
            tableId: DEPARTMENTS_TABLE_ID,
          },
        }),
      });

      if (!fieldResponse.ok) {
        const errorText = await fieldResponse.text();
        throw new Error(`Failed to create field: ${fieldResponse.status} ${errorText}`);
      }

      const fieldData = await fieldResponse.json();
      departmentFieldId = fieldData.id || fieldData.field?.id;
      console.log(`✅ Field created: ${departmentFieldId}`);
    }

    // Get all departments (assuming there's one main department for now)
    console.log('\n🔍 Fetching departments...');
    const deptUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${DEPARTMENTS_TABLE_ID}/records/list`;
    const deptResponse = await fetch(deptUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 100 }),
    });

    if (!deptResponse.ok) {
      throw new Error(`Failed to fetch departments: ${deptResponse.statusText}`);
    }

    const deptData = await deptResponse.json();
    const departments = deptData.records || [];

    if (departments.length === 0) {
      console.log('⚠️  No departments found. Please create a department first.');
      return;
    }

    // Use the first department (or you can specify which one)
    const defaultDepartmentId = departments[0].id;
    console.log(`📌 Using department: ${departments[0].fields?.Name || departments[0].fields?.name || defaultDepartmentId}`);

    // Get all pay periods
    console.log('\n🔍 Fetching pay periods...');
    const ppUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${PAY_PERIODS_TABLE_ID}/records/list`;
    const ppResponse = await fetch(ppUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 1000 }),
    });

    if (!ppResponse.ok) {
      throw new Error(`Failed to fetch pay periods: ${ppResponse.statusText}`);
    }

    const ppData = await ppResponse.json();
    const payPeriods = ppData.records || [];

    console.log(`📊 Found ${payPeriods.length} pay periods to update`);

    // Update each pay period with department_id
    let updated = 0;
    let skipped = 0;

    for (const pp of payPeriods) {
      // Check if already has department_id
      const hasDept = pp.fields?.department_id || pp.fields?.Department;
      if (hasDept) {
        skipped++;
        continue;
      }

      // Update the record
      const updateUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${PAY_PERIODS_TABLE_ID}/records/${pp.id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          record: {
            [departmentFieldId]: [defaultDepartmentId], // Use field ID for linked_record
          },
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`❌ Failed to update pay period ${pp.id}: ${errorText}`);
        continue;
      }

      updated++;
      if (updated % 10 === 0) {
        console.log(`   Updated ${updated}/${payPeriods.length}...`);
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped (already had department): ${skipped}`);
    console.log(`\n💡 Add this to your config:`);
    console.log(`   PAY_PERIODS_DEPARTMENT_ID_FIELD_ID=${departmentFieldId}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

addDepartmentFieldToPayPeriods();

