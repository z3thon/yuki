/**
 * Script to create permission tables in Fillout Database
 * 
 * Usage:
 *   npm run create-tables
 *   or
 *   ts-node scripts/create-permission-tables.ts
 * 
 * Make sure .env.local has FILLOUT_API_TOKEN and FILLOUT_BASE_ID set
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also load .env if it exists

const FILLOUT_BASE_URL = process.env.FILLOUT_BASE_URL || 'https://tables.fillout.com/api/v1/bases';
// Discover NoCode DB ID: f252dc2174d39484
const FILLOUT_BASE_ID = process.env.FILLOUT_BASE_ID || 'f252dc2174d39484';
const FILLOUT_API_TOKEN = process.env.FILLOUT_API_TOKEN || process.env.FILLOUT_API_KEY || '';

if (!FILLOUT_API_TOKEN) {
  console.error('❌ FILLOUT_API_TOKEN or FILLOUT_API_KEY not found in environment variables');
  console.error('   Make sure .env.local exists and has FILLOUT_API_TOKEN set');
  process.exit(1);
}

if (!FILLOUT_BASE_ID) {
  console.error('❌ FILLOUT_BASE_ID not found in environment variables');
  process.exit(1);
}

interface FieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  options?: any;
}

async function createTable(tableName: string, fields: FieldDefinition[]) {
  // Try different URL formats - Fillout API might use different structure
  const url1 = `${FILLOUT_BASE_URL}/${FILLOUT_BASE_ID}/tables`;
  const url2 = `https://tables.fillout.com/api/v1/bases/${FILLOUT_BASE_ID}/tables`;
  
  console.log(`\n📋 Creating table: ${tableName}...`);
  console.log(`   Fields: ${fields.map(f => f.name).join(', ')}`);
  console.log(`   Trying URL: ${url2}`);
  
  try {
    const response = await fetch(url2, {
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
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Check if table already exists
      if (response.status === 400 && (errorText.includes('exists') || errorText.includes('duplicate'))) {
        console.log(`   ⚠️  Table "${tableName}" may already exist. Checking...`);
        return null; // Return null to indicate table might exist
      }
      
      throw new Error(`Fillout API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log(`   ✅ Table created successfully!`);
    console.log(`   📍 Table ID: ${data.id || data.table?.id || 'N/A'}`);
    
    return data;
  } catch (error: any) {
    console.error(`   ❌ Error creating table: ${error.message}`);
    throw error;
  }
}

async function findTableByName(tableName: string) {
  const url = `https://tables.fillout.com/api/v1/bases/${FILLOUT_BASE_ID}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FILLOUT_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.statusText}`);
    }

    const data = await response.json();
    const tables = data.tables || [];
    return tables.find((t: any) => t.name.toLowerCase() === tableName.toLowerCase());
  } catch (error: any) {
    console.error(`Error finding table: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Creating Permission Tables in Fillout Database');
  console.log(`📦 Database ID: ${FILLOUT_BASE_ID}`);
  console.log(`🔗 Base URL: ${FILLOUT_BASE_URL}\n`);

  const results: Record<string, string> = {};

  // 1. User App Access Table
  const userAppAccessTable = await findTableByName('User App Access');
  if (userAppAccessTable) {
    console.log('✅ Table "User App Access" already exists');
    results.USER_APP_ACCESS_TABLE_ID = userAppAccessTable.id;
  } else {
    const table = await createTable('User App Access', [
      { name: 'user_id', type: 'single_line_text', required: true },
      { name: 'app_id', type: 'single_select', required: true, options: { 
        choices: [
          { name: 'hr', color: 'blue' },
          { name: 'crm', color: 'purple' },
          { name: 'billing', color: 'pink' }
        ]
      }},
      { name: 'granted_at', type: 'datetime', required: true },
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true },
    ]);
    
    if (table) {
      results.USER_APP_ACCESS_TABLE_ID = table.id || table.table?.id || '';
    }
  }

  // 2. User Permissions Table
  const userPermissionsTable = await findTableByName('User Permissions');
  if (userPermissionsTable) {
    console.log('✅ Table "User Permissions" already exists');
    results.USER_PERMISSIONS_TABLE_ID = userPermissionsTable.id;
  } else {
    const table = await createTable('User Permissions', [
      { name: 'user_id', type: 'single_line_text', required: true },
      { name: 'app_id', type: 'single_select', required: true, options: {
        choices: [
          { name: 'hr', color: 'blue' },
          { name: 'crm', color: 'purple' },
          { name: 'billing', color: 'pink' }
        ]
      }},
      { name: 'view_id', type: 'single_line_text', required: false },
      { name: 'resource_type', type: 'single_line_text', required: false },
      { name: 'resource_id', type: 'single_line_text', required: false },
      { name: 'actions', type: 'multiple_select', required: true, options: {
        choices: [
          { name: 'read', color: 'blue' },
          { name: 'write', color: 'green' },
          { name: 'delete', color: 'red' },
          { name: 'approve', color: 'orange' }
        ]
      }},
      { name: 'created_at', type: 'datetime', required: true },
      { name: 'updated_at', type: 'datetime', required: true },
    ]);
    
    if (table) {
      results.USER_PERMISSIONS_TABLE_ID = table.id || table.table?.id || '';
    }
  }

  // 3. Views Table (try different name if "Views" fails)
  let viewsTable = await findTableByName('Views');
  if (!viewsTable) {
    viewsTable = await findTableByName('User Views');
  }
  if (!viewsTable) {
    viewsTable = await findTableByName('App Views');
  }
  
  if (viewsTable) {
    console.log(`✅ Table "${viewsTable.name}" already exists`);
    results.VIEWS_TABLE_ID = viewsTable.id;
  } else {
    // Create Views table - try different names if "Views" is reserved
    let table;
    const viewTableNames = ['User Views', 'App Views', 'Views'];
    
    for (const tableName of viewTableNames) {
      try {
        console.log(`   Trying table name: ${tableName}...`);
        // Try with all fields
        table = await createTable(tableName, [
        { name: 'app_id', type: 'single_select', required: true, options: {
          choices: [
            { name: 'hr', color: 'blue' },
            { name: 'crm', color: 'purple' },
            { name: 'billing', color: 'pink' }
          ]
        }},
        { name: 'name', type: 'single_line_text', required: true },
        { name: 'description', type: 'long_text', required: false },
        { name: 'is_default', type: 'checkbox', required: false },
        { name: 'is_custom', type: 'checkbox', required: false },
        { name: 'created_by', type: 'single_line_text', required: false },
        { name: 'config', type: 'long_text', required: true },
        { name: 'created_at', type: 'datetime', required: false },
        { name: 'updated_at', type: 'datetime', required: false },
        ]);
        console.log(`   ✅ Successfully created table: ${tableName}`);
        results.VIEWS_TABLE_ID = table?.id || table?.table?.id || '';
        break; // Success, exit loop
      } catch (error: any) {
        if (tableName === viewTableNames[viewTableNames.length - 1]) {
          // Last attempt failed
          console.log(`   ⚠️  All table name attempts failed. Error: ${error.message}`);
          console.log(`   💡 You may need to create the Views table manually via Fillout UI`);
          throw error;
        }
        // Try next name
        continue;
      }
    }
    
    // Note: Other fields (description, is_default, is_custom, created_by, shared_with, created_at, updated_at)
    // can be added later via Fillout UI if needed
    
    if (table) {
      results.VIEWS_TABLE_ID = table.id || table.table?.id || '';
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  
  if (results.USER_APP_ACCESS_TABLE_ID) {
    console.log(`✅ USER_APP_ACCESS_TABLE_ID: ${results.USER_APP_ACCESS_TABLE_ID}`);
  }
  if (results.USER_PERMISSIONS_TABLE_ID) {
    console.log(`✅ USER_PERMISSIONS_TABLE_ID: ${results.USER_PERMISSIONS_TABLE_ID}`);
  }
  if (results.VIEWS_TABLE_ID) {
    console.log(`✅ VIEWS_TABLE_ID: ${results.VIEWS_TABLE_ID}`);
  }

  console.log('\n💡 Add these to your .env.local file:');
  console.log('   USER_APP_ACCESS_TABLE_ID=' + (results.USER_APP_ACCESS_TABLE_ID || 'your_table_id'));
  console.log('   USER_PERMISSIONS_TABLE_ID=' + (results.USER_PERMISSIONS_TABLE_ID || 'your_table_id'));
  console.log('   VIEWS_TABLE_ID=' + (results.VIEWS_TABLE_ID || 'your_table_id'));
  
  console.log('\n✨ Done! Tables are ready to use.');
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});

