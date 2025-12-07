/**
 * Script to update pay periods with correct department relationships
 * This matches pay periods to departments based on time cards/employees
 * Run with: npx tsx scripts/update-pay-period-departments.ts [department-id]
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
const TIME_CARDS_TABLE_ID = process.env.TIME_CARDS_TABLE_ID || 't4F8J8DfSSN';
const EMPLOYEES_TABLE_ID = process.env.EMPLOYEES_TABLE_ID || 'tcNK2zZPcAR';

// Get department ID from command line argument
const targetDepartmentId = process.argv[2];

async function updatePayPeriodDepartments() {
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
    
    if (!payPeriodsTable) {
      throw new Error(`Pay Periods table not found (ID: ${PAY_PERIODS_TABLE_ID})`);
    }

    // Find department_id field
    const departmentField = payPeriodsTable.fields?.find((f: any) => 
      f.name === 'department_id' || f.name === 'Department'
    );

    if (!departmentField) {
      throw new Error('department_id field not found in Pay Periods table. Run add-department-to-pay-periods.ts first.');
    }

    const departmentFieldId = departmentField.id;
    console.log(`✅ Found department field: ${departmentFieldId}`);

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

    if (departments.length === 0) {
      console.log('⚠️  No departments found.');
      return;
    }

    console.log(`📋 Found ${departments.length} departments:`);
    departments.forEach((dept: any) => {
      const name = dept.fields?.Name || dept.fields?.name || dept.id;
      console.log(`   - ${name} (${dept.id})`);
    });

    // Determine target department
    let targetDepartment: any;
    let useSimpleAssignment = false;
    
    if (targetDepartmentId) {
      targetDepartment = departments.find((d: any) => d.id === targetDepartmentId);
      if (!targetDepartment) {
        throw new Error(`Department ${targetDepartmentId} not found`);
      }
      console.log(`\n🎯 Target department: ${targetDepartment.fields?.Name || targetDepartment.fields?.name || targetDepartment.id}`);
      useSimpleAssignment = true;
    } else {
      // Use first department if only one, otherwise ask user
      if (departments.length === 1) {
        targetDepartment = departments[0];
        console.log(`\n🎯 Using only department: ${targetDepartment.fields?.Name || targetDepartment.fields?.name || targetDepartment.id}`);
        useSimpleAssignment = true;
      } else {
        console.log('\n⚠️  Multiple departments found. Please specify department ID:');
        console.log('   Usage: npx tsx scripts/update-pay-period-departments.ts <department-id>');
        return;
      }
    }

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

    console.log(`📊 Found ${payPeriods.length} pay periods`);

    // If target department specified or only one department, assign all pay periods to it
    // Otherwise, try to match based on time cards
    if (useSimpleAssignment) {
      // Simple assignment: assign all to target department
      console.log(`\n📝 Assigning all pay periods to department: ${targetDepartment.fields?.Name || targetDepartment.id}`);
      
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const pp of payPeriods) {
        // Check current department
        const currentDept = pp.fields?.department_id || pp.fields?.Department;
        const currentDeptId = Array.isArray(currentDept) ? currentDept[0] : currentDept;
        
        if (currentDeptId === targetDepartment.id) {
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
              [departmentFieldId]: [targetDepartment.id], // Use field ID for linked_record
            },
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(`❌ Failed to update pay period ${pp.id}: ${errorText}`);
          errors++;
          continue;
        }

        updated++;
        if (updated % 10 === 0) {
          console.log(`   Updated ${updated}/${payPeriods.length}...`);
        }
      }

      console.log(`\n✅ Complete!`);
      console.log(`   Updated: ${updated}`);
      console.log(`   Skipped (already correct): ${skipped}`);
      console.log(`   Errors: ${errors}`);
    } else {
      // Try to match pay periods to departments based on time cards
      console.log('\n🔍 Fetching time cards to match pay periods to departments...');
      
      const tcUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${TIME_CARDS_TABLE_ID}/records/list`;
      const tcResponse = await fetch(tcUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 10000 }),
      });

      if (!tcResponse.ok) {
        throw new Error(`Failed to fetch time cards: ${tcResponse.statusText}`);
      }

      const tcData = await tcResponse.json();
      const timeCards = tcData.records || [];
      console.log(`📊 Found ${timeCards.length} time cards`);

      // Get employees with their departments
      console.log('\n🔍 Fetching employees...');
      const empUrl = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables/${EMPLOYEES_TABLE_ID}/records/list`;
      const empResponse = await fetch(empUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 10000 }),
      });

      if (!empResponse.ok) {
        throw new Error(`Failed to fetch employees: ${empResponse.statusText}`);
      }

      const empData = await empResponse.json();
      const employees = empData.records || [];
      console.log(`📊 Found ${employees.length} employees`);

      // Create employee -> department map
      const employeeDeptMap = new Map<string, string>();
      employees.forEach((emp: any) => {
        const deptId = emp.fields?.department_id || emp.fields?.Department;
        if (deptId) {
          const deptIdValue = Array.isArray(deptId) ? deptId[0] : deptId;
          employeeDeptMap.set(emp.id, deptIdValue);
        }
      });

      // Create pay period -> department map based on time cards
      const payPeriodDeptMap = new Map<string, Map<string, number>>(); // payPeriodId -> { departmentId: count }
      
      timeCards.forEach((tc: any) => {
        const payPeriodId = tc.fields?.pay_period_id || tc.fields?.Pay_Period;
        const employeeId = tc.fields?.employee_id || tc.fields?.Employee;
        
        if (payPeriodId && employeeId) {
          const ppId = Array.isArray(payPeriodId) ? payPeriodId[0] : payPeriodId;
          const empId = Array.isArray(employeeId) ? employeeId[0] : employeeId;
          
          const deptId = employeeDeptMap.get(empId);
          if (deptId) {
            if (!payPeriodDeptMap.has(ppId)) {
              payPeriodDeptMap.set(ppId, new Map());
            }
            const deptCounts = payPeriodDeptMap.get(ppId)!;
            deptCounts.set(deptId, (deptCounts.get(deptId) || 0) + 1);
          }
        }
      });

      // Update pay periods based on most common department
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      let noMatch = 0;

      for (const pp of payPeriods) {
        const deptCounts = payPeriodDeptMap.get(pp.id);
        
        if (!deptCounts || deptCounts.size === 0) {
          noMatch++;
          console.log(`⚠️  Pay period ${pp.id} (${pp.fields?.start_date} - ${pp.fields?.end_date}) has no matching time cards`);
          continue;
        }

        // Find department with most time cards
        let maxDept = '';
        let maxCount = 0;
        deptCounts.forEach((count, deptId) => {
          if (count > maxCount) {
            maxCount = count;
            maxDept = deptId;
          }
        });

        // Check current department
        const currentDept = pp.fields?.department_id || pp.fields?.Department;
        const currentDeptId = Array.isArray(currentDept) ? currentDept[0] : currentDept;
        
        if (currentDeptId === maxDept) {
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
              [departmentFieldId]: [maxDept], // Use field ID for linked_record
            },
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(`❌ Failed to update pay period ${pp.id}: ${errorText}`);
          errors++;
          continue;
        }

        updated++;
        const deptName = departments.find((d: any) => d.id === maxDept)?.fields?.Name || maxDept;
        console.log(`   ✅ Updated ${pp.id} → ${deptName} (${maxCount} time cards)`);
      }

      console.log(`\n✅ Complete!`);
      console.log(`   Updated: ${updated}`);
      console.log(`   Skipped (already correct): ${skipped}`);
      console.log(`   No match (no time cards): ${noMatch}`);
      console.log(`   Errors: ${errors}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

updatePayPeriodDepartments();

