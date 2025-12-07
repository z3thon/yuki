/**
 * Script to inspect pay periods and their department relationships
 * Run with: npx tsx scripts/inspect-pay-periods.ts
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

async function inspectPayPeriods() {
  if (!FILLOUT_API_TOKEN) {
    console.error('❌ FILLOUT_API_TOKEN not found in environment variables');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching database structure...');
    
    // Get database structure to find field IDs
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
    const departmentsTable = database.tables?.find((t: any) => t.id === DEPARTMENTS_TABLE_ID);
    
    if (!payPeriodsTable) {
      throw new Error(`Pay Periods table not found (ID: ${PAY_PERIODS_TABLE_ID})`);
    }

    // Find department_id field
    const departmentField = payPeriodsTable.fields?.find((f: any) => 
      f.name === 'department_id' || f.name === 'Department'
    );

    if (!departmentField) {
      throw new Error('department_id field not found in Pay Periods table');
    }

    const departmentFieldId = departmentField.id;
    const departmentFieldName = departmentField.name;
    console.log(`✅ Found department field: ${departmentFieldName} (${departmentFieldId})`);

    // Get all departments
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

    console.log(`📋 Found ${departments.length} departments:`);
    const departmentMap = new Map<string, string>();
    departments.forEach((dept: any) => {
      const name = dept.fields?.Name || dept.fields?.name || dept.id;
      departmentMap.set(dept.id, name);
      console.log(`   - ${name} (${dept.id})`);
    });

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

    console.log(`\n📊 Found ${payPeriods.length} pay periods:\n`);

    // Analyze each pay period
    let withDepartment = 0;
    let withoutDepartment = 0;
    const deptCounts = new Map<string, number>();

    payPeriods.forEach((pp: any, index: number) => {
      const deptValue = pp.fields?.[departmentFieldId] || pp.fields?.[departmentFieldName] || pp.fields?.department_id || pp.fields?.Department;
      const deptId = Array.isArray(deptValue) ? deptValue[0] : deptValue;
      const deptName = deptId ? (departmentMap.get(deptId) || 'Unknown') : null;
      
      const startDate = pp.fields?.start_date || 'N/A';
      const endDate = pp.fields?.end_date || 'N/A';
      
      if (deptId) {
        withDepartment++;
        const count = deptCounts.get(deptId) || 0;
        deptCounts.set(deptId, count + 1);
        console.log(`${index + 1}. ${startDate} - ${endDate} → Department: ${deptName} (${deptId})`);
      } else {
        withoutDepartment++;
        console.log(`${index + 1}. ${startDate} - ${endDate} → ❌ NO DEPARTMENT`);
      }
      
      // Show raw field data for first few
      if (index < 3) {
        console.log(`   Raw fields:`, JSON.stringify({
          [departmentFieldId]: pp.fields?.[departmentFieldId],
          [departmentFieldName]: pp.fields?.[departmentFieldName],
          department_id: pp.fields?.department_id,
          Department: pp.fields?.Department,
        }, null, 2));
      }
    });

    console.log(`\n📈 Summary:`);
    console.log(`   Total pay periods: ${payPeriods.length}`);
    console.log(`   With department: ${withDepartment}`);
    console.log(`   Without department: ${withoutDepartment}`);
    console.log(`\n   By department:`);
    deptCounts.forEach((count, deptId) => {
      const deptName = departmentMap.get(deptId) || deptId;
      console.log(`   - ${deptName}: ${count} pay periods`);
    });

    // Test filtering with field ID
    if (departments.length > 0) {
      const testDeptId = departments[0].id;
      console.log(`\n🧪 Testing filter with department: ${departmentMap.get(testDeptId)} (${testDeptId})`);
      console.log(`   Using field ID: ${departmentFieldId}`);
      
      const filterUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${PAY_PERIODS_TABLE_ID}/records/list`;
      const filterResponse = await fetch(filterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 100,
          filters: {
            [departmentFieldId]: { in: [testDeptId] },
          },
        }),
      });

      if (!filterResponse.ok) {
        const errorText = await filterResponse.text();
        console.log(`   ❌ Filter failed: ${filterResponse.status} ${errorText}`);
      } else {
        const filterData = await filterResponse.json();
        console.log(`   ✅ Filter returned ${filterData.records?.length || 0} pay periods`);
      }

      // Also test with field name
      console.log(`\n🧪 Testing filter with field name: ${departmentFieldName}`);
      const filterResponse2 = await fetch(filterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 100,
          filters: {
            [departmentFieldName]: { in: [testDeptId] },
          },
        }),
      });

      if (!filterResponse2.ok) {
        const errorText = await filterResponse2.text();
        console.log(`   ❌ Filter failed: ${filterResponse2.status} ${errorText}`);
      } else {
        const filterData2 = await filterResponse2.json();
        console.log(`   ✅ Filter returned ${filterData2.records?.length || 0} pay periods`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

inspectPayPeriods();

